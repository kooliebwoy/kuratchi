import { AIChatAgent, type OnChatMessageOptions } from '@cloudflare/ai-chat';
import { convertToModelMessages, pruneMessages, stepCountIs, streamText, tool, type StreamTextOnFinishCallback, type ToolSet, type UIMessage } from 'ai';
import { callable } from 'agents';
import { createWorkersAI } from 'workers-ai-provider';
import { z } from 'zod';
import { deriveSessionTitle, upsertAiSession } from '../database/ai-sessions';
import { DEFAULT_KURATCHI_AI_MODEL, resolveKuratchiAiModel } from './models';

type IdeAttachment = {
  name: string;
  content: string;
  mimeType: string;
};

type PromptBody = {
  model?: string;
  cwd?: string | null;
  osInfo?: string | null;
  shell?: string | null;
  sshTarget?: string | null;
  attachments?: IdeAttachment[];
};

type SessionRole = 'system' | 'user' | 'assistant';

type SessionMessage = {
  role: SessionRole;
  content: string;
};

type KuratchiIdeSessionState = {
  sessionId: string;
  organizationId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
};

type SessionSnapshot = {
  sessionId: string;
  organizationId: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  messages: UIMessage[];
};

type AnyUIMessagePart = UIMessage['parts'][number];

const RUN_TERMINAL_COMMANDS_TOOL = 'runterminalcommands';
const MAX_PERSISTED_MESSAGES = 200;
const DROVER_PRODUCT = 'drover';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function parseSessionKey(name: string | undefined): { organizationId: string; sessionId: string } {
  const safeName = typeof name === 'string' ? name : '';
  const [organizationId, ...rest] = safeName.split(':');
  return { organizationId, sessionId: rest.join(':') };
}

function nowIso(): string {
  return new Date().toISOString();
}

function baseState(name: string): KuratchiIdeSessionState {
  const { organizationId, sessionId } = parseSessionKey(name);
  const now = nowIso();
  return {
    sessionId,
    organizationId,
    model: DEFAULT_KURATCHI_AI_MODEL,
    createdAt: now,
    updatedAt: now,
  };
}

function textFromPart(part: AnyUIMessagePart): string {
  if (part.type === 'text') return part.text;
  if (part.type === 'reasoning') return part.text;
  if ('toolName' in part && 'input' in part) {
    const toolLabel = part.toolName;
    const inputText = typeof part.input === 'string' ? part.input : JSON.stringify(part.input);

    if (part.type === `tool-${RUN_TERMINAL_COMMANDS_TOOL}`) {
      if (part.state === 'output-available') {
        const outputText = typeof part.output === 'string' ? part.output : JSON.stringify(part.output);
        return `Ran terminal commands: ${inputText}\nOutput: ${outputText}`;
      }
      if (part.state === 'approval-requested') {
        return `Pending approval for terminal commands: ${inputText}`;
      }
      if (part.state === 'output-error') {
        return `Terminal command execution error: ${part.errorText}`;
      }
      if (part.state === 'output-denied') {
        return 'Terminal command execution was denied by the user.';
      }
      return `Terminal command tool state ${part.state}: ${inputText}`;
    }

    return `${toolLabel}: ${inputText}`;
  }

  return '';
}

function flattenMessage(message: UIMessage): string {
  return message.parts
    .map((part) => textFromPart(part))
    .filter((value) => value.trim().length > 0)
    .join('\n')
    .trim();
}

function toSessionMessages(messages: UIMessage[]): SessionMessage[] {
  return messages
    .map((message) => ({
      role: message.role as SessionRole,
      content: flattenMessage(message),
    }))
    .filter((message) => (message.role === 'user' || message.role === 'assistant' || message.role === 'system') && message.content.length > 0);
}

function buildEnvironmentContext(body: PromptBody): string {
  const lines: string[] = [];
  if (body.cwd) lines.push(`Current directory: ${body.cwd}`);
  if (body.osInfo) lines.push(`OS: ${body.osInfo}`);
  if (body.shell) lines.push(`Shell: ${body.shell}`);
  if (body.sshTarget) lines.push(`Connected via SSH to: ${body.sshTarget}`);
  return lines.length > 0 ? `\n\nCurrent environment:\n${lines.join('\n')}` : '';
}

function buildAttachmentContext(body: PromptBody): string {
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];
  if (attachments.length === 0) return '';

  const sections: string[] = ['\n\nAttached files for the latest user request:'];
  for (const attachment of attachments) {
    sections.push('', `--- ${attachment.name} ---`);
    if (attachment.mimeType === 'application/pdf') {
      sections.push('[PDF file - not supported]');
      continue;
    }
    if (attachment.mimeType.startsWith('image/')) {
      sections.push('[Image attachment - not supported]');
      continue;
    }
    sections.push(attachment.content);
  }
  return sections.join('\n');
}

