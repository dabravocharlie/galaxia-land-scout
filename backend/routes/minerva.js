// routes/minerva.js
// Minerva — the manager bot. Pulls a snapshot across all three modules (land,
// tech, businesses), hands it to Claude with the user's question, and returns a
// synthesized, conversational answer. Reuses ANTHROPIC_API_KEY.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const MODEL = 'claude-sonnet-4-6';

// Build a compact, actionable snapshot of the whole command center. We pull
// recent + cheapest + flagged items from each module rather than everything,
// so Minerva stays fast and focused as the data grows.
async function buildSnapshot() {
  const snapshot = {};

  // --- Land ---
  const landStats = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'new') AS new_count,
      COUNT(*) FILTER (WHERE price < 1000) AS under_1k,
      COUNT(*) FILTER (WHERE date_found >= NOW() - INTERVAL '7 days') AS new_this_week
    FROM listings
  `);
  const landCheapest = await pool.query(`
    SELECT title, state, county, price, acreage, source, source_url, date_found
    FROM listings
    WHERE price IS NOT NULL AND price > 0
    ORDER BY price ASC
    LIMIT 15
  `);
  const landRecent = await pool.query(`
    SELECT title, state, county, price, source, date_found
    FROM listings
    ORDER BY date_found DESC
    LIMIT 10
  `);
  snapshot.land = { stats: landStats.rows[0], cheapest: landCheapest.rows, recent: landRecent.rows };

  // --- County tax-sale tracker ---
  const counties = await pool.query(`
    SELECT county, state, alert_pending, last_changed_at, change_count
    FROM county_watch
    ORDER BY alert_pending DESC, last_changed_at DESC NULLS LAST
  `);
  snapshot.counties = {
    total: counties.rows.length,
    pending_alerts: counties.rows.filter(c => c.alert_pending).length,
    rows: counties.rows.slice(0, 20),
  };

  // --- Tech stocks ---
  const techStats = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'new') AS new_count,
           COUNT(*) FILTER (WHERE status = 'watching') AS watching_count
    FROM tech_stocks
  `);
  const techRecent = await pool.query(`
    SELECT ticker, company, category, reason, status, last_seen_at
    FROM tech_stocks
    ORDER BY last_seen_at DESC
    LIMIT 20
  `);
  snapshot.tech = { stats: techStats.rows[0], recent: techRecent.rows };

  // --- Businesses ---
  const bizStats = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'new') AS new_count,
           COUNT(*) FILTER (WHERE price < 25000) AS under_25k
    FROM businesses
  `);
  const bizCheapest = await pool.query(`
    SELECT title, location, price, cash_flow, source_url, date_found
    FROM businesses
    WHERE price IS NOT NULL AND price > 0
    ORDER BY price ASC
    LIMIT 15
  `);
  snapshot.businesses = { stats: bizStats.rows[0], cheapest: bizCheapest.rows };

  // --- Portfolio (watchlist holdings + latest news) ---
  const portfolio = await pool.query(`
    SELECT w.ticker, w.note, n.summary, n.sentiment, n.updated_at
    FROM watchlist w
    LEFT JOIN watchlist_news n ON n.ticker = w.ticker
    ORDER BY w.ticker
  `);
  snapshot.portfolio = { holdings: portfolio.rows };

  return snapshot;
}

function systemPrompt(snapshot) {
  return `You are Minerva, the manager and analyst for Galaxia Investment's automated research command center. You oversee these intelligence modules:
  - LAND SCOUT: cheap land/property listings across GA/AL/MS (Craigslist) + a Georgia county tax-sale tracker
  - TECH STOCKS: notable technology stocks surfaced weekly
  - BUSINESSES: cheap businesses for sale in Georgia (under $50k, from BizBuySell)
  - PORTFOLIO: the owner's own stock watchlist/holdings with the latest news on each

You speak to the owner (Bravo Charlie) directly, like a sharp, trusted analyst giving a briefing. Be concise and conversational — this may be read aloud by a voice system, so avoid tables, markdown headers, bullet symbols, and long URLs. Use natural spoken phrasing and short paragraphs. Lead with what's most worth his attention.

When he asks what's worth looking at, prioritize: genuinely cheap finds, new items since last week, pending county tax-sale alerts, and tech names with strong catalysts. Give specific numbers and names. If something looks like a standout deal, say so and say why. If a module is quiet, say so briefly. Don't invent listings — only reference what's in the data provided.

You also have a web search tool. Use it when the owner asks about something NOT covered by the module data — for example a specific stock ticker that wasn't in the discovery list, current market news, what a particular company does, or how a deal compares to the wider market. When you search, fold the findings into a short spoken-friendly answer and make clear it's from current web info rather than the in-house modules. For questions the module data already answers, don't search — just answer from the snapshot.

Here is the current command-center data (JSON snapshot):

${JSON.stringify(snapshot)}

Answer the owner's question using only this data. Keep it brief and spoken-friendly.`;
}

// POST /api/minerva/ask  { question, history: [{role, content}] }
router.post('/ask', async (req, res) => {
  try {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

    const { question, history } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'No question provided' });
    }

    const snapshot = await buildSnapshot();

    // Build messages: prior turns (text only) + the new question
    const messages = [];
    if (Array.isArray(history)) {
      for (const h of history.slice(-8)) {
        if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: 'user', content: question });

    const fetch = (await import('node-fetch')).default;
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      timeout: 90000,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt(snapshot),
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
        messages,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      return res.status(502).json({ error: `Anthropic HTTP ${resp.status}: ${body.slice(0, 200)}` });
    }

    const data = await resp.json();
    let answer = '';
    for (const block of data.content || []) {
      if (block.type === 'text') answer += block.text;
    }
    answer = answer.trim() || "I couldn't pull that together just now — try asking again.";

    res.json({ answer });
  } catch (err) {
    console.error('Minerva error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
