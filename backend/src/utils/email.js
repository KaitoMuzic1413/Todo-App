import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html, text, categories = [] }) => {
  const emailUser = process.env.EMAIL_USER;
  const configuredProvider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  const provider = configuredProvider || (process.env.SENDGRID_API_KEY ? 'sendgrid' : process.env.RESEND_API_KEY ? 'resend' : 'smtp');
  const from = process.env.EMAIL_FROM || emailUser;
  const plainText = text || html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

  if (provider === 'sendgrid' || provider === 'resend') {
    const apiKey = provider === 'sendgrid' ? process.env.SENDGRID_API_KEY : process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error(`${provider} is selected but its API key is missing.`);
    if (!from) throw new Error('EMAIL_FROM is required for API email delivery.');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const endpoint = provider === 'sendgrid'
        ? 'https://api.sendgrid.com/v3/mail/send'
        : 'https://api.resend.com/emails';
      const payload = provider === 'sendgrid'
        ? {
            personalizations: [{ to: [{ email: to }] }],
            from: { email: from },
            subject,
            content: [
              { type: 'text/plain', value: plainText },
              { type: 'text/html', value: html },
            ],
            ...(categories.length ? { categories } : {}),
          }
        : { from, to: [to], subject, text: plainText, html };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const accepted = provider === 'sendgrid' ? response.status === 202 : response.ok;
      if (!accepted) {
        const providerMessage = (await response.text()).slice(0, 500);
        throw new Error(`${provider} request failed with status ${response.status}: ${providerMessage}`);
      }
      return {
        provider,
        status: response.status,
        messageId: response.headers.get('x-message-id') || undefined,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (provider !== 'smtp') throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}.`);

  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) {
    throw new Error('SMTP is selected but EMAIL_USER or EMAIL_PASS is missing.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: emailUser, pass: emailPass },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  const result = await transporter.sendMail({ from: `"Kaito Todo" <${from || emailUser}>`, to, subject, text: plainText, html });
  return { provider: 'smtp', accepted: result.accepted?.length || 0 };
};
