// jobs/craigslist.js
// Scrapes Craigslist real-estate-for-sale listings across GA/AL/MS regional
// subdomains. Captures land, lots, houses, mobile/modular homes, and fixers
// in the cheap-investment range. Parses the static HTML link structure, which
// is more stable than Craigslist's frequently-changing CSS class names.

const { runTrackedJob, upsertListing } = require('./jobHelpers');

// Craigslist subdomains covering GA, AL, and MS (verified to resolve)
const REGIONS = {
  GA: [
    { subdomain: 'atlanta',    label: 'Atlanta' },
    { subdomain: 'macon',      label: 'Macon' },
    { subdomain: 'savannah',   label: 'Savannah' },
    { subdomain: 'brunswick',  label: 'Brunswick' },
    { subdomain: 'athensga',   label: 'Athens' },
    { subdomain: 'nwga',       label: 'NW Georgia' },
    { subdomain: 'columbusga', label: 'Columbus' },
    { subdomain: 'albanyga',   label: 'Albany' },
    { subdomain: 'valdosta',   label: 'Valdosta' },
    { subdomain: 'statesboro', label: 'Statesboro' },
  ],
  AL: [
    { subdomain: 'bham',        label: 'Birmingham' },   // Birmingham is bham, not birmingham
    { subdomain: 'huntsville',  label: 'Huntsville' },
    { subdomain: 'mobile',      label: 'Mobile' },
    { subdomain: 'montgomery',  label: 'Montgomery' },
    { subdomain: 'tuscaloosa',  label: 'Tuscaloosa' },
    { subdomain: 'auburn',      label: 'Auburn' },
    { subdomain: 'shoals',      label: 'Shoals' },
    { subdomain: 'dothan',      label: 'Dothan' },
    { subdomain: 'gadsden',     label: 'Gadsden' },
  ],
  MS: [
    { subdomain: 'gulfport',    label: 'Gulfport' },
    { subdomain: 'jackson',     label: 'Jackson' },
    { subdomain: 'hattiesburg', label: 'Hattiesburg' },
    { subdomain: 'meridian',    label: 'Meridian' },
    { subdomain: 'natchez',     label: 'Natchez' },
    { subdomain: 'northmiss',   label: 'North Mississippi' },
  ],
};

const PRICE_CEILING = 75000; // cheap-investment range; dashboard flags sub-$1,000

// Build the search URL. We search the broad real-estate-for-sale category (rea)
// sorted by newest, with our price ceiling applied server-side.
function buildSearchUrl(subdomain) {
  const params = new URLSearchParams({
    sort: 'date',
    max_price: PRICE_CEILING,
  });
  return `https://${subdomain}.craigslist.org/search/rea?${params.toString()}`;
}

// Parse the first dollar amount from a string. Returns null if none found.
function parsePrice(text) {
  if (!text) return null;
  const match = text.match(/\$([0-9][0-9,]*)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

// Extract acreage from a title like "5.2 acres", "10 ac", "0.5 acre lot"
function parseAcreage(title) {
  if (!title) return null;
  const match = title.match(/([0-9]+\.?[0-9]*)\s*(acres?|ac\b)/i);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return isNaN(num) ? null : num;
}

// Pull the 10+ digit Craigslist post ID out of a listing URL.
function parsePostId(url) {
  const match = url.match(/\/(\d{10,})\.html/);
  return match ? match[1] : null;
}

// Classify a listing into a rough type based on its title text.
function classifyListing(title) {
  const t = title.toLowerCase();
  if (/\b(acre|acres|ac\b|land|tract|parcel)\b/.test(t)) return 'land';
  if (/\b(lot|lots)\b/.test(t)) return 'lot';
  if (/\b(mobile home|modular|manufactured|doublewide|double wide|singlewide)\b/.test(t)) return 'mobile_home';
  return 'house';
}

// Decide whether to keep a listing. We loosened the filter to include houses
// and mobile homes, but still drop obvious junk and rentals.
function shouldKeep(title, price) {
  const t = title.toLowerCase();

  // Drop rentals — we only want things for sale
  if (/\bfor rent\b|\/mo\b|per month|monthly rent|rent\b.*\blot\b|lot for rent|rv.*lot for rent/.test(t)) {
    return false;
  }
  if (/\bapartment\b|\bapt\b/.test(t)) return false;

  // Drop teaser/junk posts with no real price ($0) — but keep legitimately cheap ones
  if (price === null) return false;
  if (price <= 0) return false;

  // Drop "thanks to all" type non-listings and obvious spam
  if (/thanks to all|iso |looking for|wanted:/.test(t)) return false;

  return true;
}

// Fetch and parse one region's search results page.
async function fetchRegionListings(subdomain, state) {
  const fetch = (await import('node-fetch')).default;
  const cheerio = await import('cheerio');

  const url = buildSearchUrl(subdomain);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    timeout: 20000,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const listings = [];
  const seenIds = new Set();

  // Robust approach: find every anchor whose href is a real listing detail
  // page (URL pattern .../d/.../<10-digit-id>.html). This survives Craigslist's
  // CSS class churn because the URL pattern is stable.
  $('a[href*="/d/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;

    const postId = parsePostId(href);
    if (!postId || seenIds.has(postId)) return;

    const titleText = $(el).text().trim();
    if (!titleText || titleText.length < 5) return;

    const price = parsePrice(titleText);
    if (!shouldKeep(titleText, price)) return;

    seenIds.add(postId);

    listings.push({
      source_url: href.startsWith('http') ? href : `https://${subdomain}.craigslist.org${href}`,
      external_id: postId,
      state,
      title: titleText,
      price,
      acreage: parseAcreage(titleText),
      listing_type: classifyListing(titleText),
    });
  });

  return listings;
}

async function scrapeCraigslist() {
  return runTrackedJob('craigslist', null, async () => {
    let listingsFound = 0;
    let newListings = 0;

    for (const [state, regions] of Object.entries(REGIONS)) {
      for (const region of regions) {
        try {
          console.log(`[craigslist] Fetching ${region.label}, ${state}...`);
          const results = await fetchRegionListings(region.subdomain, state);
          console.log(`[craigslist] ${region.label}: ${results.length} listings kept`);

          for (const listing of results) {
            listingsFound++;
            const isNew = await upsertListing({
              source: 'craigslist',
              county: region.label,
              ...listing,
            });
            if (isNew) newListings++;
          }

          await new Promise(r => setTimeout(r, 1500));
        } catch (err) {
          console.error(`[craigslist] Error fetching ${region.label}, ${state}:`, err.message);
        }
      }
    }

    return { listingsFound, newListings };
  });
}

module.exports = { scrapeCraigslist };
