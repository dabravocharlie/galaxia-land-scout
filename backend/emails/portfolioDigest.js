// emails/portfolioDigest.js
// Digest of the latest news across the watchlist. Sends the freshly-updated
// summaries, then marks them emailed.

const { pool } = require('../db/pool');
const { sendEmail } = require('./client');
const { wrap, escapeHtml } = require('./layout');

const SENT_COLORS = { positive: '#66CC99', negative: '#FF6B81', neutral: '#8FA6C8' };

function row(n) {
  const color = SENT_COLORS[n.sentiment] || SENT_COLORS.neutral;
  const link = n.source_url
    ? `<a href="${escapeHtml(n.source_url)}" style="color:#FF9F55;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">source &raquo;</a>`
    : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #3A4A6B;vertical-align:top;white-space:nowrap;">
        <span style="font-family:'Courier New',monospace;font-size:16px;font-weight:bold;color:#E6EDFF;">${escapeHtml(n.ticker)}</span>
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-left:8px;"></span>
      </td>
      <td style="padding:12px 0 12px 16px;border-bottom:1px solid #3A4A6B;vertical-align:top;">
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#E6EDFF;">${escapeHtml(n.summary || 'No summary.')}</div>
        ${link ? `<div style="margin-top:4px;">${link}</div>` : ''}
      </td>
    </tr>`;
}

async function sendPortfolioDigest() {
  const result = await pool.query(`
    SELECT ticker, summary, sentiment, source_url
    FROM watchlist_news
    WHERE emailed = FALSE
    ORDER BY ticker
  `);
  const rows = result.rows;
  if (rows.length === 0) return { sent: false, reason: 'nothing_new', count: 0 };

  const intro = `Latest news across ${rows.length} of your holdings`;
  const bodyHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows.map(row).join('')}
    </table>`;
  const html = wrap({ title: 'Portfolio News', intro, bodyHtml });
  const subject = `Galaxia — portfolio news update (${rows.length} holdings)`;

  const sendResult = await sendEmail({ subject, html });
  if (sendResult.sent) {
    await pool.query(`UPDATE watchlist_news SET emailed = TRUE WHERE ticker = ANY($1::text[])`,
      [rows.map(r => r.ticker)]);
  }
  return { ...sendResult, count: rows.length };
}

module.exports = { sendPortfolioDigest };
