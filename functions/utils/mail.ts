/**
 * Mail notification utility for EdgeOne Pages
 * Supports HTTP APIs (Resend, SendGrid) and native SMTP via TCP sockets (connect API).
 */

export interface MailConfig {
  smtpService?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpSecure?: string;
  smtpUser?: string;
  smtpPass?: string;
  senderName?: string;
  senderEmail?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)?)\}\}/g, (_, key) => vars[key] ?? '');
}

export function buildMailSubject(template: string, vars: Record<string, string>): string {
  return renderTemplate(template, vars);
}

export function buildMailHtml(template: string, vars: Record<string, string>): string {
  return renderTemplate(template, vars);
}

// ---- HTTP API senders ----

async function sendViaResend(apiKey: string, from: string, msg: MailMessage): Promise<void> {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Resend API error ${resp.status}: ${text}`);
  }
}

async function sendViaSendgrid(apiKey: string, from: string, msg: MailMessage): Promise<void> {
  const resp = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: msg.to }] }],
      from: { email: from },
      subject: msg.subject,
      content: [{ type: 'text/html', value: msg.html }],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`SendGrid API error ${resp.status}: ${text}`);
  }
}

// ---- Native SMTP via TCP sockets (Cloudflare Workers / EdgeOne Pages connect API) ----

function base64Encode(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

async function sendViaSmtp(
  host: string,
  port: number,
  secure: boolean,
  user: string,
  pass: string,
  from: string,
  displayFrom: string,
  msg: MailMessage,
): Promise<void> {
  // @ts-ignore - EdgeOne Pages may expose connect on globalThis
  const connectFn = (globalThis as any).connect;
  if (!connectFn || typeof connectFn !== 'function') {
    throw new Error('Native SMTP requires TCP socket support (connect API), which is not available in this runtime. Please use SMTP_SERVICE=resend or sendgrid.');
  }

  const socket = await connectFn(
    { hostname: host, port },
    { secureTransport: secure ? 'on' : 'off', allowHalfOpen: false },
  );

  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  let readBuf = '';
  async function readLine(): Promise<string> {
    while (true) {
      const nl = readBuf.indexOf('\n');
      if (nl >= 0) {
        const line = readBuf.slice(0, nl).replace(/\r$/, '');
        readBuf = readBuf.slice(nl + 1);
        return line;
      }
      const { done, value } = await reader.read();
      if (done) break;
      readBuf += dec.decode(value, { stream: true });
    }
    const line = readBuf.replace(/\r$/, '');
    readBuf = '';
    return line;
  }

  async function send(data: string): Promise<void> {
    await writer.write(enc.encode(data + '\r\n'));
  }

  async function expect(codePrefix: string): Promise<void> {
    while (true) {
      const line = await readLine();
      if (line.startsWith(codePrefix)) return;
      if (!line.startsWith(codePrefix[0])) {
        throw new Error(`SMTP unexpected response: ${line}`);
      }
    }
  }

  try {
    await expect('220');
    await send(`EHLO waline`);
    // read all 250 lines
    while (true) {
      const line = await readLine();
      if (line.startsWith('250 ')) break;
      if (!line.startsWith('250-')) throw new Error(`SMTP EHLO error: ${line}`);
    }

    await send('AUTH LOGIN');
    await expect('334');
    await send(base64Encode(user));
    await expect('334');
    await send(base64Encode(pass));
    await expect('235');

    await send(`MAIL FROM:<${from}>`);
    await expect('250');
    await send(`RCPT TO:<${msg.to}>`);
    await expect('250');
    await send('DATA');
    await expect('354');

    const subjectB64 = base64Encode(msg.subject);
    const payload = [
      `From: ${displayFrom || from}`,
      `To: ${msg.to}`,
      `Subject: =?UTF-8?B?${subjectB64}?=`,
      `Content-Type: text/html; charset=UTF-8`,
      `MIME-Version: 1.0`,
      '',
      msg.html,
      '.',
    ].join('\r\n');

    await send(payload);
    await expect('250');
    await send('QUIT');
  } finally {
    try { await writer.close(); } catch {}
    try { await reader.cancel(); } catch {}
  }
}

// ---- Public API ----

export async function sendMail(config: MailConfig, msg: MailMessage): Promise<void> {
  const service = (config.smtpService || '').toLowerCase().trim();
  const from = config.senderEmail || config.smtpUser || '';
  const fromName = config.senderName || '';
  const displayFrom = fromName ? `${fromName} <${from}>` : from;

  if (!from) {
    throw new Error('senderEmail or smtpUser is required');
  }
  if (!msg.to) {
    throw new Error('Mail recipient (to) is required');
  }

  if (service === 'resend') {
    await sendViaResend(config.smtpPass || '', displayFrom, msg);
    return;
  }

  if (service === 'sendgrid') {
    await sendViaSendgrid(config.smtpPass || '', displayFrom, msg);
    return;
  }

  // Fallback to native SMTP
  const host = config.smtpHost || '';
  const port = parseInt(config.smtpPort || '465');
  const secure = config.smtpSecure !== 'false' && config.smtpSecure !== '0';
  const user = config.smtpUser || '';
  const pass = config.smtpPass || '';

  if (!host || !user || !pass) {
    throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASS are required for SMTP mode');
  }

  const pureFrom = from.replace(/.*<([^>]+)>.*/, '$1') || from;
  await sendViaSmtp(host, port, secure, user, pass, pureFrom, displayFrom, msg);
}
