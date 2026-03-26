import { env } from 'cloudflare:workers';
import { url as requestUrl } from '@kuratchi/js/request';

const FROM = 'noreply@kuratchi.cloud';

function getBaseUrl(): string {
  try {
    return requestUrl.origin;
  } catch {
    return 'https://kuratchi.cloud';
  }
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${getBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;

  await env.EMAIL.send({
    to: email,
    from: FROM,
    subject: 'Verify your email — Kuratchi',
    html: `<p>Hi there,</p>
<p>Thanks for signing up for Kuratchi! Please verify your email address by clicking the link below:</p>
<p><a href="${verifyUrl}">Verify Email Address</a></p>
<p>This link expires in 24 hours.</p>
<p>If you didn't create an account, you can safely ignore this email.</p>`,
    text: `Thanks for signing up for Kuratchi! Verify your email by visiting: ${verifyUrl}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account, you can safely ignore this email.`,
  });
}

export async function sendWelcomeEmail(email: string): Promise<void> {
  await env.EMAIL.send({
    to: email,
    from: FROM,
    subject: 'Welcome to Kuratchi!',
    html: `<p>Hi there,</p>
<p>Your email has been verified and your account is ready to go.</p>
<p><a href="${getBaseUrl()}/auth/signin">Sign in to Kuratchi</a></p>`,
    text: `Your email has been verified and your account is ready to go.\n\nSign in at: ${getBaseUrl()}/auth/signin`,
  });
}

export async function sendInviteEmail(email: string, inviteToken: string, inviterName: string): Promise<void> {
  const inviteUrl = `${getBaseUrl()}/auth/accept-invite?token=${encodeURIComponent(inviteToken)}`;

  await env.EMAIL.send({
    to: email,
    from: FROM,
    subject: `You've been invited to Kuratchi`,
    html: `<p>Hi there,</p>
<p>${inviterName} has invited you to join their team on Kuratchi.</p>
<p><a href="${inviteUrl}">Accept Invitation</a></p>
<p>This invite expires in 7 days.</p>
<p>If you weren't expecting this, you can safely ignore this email.</p>`,
    text: `${inviterName} has invited you to join their team on Kuratchi.\n\nAccept the invitation: ${inviteUrl}\n\nThis invite expires in 7 days.\n\nIf you weren't expecting this, you can safely ignore this email.`,
  });
}
