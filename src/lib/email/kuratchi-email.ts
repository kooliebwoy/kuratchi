import { EmailService } from './EmailService.js';

export interface KuratchiEmailConfig {
  resendApiKey: string;
  emailFrom: string;
  origin: string;
  resendAudience?: string;
}

export class KuratchiEmail {
  private service: EmailService;

  constructor(config: KuratchiEmailConfig) {
    this.service = new EmailService({
      RESEND_API_KEY: config.resendApiKey,
      EMAIL_FROM: config.emailFrom,
      ORIGIN: config.origin,
      RESEND_CLUTCHCMS_AUDIENCE: config.resendAudience,
    });
  }

  // Low-level
  async send(input: { to: string | string[]; subject: string; html?: string; text?: string; from?: string; reply_to?: string; }) {
    return this.service.send(input as any);
  }

  async sendTemplate(to: string | string[], template: 'verification' | 'resetPassword' | 'invite' | 'welcome', data: Record<string, any>, opts?: { from?: string; subject?: string }) {
    return this.service.sendTemplate(to, template, data, opts);
  }

  // High-level helpers
  async sendVerification(email: string, token: string, opts?: { from?: string }) {
    return this.service.sendVerification(email, token, opts);
  }

  async sendResetPassword(email: string, token: string, opts?: { from?: string }) {
    return this.service.sendResetPassword(email, token, opts);
  }

  async sendInvite(email: string, name?: string, url?: string, opts?: { from?: string }) {
    return this.service.sendInvite(email, name, url, opts);
  }

  async sendWelcome(email: string, opts?: { from?: string }) {
    return this.service.sendWelcome(email, opts);
  }
}
