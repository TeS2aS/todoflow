console.log("SMTP CONFIG:", {
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  user: process.env.SMTP_USER
});

console.log("Sending email to:", to);

let nodemailer = null;

function parseBoolean(value) {
  return String(value || '').toLowerCase() === 'true';
}

function getSmtpConfig() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number.parseInt(process.env.SMTP_PORT || '', 10);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.EMAIL_FROM || '').trim();

  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    secure: parseBoolean(process.env.SMTP_SECURE),
    auth: user && pass ? { user, pass } : null,
    from
  };
}

function isSmtpConfigured() {
  const config = getSmtpConfig();
  return Boolean(config.host && config.from && config.auth);
}

function loadNodemailer() {
  if (nodemailer) {
    return nodemailer;
  }

  // Loaded lazily so local dev can boot even before SMTP is configured.
  // eslint-disable-next-line global-require
  nodemailer = require('nodemailer');
  return nodemailer;
}

function getResetPasswordUrl(token) {
  const configuredUrl = String(process.env.RESET_PASSWORD_URL || '').trim();
  const baseUrl = configuredUrl
    || `${String(process.env.CLIENT_URL || 'http://localhost:5000').replace(/\/+$/, '')}/reset-password.html`;

  let url;

  try {
    url = new URL(baseUrl);
  } catch (error) {
    logSmtpWarning('RESET_PASSWORD_URL is invalid, using localhost fallback');
    url = new URL('http://localhost:5000/reset-password.html');
  }

  url.searchParams.set('token', token);
  return url.toString();
}

function logSmtpWarning(reason) {
  const message = `[email] Password reset email not sent: ${reason}. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM and RESET_PASSWORD_URL.`;

  if (process.env.NODE_ENV === 'production') {
    console.error(message);
    return;
  }

  console.warn(message);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendPasswordResetEmail({ to, resetUrl, expiresInMinutes = 15 }) {
  if (!isSmtpConfigured()) {
    logSmtpWarning('SMTP is not configured');
    return {
      sent: false,
      reason: 'SMTP is not configured',
      debugResetUrl: process.env.NODE_ENV === 'production' ? undefined : resetUrl
    };
  }

  const config = getSmtpConfig();
  const transport = loadNodemailer().createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth
  });

  await transport.sendMail({
    from: config.from,
    to,
    subject: 'Reinitialisation de votre mot de passe TodoFlow',
    text: [
      'Bonjour,',
      '',
      'Vous avez demande la reinitialisation de votre mot de passe TodoFlow.',
      `Ce lien expire dans ${expiresInMinutes} minutes:`,
      resetUrl,
      '',
      'Si vous n etes pas a l origine de cette demande, ignorez cet email.'
    ].join('\n'),
    html: [
      '<p>Bonjour,</p>',
      '<p>Vous avez demande la reinitialisation de votre mot de passe TodoFlow.</p>',
      `<p><a href="${escapeHtml(resetUrl)}">Reinitialiser mon mot de passe</a></p>`,
      `<p>Ce lien expire dans ${expiresInMinutes} minutes.</p>`,
      '<p>Si vous n etes pas a l origine de cette demande, ignorez cet email.</p>'
    ].join('')
  });

  return { sent: true };
}

module.exports = {
  getResetPasswordUrl,
  isSmtpConfigured,
  sendPasswordResetEmail
};
