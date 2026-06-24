// jobs/techDiscovery.js
// Discovers notable tech stocks each run using the Anthropic API with the
// web_search server tool. Asks for a mix of movers, upgrades, earnings
// standouts, and lesser-known emerging names — each with a one-line reason —
// then upserts them into tech_stocks (deduped by ticker).
//
// Requires ANTHROPIC_API_KEY env var. Without it, the job no-ops gracefully.

const { runTrackedJob } = require('./jobHelpers');
const { pool } = require('../db/pool');

const MODEL = 'claude-sonnet-4-6';

const PROMPT = `You are a tech-stock scout for an investment firm. Using web search, find 8-10 NOTABLE U.S.-listed technology stocks worth attention RIGHT NOW (this week).

Aim for a useful mix, not just mega-caps:
- A few well-known names with a clear catalyst this week (earnings, analyst upgrade/downgrade, major product or deal, big move)
- A few lesser-known / emerging / small- or mid-cap tech names that are getting attention for a concrete reason

For each, give a SHORT, specific, factual reason tied to something recent. Avoid generic filler like "strong company."

Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
{
  "ticker": "SYMBOL",
  "company": "Company Name",
  "category": "mover" | "upgrade" | "earnings" | "emerging" | "product" | "other",
  "reason": "One specific sentence on why it's notable this week."
}`;

// Pull the JSON array out of the model's text response, tolerating stray prose
// or code fences.
function parseStocks(text) {
  if (!text) return [];
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = t.indexOf('[');
  const end = t.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const arr = JSON.parse(t.slice(start, end + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function callAnthropic(fetch) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    timeout: 120000,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
      messages: [{ role: 'user', content: PROMPT }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  // Concatenate all text blocks (web search adds tool blocks we ignore here),
  // and collect any citation URLs to use as source links.
  let text = '';
  let firstUrl = null;
  for (const block of data.content || []) {
    if (block.type === 'text') {
      text += block.text;
      for (const c of block.citations || []) {
        if (!firstUrl && c.url) firstUrl = c.url;
      }
    }
  }
  return { text, firstUrl };
}

async function upsertStock(stock, fallbackUrl) {
  const ticker = (stock.ticker || '').toUpperCase().trim();
  if (!ticker || ticker.length > 10) return false;

  const result = await pool.query(
    `INSERT INTO tech_stocks (ticker, company, category, reason, source_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ticker) DO UPDATE SET
       company = COALESCE(EXCLUDED.company, tech_stocks.company),
       category = EXCLUDED.category,
       reason = EXCLUDED.reason,
       source_url = COALESCE(EXCLUDED.source_url, tech_stocks.source_url),
       last_seen_at = NOW(),
       times_seen = tech_stocks.times_seen + 1,
       emailed = FALSE
     RETURNING (xmax = 0) AS inserted`,
    [ticker, stock.company || null, stock.category || 'other',
     stock.reason || null, stock.source_url || fallbackUrl || null]
  );
  return result.rows[0].inserted;
}

async function discoverTechStocks() {
  return runTrackedJob('tech_discovery', null, async () => {
    const fetch = (await import('node-fetch')).default;

    const { text, firstUrl } = await callAnthropic(fetch);
    const stocks = parseStocks(text);
    console.log(`[tech] Discovery returned ${stocks.length} stocks`);

    let listingsFound = 0;
    let newListings = 0;
    for (const stock of stocks) {
      const isNew = await upsertStock(stock, firstUrl);
      listingsFound++;
      if (isNew) newListings++;
    }

    return { listingsFound, newListings };
  });
}

module.exports = { discoverTechStocks };
