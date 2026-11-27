import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || SMTP_USER;
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'COCOLYTICS';

function isPlaceholder(value) {
  return !value || value.includes('your-email@gmail.com') || value.includes('your-gmail-app-password');
}

export function getSmtpConfigurationError(env = process.env) {
  const user = String(env.SMTP_USER || '').trim();
  const password = String(env.SMTP_PASS || '').replace(/\s+/g, '');
  const fromEmail = String(env.SMTP_FROM_EMAIL || user).trim();
  const missingSettings = [];

  if (isPlaceholder(user)) {
    missingSettings.push('SMTP_USER');
  }
  if (isPlaceholder(password)) {
    missingSettings.push('SMTP_PASS');
  }
  if (env.SMTP_FROM_EMAIL && isPlaceholder(fromEmail)) {
    missingSettings.push('SMTP_FROM_EMAIL');
  }

  return missingSettings.length
    ? `Email delivery is not configured. Set valid values for ${missingSettings.join(', ')} in backend/.env.`
    : '';
}

export function sanitizeSmtpError(error, env = process.env) {
  const diagnostic = [
    error?.code && `code=${error.code}`,
    error?.responseCode && `responseCode=${error.responseCode}`,
    error?.command && `command=${error.command}`,
    error?.message && `message=${error.message}`,
  ].filter(Boolean).join('; ');
  let safeDiagnostic = diagnostic || 'Unknown SMTP error.';

  const password = String(env.SMTP_PASS || '');
  const secrets = [
    password,
    password.replace(/\s+/g, ''),
    env.SMTP_USER,
    env.SMTP_FROM_EMAIL,
  ];
  for (const secret of secrets) {
    if (secret && String(secret).length > 3) {
      safeDiagnostic = safeDiagnostic.split(String(secret)).join('[redacted]');
    }
  }

  return safeDiagnostic
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .slice(0, 500);
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
  auth: SMTP_USER && SMTP_PASS
    ? {
        user: SMTP_USER,
        pass: SMTP_PASS,
      }
    : undefined,
});

export function isSmtpConfigured() {
  return !getSmtpConfigurationError();
}

export async function verifySmtpConnection() {
  const configurationError = getSmtpConfigurationError();
  if (configurationError) {
    return { ready: false, reason: configurationError };
  }

  try {
    await transporter.verify();
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: `Gmail SMTP verification failed: ${sanitizeSmtpError(error)}`,
    };
  }
}

function buildOtpMailContent({ purpose, otp, expiresMinutes }) {
  const action = purpose === 'verify_email' ? 'Email Verification' : 'Password Reset';
  const plain = [
    `COCOLYTICS ${action}`,
    '',
    `Your OTP code is: ${otp}`,
    `This code expires in ${expiresMinutes} minutes.`,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0b2f3b;">
      <h2 style="margin: 0 0 12px;">COCOLYTICS ${action}</h2>
      <p style="margin: 0 0 10px;">Use this OTP code:</p>
      <p style="margin: 0 0 10px; font-size: 24px; letter-spacing: 3px; font-weight: bold;">${otp}</p>
      <p style="margin: 0 0 10px;">This code expires in ${expiresMinutes} minutes.</p>
      <p style="margin: 0;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  return { plain, html };
}

export async function sendOtpEmail({ to, purpose, otp, expiresMinutes = 10 }) {
  const configurationError = getSmtpConfigurationError();
  if (configurationError) {
    console.error(configurationError);
    return {
      sent: false,
      reason: configurationError,
    };
  }

  const subject = purpose === 'verify_email'
    ? 'COCOLYTICS Email Verification OTP'
    : 'COCOLYTICS Forgot Password OTP';

  const { plain, html } = buildOtpMailContent({ purpose, otp, expiresMinutes });

  try {
    await transporter.sendMail({
      from: `\"${SMTP_FROM_NAME}\" <${SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text: plain,
      html,
    });

    return { sent: true };
  } catch (error) {
    const diagnostic = sanitizeSmtpError(error);
    console.error(`Gmail SMTP OTP delivery failed: ${diagnostic}`);
    return {
      sent: false,
      reason: 'Gmail SMTP delivery failed. Check the backend logs for sanitized SMTP diagnostics.',
    };
  }
}
