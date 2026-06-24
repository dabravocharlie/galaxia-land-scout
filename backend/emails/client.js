// emails/client.js
// Thin wrapper around SendGrid. All outbound email goes through sendEmail().
// Requires SENDGRID_API_KEY, ALERT_FROM_EMAIL, ALERT_TO_EMAIL env vars.

const sgMail = require('@sendgrid/mail');

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const key = process.env.SENDGRID_API_KEY;
  if (!key) return false;
  sgMail.setApiKey(key);
  configured = true;
  return true;
}

/**
 * Send an email. Returns { sent: true } on success, or { sent: false, reason }
 * if email isn't configured or fails — never throws, so a mail failure can't
 * crash a scraper job.
 */
async function sendEmail({ subject, html, to }) {
  if (!ensureConfigured()) {
    console.warn('[email] SENDGRID_API_KEY not set — skipping send.');
    return { sent: false, reason: 'no_api_key' };
  }

  const from = process.env.ALERT_FROM_EMAIL;
  const recipient = to || process.env.ALERT_TO_EMAIL;

  if (!from || !recipient) {
    console.warn('[email] ALERT_FROM_EMAIL or ALERT_TO_EMAIL not set — skipping send.');
    return { sent: false, reason: 'no_addresses' };
  }

  try {
    await sgMail.send({ to: recipient, from, subject, html });
    console.log(`[email] Sent: "${subject}" -> ${recipient}`);
    return { sent: true };
  } catch (err) {
    const detail = err?.response?.body ? JSON.stringify(err.response.body) : err.message;
    console.error('[email] Send failed:', detail);
    return { sent: false, reason: detail };
  }
}

module.exports = { sendEmail };
