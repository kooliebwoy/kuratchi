import { renderTemplate, type TemplateName } from './templates.js';

interface Env {
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  ORIGIN: string;
  RESEND_CLUTCHCMS_AUDIENCE?: string;
}

export interface ResendEmailParams {
  to: string | string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
  reply_to?: string;
}

export class EmailService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const base = 'https://api.resend.com';
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
        ...(init.headers || {})
      }
    });
    if (!res.ok) {
      let errBody: any = undefined;
      try { errBody = await res.json(); } catch { errBody = await res.text(); }
      throw new Error(`Resend API ${res.status} ${res.statusText}: ${typeof errBody === 'string' ? errBody : JSON.stringify(errBody)}`);
    }
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  async send(params: Omit<ResendEmailParams, 'from'> & { from?: string }) {
    const from = params.from || this.env.EMAIL_FROM;
    const response = await this.request('/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
        reply_to: params.reply_to
      })
    });
    return { id: response?.id };
  }

  async sendTemplate(to: string | string[], template: TemplateName, data: Record<string, any>, opts?: { from?: string; subject?: string }) {
    const { subject, html, text } = renderTemplate(template, { origin: this.env.ORIGIN, data });
    return this.send({
      to,
      from: opts?.from || this.env.EMAIL_FROM,
      subject: opts?.subject || subject,
      html,
      text,
    });
  }

  // Convenience helpers
  async sendVerification(email: string, token: string, opts?: { from?: string }) {
    return this.sendTemplate(email, 'verification', { token }, opts);
  }

  async sendResetPassword(email: string, token: string, opts?: { from?: string }) {
    return this.sendTemplate(email, 'resetPassword', { token }, opts);
  }

  async sendInvite(email: string, name?: string, url?: string, opts?: { from?: string }) {
    return this.sendTemplate(email, 'invite', { name, url }, opts);
  }

  async sendWelcome(email: string, opts?: { from?: string }) {
    return this.sendTemplate(email, 'welcome', {}, opts);
  }

  async sendMagicLink(email: string, link: string, opts?: { from?: string; subject?: string }) {
    return this.sendTemplate(email, 'magicLink', { link }, opts);
  }
}