function buildSystemPrompt(body: PromptBody): string {
  return `You are an expert terminal assistant in Drover.

Decide whether the user's request should be answered directly or handled by running shell commands.

Rules:
- If shell commands are required, call the ${RUN_TERMINAL_COMMANDS_TOOL} tool with the exact commands in execution order.
- If shell commands are not required, answer directly in plain text.
- Never prefix a conversational answer with ERROR:, ANSWER:, TOOL_CALL:, or any other protocol marker.
- Never print JSON, pseudo-tool calls, or a literal {"name": ...} blob in the chat. Use the tool call itself instead of describing it.
- If a request is risky, infeasible, or a poor fit, explain that plainly in normal prose and suggest a practical Cloudflare-native alternative.
- Keep direct answers concise and useful.
- Do not emit markdown code fences around commands.
- Prefer the minimum number of commands needed to accomplish the task.
- Never suggest obviously destructive commands unless the user explicitly asked for them.
- Always single-quote URLs that contain shell-special characters such as ?, &, =, or #.${buildEnvironmentContext(body)}${buildAttachmentContext(body)}`;
}

function createWorkersAiModel(env: Record<string, any>, model: string, state: KuratchiIdeSessionState) {
  if (!env.AI) throw new Error('Workers AI binding is not configured');

  const gateway = env.AI_GATEWAY_ID
    ? {
        id: env.AI_GATEWAY_ID,
        metadata: {
          product: DROVER_PRODUCT,
          surface: 'ide-chat',
          organizationId: state.organizationId,
          sessionId: state.sessionId,
        },
      }
    : undefined;

  const workersAi = createWorkersAI({
    binding: env.AI,
    ...(gateway ? { gateway } : {}),
  });

  return workersAi.chat(model);
}

export class KuratchiIdeSession extends AIChatAgent<Record<string, any>, KuratchiIdeSessionState> {
  initialState = baseState('');
  maxPersistedMessages = MAX_PERSISTED_MESSAGES;
  private runtimeEnv: Record<string, any>;

  constructor(ctx: DurableObjectState, env: Record<string, any>) {
    super(ctx, env);
    this.runtimeEnv = env;
  }

  private currentState(): KuratchiIdeSessionState {
    return this.state ?? baseState(this.name);
  }

  private async syncSessionIndex(messages: UIMessage[], model: string): Promise<void> {
    const state = this.currentState();
    const sessionMessages = toSessionMessages(messages);
    const lastUserMessage = [...sessionMessages].reverse().find((message) => message.role === 'user')?.content ?? null;
    const lastAssistantMessage = [...sessionMessages].reverse().find((message) => message.role === 'assistant')?.content ?? null;

    await upsertAiSession({
      id: state.sessionId,
      organizationId: state.organizationId,
      model,
      title: deriveSessionTitle(sessionMessages),
      lastUserMessage,
      lastAssistantMessage,
      messageCount: sessionMessages.length,
    });
  }

  @callable()
  async getSnapshot(): Promise<SessionSnapshot> {
    const state = this.currentState();
    return {
      sessionId: state.sessionId,
      organizationId: state.organizationId,
      model: state.model,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      messages: this.messages,
    };
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/state') {
      return json({ success: true, data: await this.getSnapshot() });
    }
    return super.onRequest(request);
  }

  async onChatMessage(onFinish: StreamTextOnFinishCallback<ToolSet>, options?: OnChatMessageOptions) {
    const body = (options?.body ?? {}) as PromptBody;
    const current = this.currentState();
    const model = resolveKuratchiAiModel(body.model ?? current.model ?? DEFAULT_KURATCHI_AI_MODEL);
    const nextState: KuratchiIdeSessionState = {
      ...current,
      model,
      updatedAt: nowIso(),
    };
    this.setState(nextState);

    const result = streamText({
      model: createWorkersAiModel(this.runtimeEnv, model, nextState),
      abortSignal: options?.abortSignal,
      onFinish,
      system: buildSystemPrompt(body),
      messages: pruneMessages({
        messages: await convertToModelMessages(this.messages),
        reasoning: 'before-last-message',
        toolCalls: 'before-last-2-messages',
      }),
      tools: {
        [RUN_TERMINAL_COMMANDS_TOOL]: tool({
          description: 'Run one or more shell commands in the user terminal.',
          inputSchema: z.object({
            commands: z.array(z.string().min(1)).min(1).max(8),
          }),
          needsApproval: true,
        }),
      },
      stopWhen: stepCountIs(5),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: this.messages,
      onFinish: async ({ messages }) => {
        const finishedState: KuratchiIdeSessionState = {
          ...this.currentState(),
          model,
          updatedAt: nowIso(),
        };
        this.setState(finishedState);
        await this.syncSessionIndex(messages, model);
      },
    });
  }
}
