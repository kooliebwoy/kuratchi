import { Agent } from 'agents';

type SessionRole = 'system' | 'user' | 'assistant';

type SessionMessage = {
  role: SessionRole;
  content: string;
};

type SessionState = {
  sessionId: string;
  organizationId: string;
  model: string;
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
};

type ChatRequestBody = {
  organizationId?: string;
  sessionId?: string;
  model?: string;
  message?: string;
  messages?: SessionMessage[];
  system?: string;
  reset?: boolean;
  stream?: boolean;
};

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MAX_SESSION_MESSAGES = 40;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isMessage(value: unknown): value is SessionMessage {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    (record.role === 'system' || record.role === 'user' || record.role === 'assistant') &&
    typeof record.content === 'string' &&
    record.content.trim().length > 0
  );
}

function normalizeMessages(messages: unknown): SessionMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages.filter(isMessage).map((message) => ({
    role: message.role,
    content: message.content.trim(),
  }));
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
  const direct = record.response;
  if (typeof direct === 'string') return direct.trim();

  const resultField = record.result;
  if (typeof resultField === 'string') return resultField.trim();
  if (resultField && typeof resultField === 'object') {
    const nested = resultField as Record<string, unknown>;
    if (typeof nested.response === 'string') return nested.response.trim();
    if (typeof nested.output_text === 'string') return nested.output_text.trim();
  }

  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>;
    if (typeof first.text === 'string') return first.text.trim();
    const message = first.message;
    if (message && typeof message === 'object' && typeof (message as Record<string, unknown>).content === 'string') {
      return ((message as Record<string, unknown>).content as string).trim();
    }
  }

  return '';
}

export class KuratchiAiSession extends Agent<Record<string, any>, SessionState | undefined> {
  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/state') {
      if (!this.state) {
        return json({ success: false, error: 'Session not found' }, 404);
      }
      return json({ success: true, data: this.state });
    }

    if (request.method !== 'POST' || url.pathname !== '/chat') {
      return json({ success: false, error: 'Not found' }, 404);
    }

    const body = await request.json() as ChatRequestBody;
    const organizationId = body.organizationId?.trim();
    const sessionId = body.sessionId?.trim();
    if (!organizationId || !sessionId) {
      return json({ success: false, error: 'organizationId and sessionId are required' }, 400);
    }
    if (body.stream) {
      return json({ success: false, error: 'Streaming is not supported yet for Kuratchi AI sessions' }, 400);
    }

    const existing = this.state;
    if (existing && existing.organizationId !== organizationId) {
      return json({ success: false, error: 'Session organization mismatch' }, 403);
    }

    const gatewayId = this.env.AI_GATEWAY_ID;
    if (!gatewayId) {
      return json({ success: false, error: 'AI gateway is not configured' }, 500);
    }
    if (!this.env.AI?.run) {
      return json({ success: false, error: 'Workers AI binding is not configured' }, 500);
    }

    const model = body.model?.trim() || existing?.model || DEFAULT_MODEL;
    let messages = body.reset ? [] : [...(existing?.messages ?? [])];

    const providedMessages = normalizeMessages(body.messages);
    if (providedMessages.length > 0) {
      messages = providedMessages;
    }

    const systemPrompt = body.system?.trim();
    if (systemPrompt) {
      if (messages[0]?.role === 'system') {
        messages[0] = { role: 'system', content: systemPrompt };
      } else {
        messages = [{ role: 'system', content: systemPrompt }, ...messages];
      }
    }

    const userMessage = body.message?.trim();
    if (userMessage) {
      messages = [...messages, { role: 'user', content: userMessage }];
    }

    messages = trimMessages(messages);
    if (!messages.some((message) => message.role === 'user')) {
      return json({ success: false, error: 'At least one user message is required' }, 400);
    }

    const result = await this.env.AI.run(
      model,
      { messages },
      { gateway: { id: gatewayId } },
    );

    const reply = extractReply(result);
    if (!reply) {
      return json({ success: false, error: 'Workers AI did not return text output' }, 502);
    }

    const now = new Date().toISOString();
    const nextState: SessionState = {
      sessionId,
      organizationId,
      model,
      messages: trimMessages([...messages, { role: 'assistant', content: reply }]),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    this.setState(nextState);

    return json({
      success: true,
      data: {
        sessionId,
        organizationId,
        model,
        reply,
        messages: nextState.messages,
        createdAt: nextState.createdAt,
        updatedAt: nextState.updatedAt,
      },
    });
  }
}
