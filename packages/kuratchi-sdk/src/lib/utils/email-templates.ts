export type TemplateName = 'verification' | 'resetPassword' | 'invite' | 'welcome' | 'magicLink';

export interface TemplateRenderOptions {
  origin: string;
  data: Record<string, any>;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function simpleInterpolate(template: string, data: Record<string, any>): string {
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
    const value = key.split('.').reduce((acc: any, k: string) => acc?.[k], data);
    return value == null ? '' : String(value);
  });
}

export function renderVerification({ origin, data }: TemplateRenderOptions) {
  const token = data.token || '';
  const subject = 'Email Verification';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <p>Hi there,</p>
      <p>Your email verification code is:</p>
      <h2 style="font-size: 32px; font-weight: bold; text-align: center; background-color: #f5f5f5; padding: 20px; border-radius: 8px; letter-spacing: 4px;">${escapeHtml(token)}</h2>
      <p>This code will expire in 15 minutes.</p>
      <p>If you didn't request this verification, please ignore this email.</p>
    </div>
  `;
  const text = `Your email verification code is: ${token}\nThis code will expire in 15 minutes.`;
  return { subject, html, text };
}

export function renderResetPassword({ origin, data }: TemplateRenderOptions) {
  const token = data.token || '';
  const url = `${origin.replace(/\/$/, '')}/app/reset?token=${encodeURIComponent(token)}`;
  const subject = 'Reset your password';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <p>Someone recently requested a password change for your account.</p>
      <p>Reset password <a href="${url}">${url}</a></p>
      <p>If you don't want to change your password or didn't request this, just ignore this message.</p>
    </div>
  `;
  const text = `Reset your password: ${url}`;
  return { subject, html, text };
}

export function renderInvite({ origin, data }: TemplateRenderOptions) {
  const url = data.url || `${origin.replace(/\/$/, '')}/app/connect`;
  const name = data.name || '';
  const subject = 'Team Invite';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <p>Hello ${escapeHtml(name || 'there')},</p>
      <p>You've been invited to a team.</p>
      <p><a href="${url}" style="background-color:#2250f4;color:#fff;border-radius:8px;padding:12px 18px;line-height:100%;text-decoration:none;display:inline-block;">Join the team</a></p>
      <p>or copy and paste this URL into your browser:</p>
      <p><code>${url}</code></p>
    </div>
  `;
  const text = `You've been invited to a team. Join: ${url}`;
  return { subject, html, text };
}

export function renderWelcome({ origin, data }: TemplateRenderOptions) {
  const dashboardUrl = `${origin.replace(/\/$/, '')}/dashboard`;
  const subject = 'Welcome';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <p>Welcome!</p>
      <p>You're all set. Get started at <a href="${dashboardUrl}">${dashboardUrl}</a>.</p>
    </div>
  `;
  const text = `Welcome! Get started: ${dashboardUrl}`;
  return { subject, html, text };
}

export function renderMagicLink({ origin, data }: TemplateRenderOptions) {
  const link = data.link || origin.replace(/\/$/, '');
  const subject = 'Sign in to your account';
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;">
      <p>Click the button below to sign in securely:</p>
      <p><a href="${link}" style="background-color:#2250f4;color:#fff;border-radius:8px;padding:12px 18px;line-height:100%;text-decoration:none;display:inline-block;">Sign in</a></p>
      <p>Or copy and paste this URL into your browser:</p>
      <p><code>${link}</code></p>
    </div>
  `;
  const text = `Sign in: ${link}`;
  return { subject, html, text };
}

export function renderTemplate(name: TemplateName, opts: TemplateRenderOptions) {
  switch (name) {
    case 'verification':
      return renderVerification(opts);
    case 'resetPassword':
      return renderResetPassword(opts);
    case 'invite':
      return renderInvite(opts);
    case 'welcome':
      return renderWelcome(opts);
    case 'magicLink':
      return renderMagicLink(opts);
    default:
      return { subject: '', html: '', text: '' };
  }
}
