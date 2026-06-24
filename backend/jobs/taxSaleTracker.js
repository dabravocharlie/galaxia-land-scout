// jobs/taxSaleTracker.js
// Monitors county tax-sale pages for CHANGES rather than parsing parcels.
//
// On each run, for every county in the registry:
//   1. Fetch the page HTML
//   2. Strip out noise (nav, scripts, styles, boilerplate) and extract the
//      meaningful text + any PDF links
//   3. Compute a hash fingerprint of that content
//   4. Compare to the stored fingerprint:
//        - first time seeing it      -> store baseline, no alert
//        - same as before            -> no change, just update last_checked
//        - different                 -> a change! flag alert_pending = true
//
// This works on every county type (JS-rendered, PDF, custom) because detecting
// "did this page change" doesn't require understanding the parcel data.

const crypto = require('crypto');
const { runTrackedJob } = require('./jobHelpers');
const { pool } = require('../db/pool');
const { COUNTIES } = require('./countyRegistry');

// Pull meaningful content + PDF links out of the page HTML.
function extractContent($, cheerio) {
  // Remove obvious noise so nav/menu churn doesn't trigger false "changes"
  $('script, style, nav, header, footer, noscript, svg').remove();
  $('[class*="nav"], [class*="menu"], [id*="nav"], [id*="menu"]').remove();

  // Grab visible text, collapse whitespace
  let text = $('body').text() || '';
  text = text.replace(/\s+/g, ' ').trim();

  // Find any PDF links — these are the strongest signal a sale list was posted
  const pdfLinks = [];
  $('a[href$=".pdf"], a[href*=".pdf?"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) pdfLinks.push(href);
  });

  // We focus the fingerprint on the part of the page most likely to carry
  // sale info: look for a chunk mentioning "tax sale" and the PDF links.
  // Including the full body text would make the hash too sensitive to trivial
  // edits; including too little would miss real changes. PDF links + a trimmed
  // body excerpt is a good balance.
  const lower = text.toLowerCase();
  let focus = '';
  const idx = lower.indexOf('tax sale');
  if (idx >= 0) {
    focus = text.slice(Math.max(0, idx - 100), idx + 1500);
  } else {
    focus = text.slice(0, 1500);
  }

  return {
    focus,
    pdfLinks,
    snippet: focus.slice(0, 300),
  };
}

function hashContent(focus, pdfLinks) {
  const material = focus + '||' + pdfLinks.sort().join('|');
  return crypto.createHash('sha256').update(material).digest('hex');
}

async function checkCounty(county, fetch, cheerio) {
  const res = await fetch(county.url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 20000,
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const { focus, pdfLinks, snippet } = extractContent($, cheerio);
  const newHash = hashContent(focus, pdfLinks);

  // Look up the existing row for this county
  const existing = await pool.query(
    'SELECT id, content_hash FROM county_watch WHERE county = $1 AND state = $2',
    [county.county, county.state]
  );

  if (existing.rows.length === 0) {
    // First time — store baseline, no alert
    await pool.query(
      `INSERT INTO county_watch
        (county, state, url, platform, content_hash, content_snippet, pdf_links,
         last_checked_at, last_changed_at, change_count, alert_pending)
       VALUES ($1,$2,$3,$4,$5,$6,$7, NOW(), NOW(), 0, FALSE)`,
      [county.county, county.state, county.url, county.platform || null,
       newHash, snippet, JSON.stringify(pdfLinks)]
    );
    return { status: 'baseline', changed: false };
  }

  const row = existing.rows[0];

  if (row.content_hash === newHash) {
    // No change
    await pool.query(
      `UPDATE county_watch SET last_checked_at = NOW(), last_error = NULL WHERE id = $1`,
      [row.id]
    );
    return { status: 'unchanged', changed: false };
  }

  // Changed! Flag it for review.
  await pool.query(
    `UPDATE county_watch
     SET content_hash = $1, content_snippet = $2, pdf_links = $3,
         last_checked_at = NOW(), last_changed_at = NOW(),
         change_count = change_count + 1, alert_pending = TRUE,
         alert_emailed = FALSE, last_error = NULL
     WHERE id = $4`,
    [newHash, snippet, JSON.stringify(pdfLinks), row.id]
  );
  return { status: 'changed', changed: true };
}

async function trackTaxSales() {
  return runTrackedJob('tax_sale_tracker', 'GA', async () => {
    const fetch = (await import('node-fetch')).default;
    const cheerio = await import('cheerio');

    let listingsFound = 0;   // counties checked
    let newListings = 0;     // counties that changed

    for (const county of COUNTIES) {
      try {
        console.log(`[tracker] Checking ${county.county}, ${county.state}...`);
        const result = await checkCounty(county, fetch, cheerio);
        listingsFound++;
        if (result.changed) {
          newListings++;
          console.log(`[tracker] 🔔 ${county.county} CHANGED — alert queued`);
        } else {
          console.log(`[tracker] ${county.county}: ${result.status}`);
        }
        await new Promise(r => setTimeout(r, 1200));
      } catch (err) {
        console.error(`[tracker] Error checking ${county.county}:`, err.message);
        // Record the error on the row if it exists
        await pool.query(
          `UPDATE county_watch SET last_checked_at = NOW(), last_error = $1
           WHERE county = $2 AND state = $3`,
          [err.message, county.county, county.state]
        ).catch(() => {});
      }
    }

    console.log(`[tracker] Done: ${listingsFound} counties checked, ${newListings} changed`);
    return { listingsFound, newListings };
  });
}

module.exports = { trackTaxSales };
