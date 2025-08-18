export interface ResendEmailParams {
    to: string | string[];
    from: string;
    subject: string;
    text?: string;
    html?: string;
    reply_to?: string;
}

interface Env {
    RESEND_API_KEY: string;
    EMAIL_FROM: string;
    ORIGIN: string;
    RESEND_CLUTCHCMS_AUDIENCE: string;
}

export class ResendService {
    private env: Env;
    private base: string;

    constructor(env: Env) {
        this.env = env;
        this.base = 'https://api.resend.com';
    }

    private async request(path: string, init: RequestInit): Promise<any> {
        const res = await fetch(`${this.base}${path}`, {
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

    async sendEmail(params: ResendEmailParams): Promise<{ id: string }> {
        console.log('[ResendService.sendEmail] Starting email send with params:', {
            from: params.from,
            to: params.to,
            subject: params.subject,
            hasText: !!params.text,
            hasHtml: !!params.html,
            reply_to: params.reply_to
        });
        console.log('[ResendService.sendEmail] Resend API Key configured:', !!this.env.RESEND_API_KEY);

        try {
            console.log('[ResendService.sendEmail] Calling Resend API via fetch...');
            const response = await this.request('/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    from: params.from,
                    to: params.to,
                    subject: params.subject,
                    text: params.text,
                    html: params.html,
                    reply_to: params.reply_to
                })
            });

            console.log('[ResendService.sendEmail] Resend API response:', {
                success: !!response,
                emailId: response?.id,
                responseKeys: Object.keys(response || {})
            });

            console.log('[ResendService.sendEmail] SUCCESS: Email sent via Resend API with ID:', response.id);
            return { id: response.id };
        } catch (error) {
            console.error('[ResendService.sendEmail] EXCEPTION calling Resend API:', error);
            console.error('[ResendService.sendEmail] Error message:', (error as Error).message);
            console.error('[ResendService.sendEmail] Error stack:', (error as Error).stack);
            throw new Error(`Failed to send email: ${(error as Error).message}`);
        }
    }

    async resetPassword(email: string, token: string): Promise<boolean> {
        const url = `${this.env.ORIGIN}/app/reset?token=${token}`;

        const params: ResendEmailParams = {
            to: email,
            from: this.env.EMAIL_FROM,
            subject: 'Reset your Kayde password',
            html: `
                <p>Hi there,</p>

                <p>Someone recently requested a password change for your Kayde account. If this
                was you, you can set a new password here:</p>

                <p>Reset password <a href="${url}">${url}</a></p>

                <p>If you don't want to change your password or didn't request this, just ignore
                and delete this message.</p>

                <p>To keep your account secure, please don't forward this email to anyone. See our
                <a href="https://docs.kayde.io">Docs</a> for more security tips.</p>

                <p>Kayde!</p>
            `,
        };

        try {
            const response = await this.sendEmail(params);
            return true;
        } catch (error) {
            console.error({ error });
            return false;
        }
    }

    async sendInviteEmail(email: string, name: string = ''): Promise<boolean> {
        const url = `${this.env.ORIGIN}/app/connect`;

        console.log('email: ', email);
        console.log('name: ', name);

        const params: ResendEmailParams = {
            from: this.env.EMAIL_FROM,
            to: email,
            subject: 'Kayde - Team Invite',
            html: `
                <p>Hello ${ name ? name : 'there'},</p>

                <p>You've been invited to a team on Kayde!</p>

                <p><a href="${url}" style="background-color:rgb(34,80,244);color:rgb(255,255,255);border-radius:0.5rem;padding-top:0.75rem;padding-bottom:0.75rem;padding-left:18px;padding-right:18px;line-height:100%;text-decoration:none;display:inline-block;max-width:100%;mso-padding-alt:0px;padding:12px 18px 12px 18px">Join the team</a></p>

                <p>or copy and paste this URL into your browser:</p>

                <p><code>${url}</code></p>

                <hr style="border:0;background-color:rgb(240,242,245);height:1px;margin:1.5rem 0" />

                <p>This invitation was intended for ${email}. If you were not expecting this invitation, you can ignore this email. If you are concerned about your account's safety, please reply to this email to get in touch with us.</p>
            `,
        };

        try {
            const response = await this.sendEmail(params);
            return true;
        } catch (error) {
            console.error({ error });
            return false;
        }
    }

    async sendWelcome(email: string): Promise<boolean> {
        const params: ResendEmailParams = {
            to: email,
            from: this.env.EMAIL_FROM,
            subject: 'Welcome to Kayde',
            html: `
                <p>WELCOME TO KAYDE,</p>

                <p>Congratulations! You're joining nobody at the moment who use Kayde to build and ship sites.</p>

                <p>Here's how to get started:</p>

                <ul>
                    <li>Deploy your first project. Nothing fancy, all done in Kayde with easy to use interface.</li>
                    <li>Set up a custom domain. You can register a new domain and buy it through Kayde or assign a domain you already own to your site.</li>
                </ul>

                <p>Go to your dashboard → <a href="https://builder.kayde.io/">https://builder.kayde.io/</a></p>

                <p>Join our <a href="https://discord.gg/kYnqGqJn8t">Discord</a> → Read the <a href="https://help.clutchcms.com/">docs</a></p>

                <p>Kayde!</p>
            `,
        };

        try {
            const response = await this.sendEmail(params);
            console.log({ data: response });
            return true;
        } catch (error) {
            console.error({ error });
            return false;
        }
    }

    async sendVerificationToken(email: string, token: string, emailFrom: string): Promise<{ success: boolean; data?: any; error?: string }> {
        console.log('[ResendService.sendVerificationToken] Starting for email:', email, 'token:', token, 'emailFrom:', emailFrom);
        console.log('[ResendService.sendVerificationToken] Environment RESEND_API_KEY exists:', !!this.env.RESEND_API_KEY);
        
        const params: ResendEmailParams = {
            to: email,
            from: emailFrom,
            subject: 'Email Verification - Kayde',
            html: `
                <p>Hi there,</p>
                
                <p>Your email verification code is:</p>
                
                <h2 style="font-size: 32px; font-weight: bold; text-align: center; background-color: #f5f5f5; padding: 20px; border-radius: 8px; letter-spacing: 4px;">${token}</h2>
                
                <p>This code will expire in 15 minutes.</p>
                
                <p>If you didn't request this verification, please ignore this email.</p>
                
                <p>Kayde!</p>
            `
        };

        console.log('[ResendService.sendVerificationToken] Email parameters:', {
            to: params.to,
            from: params.from,
            subject: params.subject,
            htmlLength: params.html?.length
        });

        try {
            console.log('[ResendService.sendVerificationToken] Calling sendEmail method...');
            const response = await this.sendEmail(params);
            
            console.log('[ResendService.sendVerificationToken] sendEmail response:', {
                responseExists: !!response,
                emailId: response?.id
            });
            
            console.log('[ResendService.sendVerificationToken] SUCCESS: Email sent successfully with ID:', response.id);
            return {
                success: true,
                data: {
                    message: 'Verification token sent successfully',
                    emailId: response.id
                }
            };
        } catch (error) {
            console.error('[ResendService.sendVerificationToken] EXCEPTION:', error);
            console.error('[ResendService.sendVerificationToken] Error message:', (error as Error).message);
            console.error('[ResendService.sendVerificationToken] Error stack:', (error as Error).stack);
            return {
                success: false,
                error: 'Failed to send verification token'
            };
        }
    }
}