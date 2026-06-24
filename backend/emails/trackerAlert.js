// emails/trackerAlert.js
// Sends an alert when watched county tax-sale pages change. Emails each change
// ONCE: it sends for counties where alert_pending = TRUE and alert_emailed =
// FALSE, then marks alert_emailed = TRUE so the same change isn't re-sent on
// the next run. (Marking a county reviewed in the dashboard clears
// alert_pending; a fresh change resets alert_emailed to FALSE again.)

const { pool } = require('../db/pool');
const { sendEmail } = require('./client');
const { wrap, escapeHtml } = require('./layout');

function countyRow(c) {
  const pdfLinks = c.pdf_links ? JSON.parse(c.pdf_links) : [];
  const pdfLine = pdfLinks.length
    ? `<div style="margin-top:4px;"><a href="${escapeHtml(pdfLinks[0])}" style="color:#B8893F;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">view posted list (PDF) &raquo;</a></div>`
    : '';
  return `
    <tr>
      <td style="padding:14px 0;border-bottom:1px solid #34362F;vertical-align:top;">
        <div style="font-size:17px;font-weight:bold;color:#E8E4D9;">${escapeHtml(c.county)}, ${escapeHtml(c.state)}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#A8A395;margin-top:3px;">
          Page changed — a new tax-sale list may have been posted.
        </div>
        <div style="margin-top:6px;">
          <a href="${escapeHtml(c.url)}" style="color:#B8893F;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">open county page &raquo;</a>
        </div>
        ${pdfLine}
      </td>
    </tr>`;
}

async function sendTrackerAlert() {
  // Counties that changed and haven't been emailed yet
  const result = await pool.query(`
    SELECT id, county, state, url, pdf_links
    FROM county_watch
    WHERE alert_pending = TRUE AND alert_emailed = FALSE
    ORDER BY last_changed_at DESC NULLS LAST
  `);

  const counties = result.rows;
  if (counties.length === 0) {
    return { sent: false, reason: 'nothing_new', count: 0 };
  }

  const intro = `${counties.length} county tax-sale page${counties.length === 1 ? '' : 's'} changed — worth a look`;
  const bodyHtml = `
    <div style="font-size:14px;color:#A8A395;margin-bottom:12px;">
      These county pages changed since the last check. A change often means a new
      tax-sale list was posted. Review the parcels directly on each county's site.
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${counties.map(countyRow).join('')}
    </table>`;

  const html = wrap({ title: 'Tax-Sale Alert', intro, bodyHtml });
  const subject = `Galaxia Land Scout — ${counties.length} county tax-sale page${counties.length === 1 ? '' : 's'} changed`;

  const sendResult = await sendEmail({ subject, html });

  // Mark these as emailed only if the send succeeded
  if (sendResult.sent) {
    const ids = counties.map(c => c.id);
    await pool.query(
      `UPDATE county_watch SET alert_emailed = TRUE WHERE id = ANY($1::int[])`,
      [ids]
    );
  }

  return { ...sendResult, count: counties.length };
}

module.exports = { sendTrackerAlert };
