// jobs/businesses.js
// Scrapes BizBuySell for cheap businesses for sale in Georgia (under a price
// ceiling). BizBuySell serves listings in static HTML (no anti-bot wall) but
// ignores price-filter URL params server-side, so we scrape pages in default
// order and filter by parsed price in code.
//
// Strategy: try embedded JSON-LD structured data first (cleanest, most stable),
// then fall back to HTML anchor parsing. A debug function reports what the page
// actually contains so selectors can be tuned after first deploy.

const { runTrackedJob, upsertBusiness } = require('./jobHelpers');

const PRICE_CEILING = 50000;
const MAX_PAGES = 5; // ultra_premium costs ~30 credits/page; keep modest
const STATE = 'GA';
const STATE_SLUG = 'georgia';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// BizBuySell blocks datacenter IPs (403), so we route through ScraperAPI's
// ultra_premium residential pool (requires a PAID ScraperAPI plan). Requires
// SCRAPERAPI_KEY env var. render=false keeps credit cost down since the
// listings are in the static HTML and don't need JS rendering.
function viaScraperApi(targetUrl) {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    api_key: key,
    url: targetUrl,
    ultra_premium: 'true',
  });
  return `https://api.scraperapi.com/?${params.toString()}`;
}

function pageUrl(n) {
  return n === 1
    ? `https://www.bizbuysell.com/${STATE_SLUG}-businesses-for-sale/`
    : `https://www.bizbuysell.com/${STATE_SLUG}-businesses-for-sale/${n}/`;
}

function parseMoney(text) {
  if (!text) return null;
  const m = String(text).match(/\$\s*([0-9][0-9,]*)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

// ---- JSON-LD extraction ----
// BizBuySell (and many marketplaces) embed listings as schema.org structured
// data in <script type="application/ld+json"> blocks. We pull any objects that
// look like listings (have a name + offers/price + url).
function extractFromJsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let raw = $(el).contents().text();
    if (!raw) return;
    let data;
    try { data = JSON.parse(raw); } catch { return; }

    // Normalize to an array of candidate nodes (handle @graph and arrays)
    const nodes = [];
    const pushNode = (n) => { if (n && typeof n === 'object') nodes.push(n); };
    if (Array.isArray(data)) data.forEach(pushNode);
    else { pushNode(data); if (Array.isArray(data['@graph'])) data['@graph'].forEach(pushNode); }

    for (const node of nodes) {
      // itemList of listings
      const items = node.itemListElement || node.items;
      if (Array.isArray(items)) {
        for (const it of items) {
          const item = it.item || it;
          const rec = jsonLdToRecord(item);
          if (rec) out.push(rec);
        }
      }
      const rec = jsonLdToRecord(node);
      if (rec) out.push(rec);
    }
  });
  return out;
}

function jsonLdToRecord(node) {
  if (!node || typeof node !== 'object') return null;
  const name = node.name || node.title;
  const url = node.url || node['@id'];
  if (!name || !url) return null;
  let price = null;
  if (node.offers) {
    const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    price = parseMoney(offer.price != null ? `$${offer.price}` : offer.priceSpecification?.price != null ? `$${offer.priceSpecification.price}` : null);
  }
  if (price === null && node.price != null) price = parseMoney(`$${node.price}`);
  const idMatch = String(url).match(/\/(\d{5,})\/?$/);
  return {
    title: String(name).trim(),
    source_url: String(url),
    external_id: idMatch ? idMatch[1] : String(url),
    price,
    location: node.areaServed || node.address?.addressLocality || null,
    description: node.description ? String(node.description).slice(0, 500) : null,
  };
}

// ---- HTML anchor fallback ----
// Listing detail pages live at /Business-Opportunity/<slug>/<id>/. We find those
// anchors, dedupe by id, and read nearby text for title/price.
function extractFromHtml($) {
  const out = [];
  const seen = new Set();
  $('a[href*="/Business-Opportunity/"], a[href*="/business-opportunity/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const idMatch = href.match(/\/(\d{5,})\/?$/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (seen.has(id)) return;

    // Walk up to a container that likely holds the price + location text
    const container = $(el).closest('article, li, div');
    const blockText = (container.text() || $(el).text()).replace(/\s+/g, ' ').trim();
    const title = ($(el).text() || '').replace(/\s+/g, ' ').trim();
    if (!title) return;

    seen.add(id);
    out.push({
      title: title.slice(0, 200),
      source_url: href.startsWith('http') ? href : `https://www.bizbuysell.com${href}`,
      external_id: id,
      price: parseMoney(blockText),
      location: null,
      description: null,
    });
  });
  return out;
}

async function fetchPage(url, fetch) {
  const wrapped = viaScraperApi(url);
  if (!wrapped) throw new Error('SCRAPERAPI_KEY not set');
  const res = await fetch(wrapped, { headers: { 'User-Agent': UA, 'Accept': 'text/html' }, timeout: 70000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function scrapeBusinesses() {
  return runTrackedJob('businesses', STATE, async () => {
    const fetch = (await import('node-fetch')).default;
    const cheerio = await import('cheerio');

    let listingsFound = 0;
    let newListings = 0;

    for (let page = 1; page <= MAX_PAGES; page++) {
      let html;
      try {
        html = await fetchPage(pageUrl(page), fetch);
      } catch (err) {
        console.error(`[businesses] page ${page} fetch failed:`, err.message);
        break;
      }
      const $ = cheerio.load(html);

      // Prefer JSON-LD; fall back to HTML anchors
      let records = extractFromJsonLd($);
      if (records.length === 0) records = extractFromHtml($);

      let keptThisPage = 0;
      for (const r of records) {
        // Filter to cheap ones; keep null-price out (can't confirm under ceiling)
        if (r.price === null || r.price > PRICE_CEILING || r.price <= 0) continue;
        listingsFound++;
        keptThisPage++;
        const isNew = await upsertBusiness({
          source: 'bizbuysell',
          state: STATE,
          category: 'established',
          ...r,
        });
        if (isNew) newListings++;
      }
      console.log(`[businesses] page ${page}: ${records.length} parsed, ${keptThisPage} under $${PRICE_CEILING}`);

      await new Promise(r => setTimeout(r, 1500));
    }

    return { listingsFound, newListings };
  });
}

// Diagnostic: report what the first GA page actually contains, so we can tune
// selectors after deploy without guessing.
async function debugBusinesses() {
  const fetch = (await import('node-fetch')).default;
  const cheerio = await import('cheerio');
  const report = {};
  try {
    const html = await fetchPage(pageUrl(1), fetch);
    const $ = cheerio.load(html);
    report.status = 'ok';
    report.htmlLength = html.length;
    report.jsonLdBlocks = $('script[type="application/ld+json"]').length;
    report.jsonLdRecords = extractFromJsonLd($).length;
    report.businessOpportunityAnchors = $('a[href*="/Business-Opportunity/"], a[href*="/business-opportunity/"]').length;
    report.htmlRecords = extractFromHtml($).length;
    // sample a few hrefs to see the real detail-URL pattern
    const hrefs = [];
    $('a[href]').each((_, el) => {
      const h = $(el).attr('href') || '';
      if (/\/\d{5,}\/?$/.test(h) && hrefs.length < 8) hrefs.push(h);
    });
    report.sampleListingHrefs = hrefs;
    const jsonLd = extractFromJsonLd($);
    const htmlRecs = extractFromHtml($);
    report.sampleRecord = (jsonLd[0] || htmlRecs[0]) || null;
  } catch (err) {
    report.status = 'error';
    report.error = err.message;
  }
  return report;
}

module.exports = { scrapeBusinesses, debugBusinesses };
