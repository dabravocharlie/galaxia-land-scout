// jobs/retail.js
// Retail land listings scraper. Pulls cheap land from two aggregators:
//   - LandSearch (primary)  — real sub-$10k inventory + auctions
//   - LandWatch  (secondary)— larger marketplace, floor ~$13k, market context
//
// Both sites hard-block datacenter IPs (403 / anti-bot challenge) and render
// listings via JavaScript, so we route requests through ScraperAPI, which
// uses residential IPs and renders JS. Requires SCRAPERAPI_KEY env var.
// Without the key set, these jobs no-op gracefully.

const { runTrackedJob, upsertListing } = require('./jobHelpers');

const STATES = [
  { code: 'GA', slug: 'georgia' },
  { code: 'AL', slug: 'alabama' },
  { code: 'MS', slug: 'mississippi' },
];

const PRICE_CEILING = 50000; // retail "cheap" band; dashboard still flags sub-$1,000

// Wrap a target URL so it's fetched through ScraperAPI (residential IP + JS render).
// render=true makes ScraperAPI execute the page's JavaScript before returning HTML.
// ultra_premium=true is required for these "protected domains" (LandSearch/
// LandWatch) — premium alone bounces with a 500. Costs ~30 credits/request,
// so the scrapers keep page counts low to conserve the monthly credit budget.
function scraperApiUrl(targetUrl, { render = true } = {}) {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  const params = new URLSearchParams({
    api_key: key,
    url: targetUrl,
    render: render ? 'true' : 'false',
    ultra_premium: 'true',
  });
  return `https://api.scraperapi.com/?${params.toString()}`;
}

// Fetch a page through ScraperAPI. Returns HTML string, or null if no key.
async function fetchViaScraperApi(targetUrl, fetch) {
  const wrapped = scraperApiUrl(targetUrl);
  if (!wrapped) {
    throw new Error('SCRAPERAPI_KEY not set');
  }
  const res = await fetch(wrapped, { timeout: 70000 }); // ScraperAPI render can be slow
  if (!res.ok) {
    throw new Error(`ScraperAPI HTTP ${res.status}`);
  }
  return res.text();
}

// ---- shared parsing helpers ----

