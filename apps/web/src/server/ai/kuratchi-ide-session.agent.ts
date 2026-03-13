import { Agent, callable } from 'agents';
import { deriveSessionTitle, upsertAiSession } from '../database/ai-sessions';

type SessionRole = 'system' | 'user' | 'assistant';
type AgentPhase = 'idle' | 'thinking' | 'approval' | 'executing' | 'answered' | 'needs_input' | 'error';

type SessionMessage = {
  role: SessionRole;
  content: string;
};

type IdeAttachment = {
  name: string;
  content: string;
  mimeType: string;
};

type IdeCommand = {
  text: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'input';
  output: string;
};

export type KuratchiIdeState = {
  sessionId: string;
  organizationId: string;
  model: string;
  phase: AgentPhase;
  prompt: string;
  raw: string;
  response: string;
  error: string;
  commands: IdeCommand[];
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
};

type PromptOptions = {
  model?: string;
  cwd?: string | null;
  osInfo?: string | null;
  shell?: string | null;
  sshTarget?: string | null;
  attachments?: IdeAttachment[];
};

type CommandResult = {
  command: string;
  output: string;
};

type FailedAttempt = {
  command: string;
  error: string;
};

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_SESSION_MESSAGES = 40;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function jsonSafeMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === 'system' || record.role === 'user' || record.role === 'assistant') &&
    typeof record.content === 'string' &&
    record.content.trim().length > 0
  );
}

function trimMessages(messages: SessionMessage[]): SessionMessage[] {
  const system = messages.filter((message) => message.role === 'system').slice(-1);
  const nonSystem = messages.filter((message) => message.role !== 'system');
  return [...system, ...nonSystem.slice(-MAX_SESSION_MESSAGES)];
}

function extractReply(result: unknown): string {
  if (typeof result === 'string') return result.trim();
  if (!result || typeof result !== 'object') return '';

  const record = result as Record<string, unknown>;
  if (typeof record.response === 'string') return record.response.trim();

  const nested = record.result;
  if (nested && typeof nested === 'object') {
    const nestedRecord = nested as Record<string, unknown>;
    if (typeof nestedRecord.response === 'string') return nestedRecord.response.trim();
    if (typeof nestedRecord.output_text === 'string') return nestedRecord.output_text.trim();
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    if (typeof first.text === 'string') return first.text.trim();
    if (first.message && typeof first.message === 'object') {
      const message = first.message as Record<string, unknown>;
      if (typeof message.content === 'string') return message.content.trim();
    }
  }

  return '';
}

