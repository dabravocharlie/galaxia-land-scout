// emails/weeklyDigest.js
// Builds and sends the weekly digest: new listings found in the last 7 days,
// cheapest first, with sub-$1,000 finds highlighted. Pulls from the listings
// table (Craigslist now; retail too if/when re-enabled).

const { pool } = require('../db/pool');
const { sendEmail } = require('./client');
const { wrap, money, escapeHtml } = require('./layout');

const THRESHOLD = 1000;

const SOURCE_LABELS = {
  craigslist: 'Craigslist',
  landsearch: 'LandSearch',
  landwatch: 'LandWatch',
};

function listingRow(l) {
  const flagged = l.price !== null && Number(l.price) < THRESHOLD;
  const priceColor = flagged ? '#C96A45' : '#E8E4D9';
  const flagBadge = flagged
    ? ` <span style="font-family:Arial,sans-serif;font-size:9px;font-weight:bold;letter-spacing:1px;color:#C96A45;border:1px solid #C96A45;padding:1px 4px;">FLAGGED</span>`
    : '';
  const where = [l.county, l.state].filter(Boolean).join(', ');
  const acres = l.acreage ? ` · ${l.acreage} ac` : '';
  const viewLink = l.source_url
    ? `<a href="${escapeHtml(l.source_url)}" style="color:#B8893F;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;">View &raquo;</a>`
    : '';

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #34362F;vertical-align:top;">
        <div style="font-size:15px;color:#E8E4D9;margin-bottom:3px;">${escapeHtml(l.title || 'Untitled listing')}</div>
        <div style="font-family:Arial,sans-serif;font-size:12px;color:#A8A395;">
          ${escapeHtml(SOURCE_LABELS[l.source] || l.source)} · ${escapeHtml(where)}${acres}
        </div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #34362F;text-align:right;vertical-align:top;white-space:nowrap;">
        <div style="font-family:'Courier New',monospace;font-size:15px;font-weight:bold;color:${priceColor};">${money(l.price)}${flagBadge}</div>
        <div style="margin-top:4px;">${viewLink}</div>
      </td>
    </tr>`;
}

async function buildWeeklyDigest() {
  // New listings found in the last 7 days, cheapest first
  const result = await pool.query(`
    SELECT id, source, source_url, state, county, title, price, acreage
    FROM listings
    WHERE date_found >= NOW() - INTERVAL '7 days'
    ORDER BY (price IS NULL), price ASC
    LIMIT 100
  `);

  const listings = result.rows;
  const flaggedCount = listings.filter(l => l.price !== null && Number(l.price) < THRESHOLD).length;

  let bodyHtml;
  if (listings.length === 0) {
    bodyHtml = `<div style="font-size:15px;color:#A8A395;">No new listings turned up this week. The scrapers ran; the well was just quiet. You'll get the next batch as it comes in.</div>`;
  } else {
    bodyHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${listings.map(listingRow).join('')}
      </table>`;
  }

  const intro = listings.length === 0
    ? 'Weekly land report'
    : `${listings.length} new listing${listings.length === 1 ? '' : 's'} this week` +
      (flaggedCount > 0 ? ` · <span style="color:#C96A45;">${flaggedCount} under $1,000</span>` : '');

  const html = wrap({ title: 'Weekly Land Digest', intro, bodyHtml });
  return { html, count: listings.length, flaggedCount };
}

async function sendWeeklyDigest() {
  const { html, count, flaggedCount } = await buildWeeklyDigest();
  const subject = count === 0
    ? 'Galaxia Land Scout — weekly digest (no new listings)'
    : `Galaxia Land Scout — ${count} new listing${count === 1 ? '' : 's'}` +
      (flaggedCount > 0 ? ` (${flaggedCount} under $1k)` : '');
  const result = await sendEmail({ subject, html });
  return { ...result, count, flaggedCount };
}

module.exports = { sendWeeklyDigest, buildWeeklyDigest };
