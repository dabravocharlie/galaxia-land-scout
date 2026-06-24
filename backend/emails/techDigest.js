// emails/techDigest.js
// Weekly tech-stock digest: the tech names discovered since the last digest.
// Sends only the not-yet-emailed ones, then marks them emailed.

const { pool } = require('../db/pool');
const { sendEmail } = require('./client');
const { wrap, escapeHtml } = require('./layout');

const CATEGORY_LABELS = {
  mover: 'Mover',
  upgrade: 'Analyst',
  earnings: 'Earnings',
  emerging: 'Emerging',
  product: 'Product',
  other: 'Notable',
};

function stockRow(s) {
  const cat = CATEGORY_LABELS[s.category] || 'Notable';
  const link = s.source_url
    ? `<a href="${escapeHtml(s.source_url)}" style="color:#B8893F;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">source &raquo;</a>`
    : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #34362F;vertical-align:top;white-space:nowrap;">
        <span style="font-family:'Courier New',monospace;font-size:16px;font-weight:bold;color:#E8E4D9;">${escapeHtml(s.ticker)}</span>
        <span style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#B8893F;border:1px solid #8C6B33;padding:1px 5px;margin-left:8px;">${escapeHtml(cat)}</span>
      </td>
      <td style="padding:12px 0 12px 16px;border-bottom:1px solid #34362F;vertical-align:top;">
        <div style="font-size:14px;color:#E8E4D9;">${escapeHtml(s.company || '')}</div>
        <div style="font-family:Arial,sans-serif;font-size:13px;color:#A8A395;margin-top:3px;">${escapeHtml(s.reason || '')}</div>
        ${link ? `<div style="margin-top:4px;">${link}</div>` : ''}
      </td>
    </tr>`;
}

async function sendTechDigest() {
  const result = await pool.query(`
    SELECT id, ticker, company, category, reason, source_url
    FROM tech_stocks
    WHERE emailed = FALSE
    ORDER BY last_seen_at DESC
    LIMIT 50
  `);

  const stocks = result.rows;
  if (stocks.length === 0) {
    return { sent: false, reason: 'nothing_new', count: 0 };
  }

  const intro = `${stocks.length} tech name${stocks.length === 1 ? '' : 's'} on the radar this week`;
  const bodyHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${stocks.map(stockRow).join('')}
    </table>`;
  const html = wrap({ title: 'Tech Stock Radar', intro, bodyHtml });
  const subject = `Galaxia — ${stocks.length} tech stock${stocks.length === 1 ? '' : 's'} on the radar`;

  const sendResult = await sendEmail({ subject, html });
  if (sendResult.sent) {
    await pool.query(
      `UPDATE tech_stocks SET emailed = TRUE WHERE id = ANY($1::int[])`,
      [stocks.map(s => s.id)]
    );
  }
  return { ...sendResult, count: stocks.length };
}

module.exports = { sendTechDigest };