function parseSessionKey(name: string | undefined): { organizationId: string; sessionId: string } {
  const safeName = typeof name === 'string' ? name : '';
  const [organizationId, ...rest] = safeName.split(':');
  return { organizationId, sessionId: rest.join(':') };
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseState(name: string): KuratchiIdeState {
  const { organizationId, sessionId } = parseSessionKey(name);
  const now = nowIso();
  return {
    sessionId,
    organizationId,
    model: DEFAULT_MODEL,
    phase: 'idle',
    prompt: '',
    raw: '',
    response: '',
    error: '',
    commands: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

function buildEnvironmentContext(options: PromptOptions): string {
  const lines: string[] = [];
  if (options.cwd) lines.push(`Current directory: ${options.cwd}`);
  if (options.osInfo) lines.push(`OS: ${options.osInfo}`);
  if (options.shell) lines.push(`Shell: ${options.shell}`);
  if (options.sshTarget) lines.push(`Connected via SSH to: ${options.sshTarget}`);
  return lines.length > 0 ? `\n\nCurrent environment:\n${lines.join('\n')}` : '';
}

function buildPromptWithAttachments(prompt: string, attachments: IdeAttachment[]): string {
  if (attachments.length === 0) return prompt;
  const lines = [prompt, '', 'Attached files:'];
  for (const attachment of attachments) {
    lines.push('', `--- ${attachment.name} ---`);
    if (attachment.mimeType === 'application/pdf') {
      lines.push('[PDF file - not supported]');
      continue;
    }
    if (attachment.mimeType.startsWith('image/')) {
      lines.push('[Image attachment - not supported]');
      continue;
    }
    lines.push(attachment.content);
  }
  return lines.join('\n');
}

function parseCommandResponse(raw: string): { commands: IdeCommand[]; directAnswer: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { commands: [], directAnswer: 'No response returned.' };
  if (trimmed.startsWith('ANSWER:')) {
    return { commands: [], directAnswer: trimmed.slice('ANSWER:'.length).trim() };
  }
  if (trimmed.startsWith('ERROR:')) {
    return { commands: [], directAnswer: trimmed };
  }

  const commands = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => ({ text: line, status: 'pending' as const, output: '' }));

  if (commands.length === 0) {
    return { commands: [], directAnswer: trimmed };
  }

  return { commands, directAnswer: null };
}

async function runWorkersAi(env: Record<string, any>, model: string, messages: SessionMessage[]): Promise<string> {
  if (!env.AI?.run) throw new Error('Workers AI binding is not configured');
  if (!env.AI_GATEWAY_ID) throw new Error('AI gateway is not configured');

  const result = await env.AI.run(
    model,
    { messages },
    { gateway: { id: env.AI_GATEWAY_ID } },
  );

  const reply = extractReply(result);
  if (!reply) throw new Error('Workers AI did not return text output');
  return reply;
}

export class KuratchiIdeSession extends Agent<Record<string, any>, KuratchiIdeState> {
  initialState = baseState('');

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/state') {
      return json({ success: true, data: this.getCurrentState() });
    }
    return json({ success: false, error: 'Not found' }, 404);
  }

  private getCurrentState(): KuratchiIdeState {
    return this.state ?? baseState(this.name);
  }

  private async persistMetadata(nextState: KuratchiIdeState): Promise<void> {
    const lastUserMessage = [...nextState.messages].reverse().find((message) => message.role === 'user')?.content ?? null;
    const lastAssistantMessage = [...nextState.messages].reverse().find((message) => message.role === 'assistant')?.content ?? null;

    await upsertAiSession({
      id: nextState.sessionId,
      organizationId: nextState.organizationId,
      model: nextState.model,
      title: deriveSessionTitle(nextState.messages),
      lastUserMessage,
      lastAssistantMessage,
      messageCount: nextState.messages.length,
    });
  }

  @callable()
  async submitPrompt(prompt: string, options: PromptOptions = {}): Promise<KuratchiIdeState> {
    const current = this.getCurrentState();
    const attachments = Array.isArray(options.attachments) ? options.attachments : [];
    if (attachments.some((attachment) => attachment.mimeType.startsWith('image/'))) {
      const nextState = {
        ...current,
        phase: 'error' as const,
        prompt,
        error: 'Kuratchi live IDE sessions do not support image attachments yet',
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      return nextState;
    }

    const model = options.model?.trim() || current.model || DEFAULT_MODEL;
    const thinkingState: KuratchiIdeState = {
      ...current,
      model,
      prompt,
      phase: 'thinking',
      error: '',
      response: '',
      raw: '',
      commands: [],
      updatedAt: nowIso(),
    };
    this.setState(thinkingState);

    const environmentContext = buildEnvironmentContext(options);
    const systemPrompt = `You are an expert terminal assistant in Drover. The user describes tasks in natural language and you respond with executable shell commands.\n\nRules:\n- Respond with ONLY executable shell commands, one per line.\n- No explanations, no markdown, no code fences, no commentary.\n- ALWAYS single-quote URLs that contain special shell characters (?, &, =, #, etc.). For example: curl 'https://wttr.in/Houston?format=j1'\n- If the task is dangerous, respond with: ERROR: <reason>${environmentContext}`;

    const userMessage = buildPromptWithAttachments(prompt, attachments);
    const history = trimMessages([
      ...current.messages.filter(jsonSafeMessage),
      { role: 'user', content: userMessage },
    ]);

    try {
      const raw = await runWorkersAi(this.env, model, [
        { role: 'system', content: systemPrompt },
        ...history.filter((message) => message.role !== 'system'),
      ]);

      const parsed = parseCommandResponse(raw);
      const assistantMessage = { role: 'assistant' as const, content: parsed.directAnswer ?? raw };
      const nextMessages = trimMessages([...history, assistantMessage]);
      const nextState: KuratchiIdeState = {
        ...thinkingState,
        phase: parsed.directAnswer ? 'answered' : 'approval',
        raw,
        response: parsed.directAnswer ?? '',
        commands: parsed.commands,
        messages: nextMessages,
        updatedAt: nowIso(),
      };

      this.setState(nextState);
      await this.persistMetadata(nextState);
      return nextState;
    } catch (error) {
      const nextState: KuratchiIdeState = {
        ...thinkingState,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      return nextState;
    }
  }

  @callable()
  async markExecuting(commands: IdeCommand[]): Promise<KuratchiIdeState> {
    const current = this.getCurrentState();
    const nextState: KuratchiIdeState = {
      ...current,
      phase: 'executing',
      commands,
      updatedAt: nowIso(),
    };
    this.setState(nextState);
    return nextState;
  }

  @callable()
  async rejectPrompt(reason = 'Execution denied by user'): Promise<KuratchiIdeState> {
    const current = this.getCurrentState();
    const nextState: KuratchiIdeState = {
      ...current,
      phase: 'answered',
      response: reason,
      commands: [],
      updatedAt: nowIso(),
    };
    this.setState(nextState);
    return nextState;
  }

  @callable()
  async submitExecutionResults(originalPrompt: string, commandResults: CommandResult[]): Promise<KuratchiIdeState> {
    const current = this.getCurrentState();
    const resultsBlock = commandResults.map((result) => `$ ${result.command}\n${result.output}`).join('\n\n');

    const summaryMessages: SessionMessage[] = [
      {
        role: 'system',
        content: "You are a friendly, knowledgeable assistant in a terminal app called Drover. The user asked a question, commands were executed, and you now have the output. Give a clear, conversational answer. Lead with the key answer. Keep it concise. Do not use markdown code fences or repeat raw command output verbatim.",
      },
      {
        role: 'user',
        content: `Original question: ${originalPrompt}\n\nCommand outputs:\n${resultsBlock}`,
      },
    ];

    try {
      const reply = await runWorkersAi(this.env, current.model || DEFAULT_MODEL, summaryMessages);
      const nextMessages = trimMessages([...current.messages, { role: 'assistant', content: reply }]);
      const nextState: KuratchiIdeState = {
        ...current,
        phase: 'answered',
        response: reply,
        commands: current.commands.map((command) => {
          const result = commandResults.find((entry) => entry.command === command.text);
          return result ? { ...command, output: result.output } : command;
        }),
        messages: nextMessages,
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      await this.persistMetadata(nextState);
      return nextState;
    } catch (error) {
      const nextState: KuratchiIdeState = {
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      return nextState;
    }
  }

  @callable()
  async retryPrompt(originalPrompt: string, failedAttempts: FailedAttempt[], options: PromptOptions = {}): Promise<KuratchiIdeState> {
    const current = this.getCurrentState();
    const attemptsBlock = failedAttempts
      .map((attempt, index) => `Attempt ${index + 1}:\nCommand: ${attempt.command}\nError: ${attempt.error}`)
      .join('\n\n');

    const environmentContext = buildEnvironmentContext(options);
    const messages: SessionMessage[] = [
      {
        role: 'system',
        content: `You are an expert terminal assistant in Drover. A previous command failed. Analyze the error and respond with an alternative command that accomplishes the same goal.\n\nRules:\n- Respond with ONLY executable shell commands, one per line, OR a single line starting with ANSWER: if the task needs no commands.\n- Do NOT retry the exact same command that already failed.\n- ALWAYS single-quote URLs that contain special shell characters (?, &, =, #, etc.).${environmentContext}`,
      },
      {
        role: 'user',
        content: `Original request: ${originalPrompt}\n\nFailed attempts:\n${attemptsBlock}\n\nProvide an alternative approach.`,
      },
    ];

    try {
      const raw = await runWorkersAi(this.env, options.model?.trim() || current.model || DEFAULT_MODEL, messages);
      const parsed = parseCommandResponse(raw);
      const nextState: KuratchiIdeState = {
        ...current,
        phase: parsed.directAnswer ? 'answered' : 'approval',
        raw,
        response: parsed.directAnswer ?? '',
        commands: parsed.commands,
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      return nextState;
    } catch (error) {
      const nextState: KuratchiIdeState = {
        ...current,
        phase: 'error',
        error: error instanceof Error ? error.message : String(error),
        updatedAt: nowIso(),
      };
      this.setState(nextState);
      return nextState;
    }
  }
}
