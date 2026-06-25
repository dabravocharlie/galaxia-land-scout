// jobs/portfolio.js
// Fetches a short AI news summary for each watchlist ticker using the Anthropic
// API + web search, and stores one current row per ticker in watchlist_news.
// Same pattern as the tech discovery job. Requires ANTHROPIC_API_KEY.

const { runTrackedJob } = require('./jobHelpers');
const { pool } = require('../db/pool');

const MODEL = 'claude-sonnet-4-6';

function buildPrompt(tickers) {
  return `You are a portfolio news analyst. For EACH of these tickers, use web search to find the most important, recent news (last 1-2 weeks) and write a 1-2 sentence plain summary an investor would care about. Tickers: ${tickers.join(', ')}.

Respond with ONLY a JSON array, no prose, no markdown fences. One element per ticker:
{
  "ticker": "SYMBOL",
  "summary": "1-2 sentence summary of the most relevant recent news. If genuinely nothing notable, say 'No major news this period.'",
  "sentiment": "positive" | "neutral" | "negative"
}`;
}

function parseArray(text) {
  if (!text) return [];
  let t = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = t.indexOf('['); const e = t.lastIndexOf(']');
  if (s === -1 || e === -1 || e <= s) return [];
  try { const a = JSON.parse(t.slice(s, e + 1)); return Array.isArray(a) ? a : []; }
  catch { return []; }
}

async function callAnthropic(fetch, tickers) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    timeout: 120000,
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: buildPrompt(tickers) }],
    }),
  });
  if (!res.ok) {
    const b = await res.text().catch(() => '');
    throw new Error(`Anthropic HTTP ${res.status}: ${b.slice(0, 200)}`);
  }
  const data = await res.json();
  let text = '', firstUrl = null;
  for (const block of data.content || []) {
    if (block.type === 'text') {
      text += block.text;
      for (const c of block.citations || []) if (!firstUrl && c.url) firstUrl = c.url;
    }
  }
  return { text, firstUrl };
}

async function refreshPortfolioNews() {
  return runTrackedJob('portfolio', null, async () => {
    const fetch = (await import('node-fetch')).default;

    const wl = await pool.query('SELECT ticker FROM watchlist ORDER BY ticker');
    const tickers = wl.rows.map(r => r.ticker);
    if (tickers.length === 0) return { listingsFound: 0, newListings: 0 };

    const { text, firstUrl } = await callAnthropic(fetch, tickers);
    const items = parseArray(text);
    console.log(`[portfolio] got ${items.length} summaries for ${tickers.length} tickers`);

    let listingsFound = 0, newListings = 0;
    for (const it of items) {
      const ticker = (it.ticker || '').toUpperCase().trim();
      if (!ticker) continue;
      const r = await pool.query(
        `INSERT INTO watchlist_news (ticker, summary, sentiment, source_url)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (ticker) DO UPDATE SET
           summary = EXCLUDED.summary,
           sentiment = EXCLUDED.sentiment,
           source_url = COALESCE(EXCLUDED.source_url, watchlist_news.source_url),
           updated_at = NOW(),
           emailed = FALSE
         RETURNING (xmax = 0) AS inserted`,
        [ticker, it.summary || null, it.sentiment || 'neutral', it.source_url || firstUrl || null]
      );
      listingsFound++;
      if (r.rows[0].inserted) newListings++;
    }
    return { listingsFound, newListings };
  });
}

module.exports = { refreshPortfolioNews };
