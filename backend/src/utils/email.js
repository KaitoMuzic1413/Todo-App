import nodemailer from 'nodemailer';

export const sendEmail = async ({ to, subject, html }) => {
  const emailUser = process.env.EMAIL_USER;
  const emailProvider = String(process.env.EMAIL_PROVIDER || '').toLowerCase();
  const apiProvider = emailProvider || (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'resend');
  const apiKey = apiProvider === 'sendgrid' ? process.env.SENDGRID_API_KEY : process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || emailUser;

  if (apiKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const endpoint = apiProvider === 'sendgrid'
        ? 'https://api.sendgrid.com/v3/mail/send'
        : 'https://api.resend.com/emails';
      const payload = apiProvider === 'sendgrid'
        ? { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: 'text/html', value: html }] }
        : { from, to: [to], subject, html };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok && response.status !== 202) {
        const providerMessage = (await response.text()).slice(0, 500);
        throw new Error(`${apiProvider} request failed with status ${response.status}: ${providerMessage}`);
      }
      return;
    } finally {
      clearTimeout(timeout);
    }
  }

  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) {
    throw new Error('Server misconfiguration: configure SendGrid, Resend, or SMTP credentials.');
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

  await transporter.sendMail({ from: `"Todo App" <${emailUser}>`, to, subject, html });
};