function parsePrice(text) {
  if (!text) return null;
  // Skip leases: anything with /mo or "min" (auction minimums handled separately)
  const m = text.match(/\$([0-9][0-9,]*)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function isLease(text) {
  if (!text) return false;
  return /\/mo\b|per month|monthly/i.test(text);
}

function parseAcreage(text) {
  if (!text) return null;
  const m = text.match(/([0-9]+\.?[0-9]*)\s*(acres?|ac\b)/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

// ---- LandSearch ----
// URL pattern: https://www.landsearch.com/properties/<state>/search/under-10000[/pN]
// Listing links look like /properties/<slug>/<numericId>

async function scrapeLandSearchState(state, fetch, cheerio) {
  const listings = [];
  const MAX_PAGES = 2; // keep low — premium ScraperAPI credits are limited on free tier

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1
      ? `https://www.landsearch.com/properties/${state.slug}/search/under-10000`
      : `https://www.landsearch.com/properties/${state.slug}/search/under-10000/p${page}`;

    let html;
    try {
      html = await fetchViaScraperApi(url, fetch);
    } catch (err) {
      console.error(`[landsearch] fetch failed (${state.code} p${page}):`, err.message);
      break;
    }

    const $ = cheerio.load(html);
    const seen = new Set();
    let pageCount = 0;

    // Each property links to /properties/<slug>/<id>. We dedup by id and read
    // the surrounding text block for price / acreage / county.
    $('a[href*="/properties/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const idMatch = href.match(/\/properties\/[^/]+\/(\d+)$/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;

      // The link text holds price + acreage + county on LandSearch cards
      const block = $(el).text().replace(/\s+/g, ' ').trim();
      if (!block) return;
      if (isLease(block)) return;               // skip leases
      const price = parsePrice(block);
      if (price === null || price <= 0) return; // skip "Auction $1,000 min" handled below

      seen.add(id);
      pageCount++;

      listings.push({
        source: 'landsearch',
        source_url: href.startsWith('http') ? href : `https://www.landsearch.com${href}`,
        external_id: id,
        state: state.code,
        title: block.slice(0, 200),
        price,
        acreage: parseAcreage(block),
        listing_type: 'retail',
      });
    });

    if (pageCount === 0) break; // no more results
    await new Promise(r => setTimeout(r, 1200));
  }

  return listings;
}

// ---- LandWatch ----
// URL pattern: https://www.landwatch.com/<state>-land-for-sale/price-under-49999[/page-N]
// Listing links look like /<county>-county-<state>-<type>-for-sale/pid/<numericId>

async function scrapeLandWatchState(state, fetch, cheerio) {
  const listings = [];
  const MAX_PAGES = 2; // keep low — premium ScraperAPI credits are limited on free tier

  for (let page = 1; page <= MAX_PAGES; page++) {
    const base = `https://www.landwatch.com/${state.slug}-land-for-sale/price-under-49999`;
    const url = page === 1 ? base : `${base}/page-${page}`;

    let html;
    try {
      html = await fetchViaScraperApi(url, fetch);
    } catch (err) {
      console.error(`[landwatch] fetch failed (${state.code} p${page}):`, err.message);
      break;
    }

    const $ = cheerio.load(html);
    const seen = new Set();
    let pageCount = 0;

    $('a[href*="/pid/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const idMatch = href.match(/\/pid\/(\d+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      if (seen.has(id)) return;

      const block = $(el).text().replace(/\s+/g, ' ').trim();
      if (!block) return;
      if (isLease(block)) return;
      const price = parsePrice(block);
      if (price === null || price <= 0) return;

      // Try to pull county from the URL slug (e.g. fannin-county-georgia-...)
      const countyMatch = href.match(/\/([a-z-]+)-county-/);
      const county = countyMatch
        ? countyMatch[1].split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
        : null;

      seen.add(id);
      pageCount++;

      listings.push({
        source: 'landwatch',
        source_url: href.startsWith('http') ? href : `https://www.landwatch.com${href}`,
        external_id: id,
        state: state.code,
        county,
        title: block.slice(0, 200),
        price,
        acreage: parseAcreage(block),
        listing_type: 'retail',
      });
    });

    if (pageCount === 0) break;
    await new Promise(r => setTimeout(r, 1500));
  }

  return listings;
}

async function scrapeLandSearch() {
  return runTrackedJob('landsearch', null, async () => {
    const fetch = (await import('node-fetch')).default;
    const cheerio = await import('cheerio');
    let listingsFound = 0, newListings = 0;

    for (const state of STATES) {
      try {
        console.log(`[landsearch] Fetching ${state.code}...`);
        const results = await scrapeLandSearchState(state, fetch, cheerio);
        console.log(`[landsearch] ${state.code}: ${results.length} listings`);
        for (const listing of results) {
          listingsFound++;
          const isNew = await upsertListing(listing);
          if (isNew) newListings++;
        }
      } catch (err) {
        console.error(`[landsearch] Error ${state.code}:`, err.message);
      }
    }
    return { listingsFound, newListings };
  });
}

async function scrapeLandWatch() {
  return runTrackedJob('landwatch', null, async () => {
    const fetch = (await import('node-fetch')).default;
    const cheerio = await import('cheerio');
    let listingsFound = 0, newListings = 0;

    for (const state of STATES) {
      try {
        console.log(`[landwatch] Fetching ${state.code}...`);
        const results = await scrapeLandWatchState(state, fetch, cheerio);
        console.log(`[landwatch] ${state.code}: ${results.length} listings`);
        for (const listing of results) {
          listingsFound++;
          const isNew = await upsertListing(listing);
          if (isNew) newListings++;
        }
      } catch (err) {
        console.error(`[landwatch] Error ${state.code}:`, err.message);
      }
    }
    return { listingsFound, newListings };
  });
}

// LandCom retired — Land.com redirects to LandWatch (same CoStar network).
// Kept as an alias so the scheduler/jobs route don't break.
async function scrapeLandCom() {
  return { listingsFound: 0, newListings: 0 };
}

module.exports = { scrapeLandWatch, scrapeLandCom, scrapeLandSearch };
