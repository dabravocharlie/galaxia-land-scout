// emails/businessDigest.js
// Weekly digest of newly found cheap businesses (not yet emailed), cheapest
// first. Marks them emailed after a successful send.

const { pool } = require('../db/pool');
const { sendEmail } = require('./client');
const { wrap, money, escapeHtml } = require('./layout');

function bizRow(b) {
  const cf = b.cash_flow ? `<span style="font-family:Arial,sans-serif;font-size:12px;color:#A8A395;"> &middot; cash flow ${money(b.cash_flow)}</span>` : '';
  const where = b.location ? escapeHtml(b.location) : (b.state || '');
  const link = b.source_url
    ? `<a href="${escapeHtml(b.source_url)}" style="color:#B8893F;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">view listing &raquo;</a>`
    : '';
  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #34362F;vertical-align:top;">
        <div style="font-size:15px;color:#E8E4D9;margin-bottom:3px;">${escapeHtml(b.title || 'Business for sale')}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#A8A395;">${where}</div>
        ${link ? `<div style="margin-top:4px;">${link}</div>` : ''}
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #34362F;text-align:right;vertical-align:top;white-space:nowrap;">
        <div style="font-family:'Courier New',monospace;font-size:15px;font-weight:bold;color:#E8E4D9;">${money(b.price)}</div>
        ${cf}
      </td>
    </tr>`;
}

async function sendBusinessDigest() {
  const result = await pool.query(`
    SELECT id, source_url, state, location, title, price, cash_flow
    FROM businesses
    WHERE emailed = FALSE
    ORDER BY (price IS NULL), price ASC
    LIMIT 60
  `);
  const rows = result.rows;
  if (rows.length === 0) {
    return { sent: false, reason: 'nothing_new', count: 0 };
  }

  const intro = `${rows.length} cheap business${rows.length === 1 ? '' : 'es'} found this week (under $50k)`;
  const bodyHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows.map(bizRow).join('')}
    </table>`;
  const html = wrap({ title: 'Cheap Businesses', intro, bodyHtml });
  const subject = `Galaxia — ${rows.length} cheap business${rows.length === 1 ? '' : 'es'} for sale`;

  const sendResult = await sendEmail({ subject, html });
  if (sendResult.sent) {
    await pool.query(
      `UPDATE businesses SET emailed = TRUE WHERE id = ANY($1::int[])`,
      [rows.map(r => r.id)]
    );
  }
  return { ...sendResult, count: rows.length };
}

module.exports = { sendBusinessDigest };
