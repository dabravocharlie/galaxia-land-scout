// routes/minerva.js
// Minerva — the manager bot. Pulls a snapshot across all three modules (land,
// tech, businesses), hands it to Claude with the user's question, and returns a
// synthesized, conversational answer. Reuses ANTHROPIC_API_KEY.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');
const { listDeals, addDeal, moveDeal, STAGES } = require('./deals');
const { buildPerformance } = require('./performance');
const { listEvents, addEvent } = require('./events');
const { listNotes, addNote } = require('./notes');

// --- watchlist helpers (Minerva manages which tickers are tracked) ---
async function addToWatchlist(ticker, note) {
  const t = (ticker || '').toUpperCase().trim();
  if (!t || t.length > 10 || !/^[A-Z.\-]+$/.test(t)) throw new Error('Invalid ticker');
  const r = await pool.query(
    `INSERT INTO watchlist (ticker, note) VALUES ($1, $2)
     ON CONFLICT (ticker) DO UPDATE SET note = COALESCE(EXCLUDED.note, watchlist.note)
     RETURNING ticker`,
    [t, note || null]
  );
  return r.rows[0].ticker;
}

async function removeFromWatchlist(ticker) {
  const t = (ticker || '').toUpperCase().trim();
  if (!t) throw new Error('No ticker given');
  const r = await pool.query('DELETE FROM watchlist WHERE ticker = $1 RETURNING ticker', [t]);
  await pool.query('DELETE FROM watchlist_news WHERE ticker = $1', [t]);
  if (r.rows.length === 0) throw new Error(`${t} wasn't in the watchlist`);
  return t;
}

const MODEL = 'claude-sonnet-4-6';

// Build a compact, actionable snapshot of the whole command center. We pull
// recent + cheapest + flagged items from each module rather than everything,
// so Minerva stays fast and focused as the data grows.
async function buildSnapshot() {
  const snapshot = {};

  // --- Land --- (3-month window, weighted to cheap + recent)
  const landStats = await pool.query(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'new') AS new_count,
      COUNT(*) FILTER (WHERE price < 1000) AS under_1k,
      COUNT(*) FILTER (WHERE date_found >= NOW() - INTERVAL '7 days') AS new_this_week,
      COUNT(*) FILTER (WHERE date_found >= NOW() - INTERVAL '90 days') AS last_90_days
    FROM listings
  `);
  // All genuinely cheap finds over the last 3 months (the treasures)
  const landCheapest = await pool.query(`
    SELECT title, state, county, price, acreage, source, source_url, date_found
    FROM listings
    WHERE price IS NOT NULL AND price > 0
      AND date_found >= NOW() - INTERVAL '90 days'
    ORDER BY price ASC
    LIMIT 60
  `);
  // A generous sample of recent listings across all prices
  const landRecent = await pool.query(`
    SELECT title, state, county, price, source, date_found
    FROM listings
    WHERE date_found >= NOW() - INTERVAL '90 days'
    ORDER BY date_found DESC
    LIMIT 40
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

  // --- Tech stocks --- (3-month window)
  const techStats = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'new') AS new_count,
           COUNT(*) FILTER (WHERE status = 'watching') AS watching_count,
           COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '90 days') AS last_90_days
    FROM tech_stocks
  `);
  const techRecent = await pool.query(`
    SELECT ticker, company, category, reason, status, last_seen_at
    FROM tech_stocks
    WHERE last_seen_at >= NOW() - INTERVAL '90 days'
    ORDER BY last_seen_at DESC
    LIMIT 60
  `);
  snapshot.tech = { stats: techStats.rows[0], recent: techRecent.rows };

  // --- Businesses --- (3-month window, weighted to cheap)
  const bizStats = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'new') AS new_count,
           COUNT(*) FILTER (WHERE price < 25000) AS under_25k,
           COUNT(*) FILTER (WHERE date_found >= NOW() - INTERVAL '90 days') AS last_90_days
    FROM businesses
  `);
  const bizCheapest = await pool.query(`
    SELECT title, location, price, cash_flow, source_url, date_found
    FROM businesses
    WHERE price IS NOT NULL AND price > 0
      AND date_found >= NOW() - INTERVAL '90 days'
    ORDER BY price ASC
    LIMIT 50
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

  // --- Deal pipeline ---
  const deals = await listDeals();
  snapshot.pipeline = {
    total: deals.length,
    by_stage: deals.reduce((acc, d) => { acc[d.stage] = (acc[d.stage] || 0) + 1; return acc; }, {}),
    deals: deals.slice(0, 30),
  };

  // --- Portfolio performance (live gain/loss) ---
  try {
    const perf = await buildPerformance();
    snapshot.performance = {
      totals: perf.totals,
      holdings: perf.holdings.filter(h => h.has_position).map(h => ({
        ticker: h.ticker, shares: h.shares, avg_cost: h.avg_cost, price: h.price,
        gain: h.gain, gain_pct: h.gain_pct, dividends: h.dividends_received,
      })),
    };
  } catch {
    snapshot.performance = { error: 'unavailable' };
  }

  // --- Calendar (upcoming deadlines) ---
  try {
    const events = await listEvents({ upcomingOnly: true });
    snapshot.calendar = { upcoming: events.slice(0, 30) };
  } catch {
    snapshot.calendar = { upcoming: [] };
  }

  // --- Notes / drafts (titles + categories, not full bodies, to stay light) ---
  try {
    const notes = await listNotes();
    snapshot.notes = notes.slice(0, 30).map(n => ({
      id: n.id, title: n.title, category: n.category, updated_at: n.updated_at,
    }));
  } catch {
    snapshot.notes = [];
  }

  return snapshot;
}

function systemPrompt(snapshot) {
  return `You are Minerva, the manager and analyst for Galaxia Investment's automated research command center. You oversee these intelligence modules:
  - LAND SCOUT: cheap land/property listings across GA/AL/MS (Craigslist) + a Georgia county tax-sale tracker
  - TECH STOCKS: notable technology stocks surfaced weekly
  - BUSINESSES: cheap businesses for sale in Georgia (under $50k, from BizBuySell)
  - PORTFOLIO: the owner's own stock watchlist/holdings with the latest news on each, plus live PERFORMANCE (cost basis, current value, gain/loss, dividends) for holdings where he's entered share counts
  - DEAL PIPELINE: a board of opportunities he's actively working, each at a stage (interested, researching, contacted, offer, closed, passed)
  - CALENDAR: upcoming deadlines and reminders (tax-sale dates, auction closes, earnings, his own reminders)
  - NOTES: saved drafts and research — including email inquiries, letters of intent (LOIs), and non-binding offers

You can add calendar events/deadlines with the add_event tool when he asks you to remember a date or set a reminder ("remind me the Fulton tax sale is March 4"). Read back the date you're recording.

You can save notes and drafts with the save_note tool. When he asks you to DRAFT an email inquiry, a letter of intent (LOI), or a non-binding offer for a deal, write the full draft and save it via save_note (category 'email', 'loi', or 'offer'), then tell him it's saved to his Notes tab to review and send himself. IMPORTANT LIMITS on drafting: you may draft email inquiries, LOIs, and NON-BINDING offers only. You must NOT draft binding contracts, purchase-and-sale agreements, or any document meant to be legally executed — if he asks for one, explain that a binding contract should be prepared or reviewed by a Georgia real-estate attorney, and offer to draft a non-binding LOI or offer instead. You are not a lawyer; even the LOIs/offers you draft are starting points he should have reviewed before sending anything significant.

You can manage the deal pipeline for him. When he asks you to add a deal, track something, move a deal to a different stage, or mark something closed or passed, use the add_deal or move_deal tools. After doing so, confirm briefly what you did. When he refers to an item from the modules (like "the cheapest business" or "that Macon parcel"), use the title and details from the snapshot data to create the deal.

You can also manage his portfolio watchlist. When he asks to add a stock/ticker to his portfolio or watchlist, use add_to_watchlist; when he asks to remove or drop one, use remove_from_watchlist. Always read back the exact ticker you're adding or removing so any mishearing is obvious (e.g. "Adding N-V-D-A, NVIDIA, to your watchlist — done"). He enters share counts and cost basis himself in the Performance tab, so after adding a ticker, remind him of that briefly.

You speak to the owner (Bravo Charlie) directly, like a sharp, trusted analyst giving a briefing. Be concise and conversational — this may be read aloud by a voice system, so avoid tables, markdown headers, bullet symbols, and long URLs. Use natural spoken phrasing and short paragraphs. Lead with what's most worth his attention.

When he asks what's worth looking at, prioritize: genuinely cheap finds, new items since last week, pending county tax-sale alerts, and tech names with strong catalysts. Give specific numbers and names. If something looks like a standout deal, say so and say why. If a module is quiet, say so briefly. Don't invent listings — only reference what's in the data provided.

You also have a web search tool. Use it when the owner asks about something NOT covered by the module data — for example a specific stock ticker that wasn't in the discovery list, current market news, what a particular company does, or how a deal compares to the wider market. When you search, fold the findings into a short spoken-friendly answer and make clear it's from current web info rather than the in-house modules. For questions the module data already answers, don't search — just answer from the snapshot.

DUE-DILIGENCE MODE: When the owner asks you to "analyze", "run due diligence", "do a deep dive", "vet", or "research" a SPECIFIC item (a particular land parcel, a business for sale, or a stock), switch into a thorough diligence pass. Use multiple web searches to investigate, then give a structured report with these parts, spoken-friendly and clearly sectioned in plain prose (no markdown symbols):
- Snapshot: what it is, the asking price/key numbers.
- Key findings: the most important facts you found.
- Red flags: anything concerning, missing, or that doesn't add up. Be skeptical — your job here is to protect the owner from a bad deal.
- What to verify: concrete things he should personally confirm before committing (you can't see everything).
- Bottom line: your honest read on whether it looks worth pursuing, and why. Don't be a cheerleader; if it looks weak, say so.

Tailor the diligence to the asset type:
- LAND/PARCEL: zoning and permitted use, flood zone, road/legal access (is it landlocked?), utilities availability, back-taxes or liens, buildability, and what comparable parcels sell for. Sub-$1,000 tax-deed parcels especially often have hidden problems — investigate hard.
- BUSINESS: why it's really being sold, reputation and reviews, asking price vs. apparent revenue/cash flow, lease or location risk, owner-dependence, and online footprint. Be alert to inflated claims.
- STOCK: business model, recent financials and valuation, analyst sentiment, recent filings or news, dividend sustainability if income-focused, and the bull vs. bear case.
You are not a licensed financial, legal, or real-estate advisor — note that this is research to inform his own decision, not professional advice, when giving a diligence verdict.

Here is the current command-center data (JSON snapshot). It now covers roughly the LAST 3 MONTHS: your portfolio, deals, and performance in full, plus the cheapest and most recent land/business/tech finds over that window with summary stats showing totals. When he asks about trends or "what have we seen lately," you can speak to the 3-month picture, but note you're seeing the standout and recent items plus totals, not literally every single listing.

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

    // Cross-session memory: pull the recent conversation from the database so
    // Minerva remembers prior chats even after the browser is closed. We load
    // the last ~16 turns (8 exchanges) in chronological order.
    let priorTurns = [];
    try {
      const hist = await pool.query(
        `SELECT role, content FROM (
           SELECT id, role, content FROM conversations ORDER BY id DESC LIMIT 16
         ) sub ORDER BY id ASC`
      );
      priorTurns = hist.rows;
    } catch {
      priorTurns = [];
    }

    // Build messages: DB history + the new question. (We prefer DB history for
    // durable memory; the frontend no longer needs to send its own.)
    const messages = [];
    for (const h of priorTurns) {
      if ((h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: 'user', content: question });

    // A deep-dive/diligence request needs more searches and a longer answer
    // than a normal quick briefing. Detect it and scale the limits accordingly.
    const diligenceMode = /\b(analy[sz]e|due diligence|deep dive|deep-dive|vet|research|investigate|dig into|look into|scrutin)/i.test(question);
    const maxTokens = diligenceMode ? 3000 : 1500;
    const maxSearches = diligenceMode ? 10 : 4;

    // Tools Minerva can use: web search (server-side) + pipeline management
    // (custom tools we execute here).
    const tools = [
      { type: 'web_search_20250305', name: 'web_search', max_uses: maxSearches },
      {
        name: 'add_deal',
        description: 'Add a new opportunity to the deal pipeline board.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short name for the deal' },
            deal_type: { type: 'string', enum: ['land', 'business', 'stock', 'other'] },
            amount: { type: 'number', description: 'Asking price or deal size if known' },
            link: { type: 'string', description: 'Source URL if available' },
            stage: { type: 'string', enum: STAGES, description: 'Starting stage (default interested)' },
            notes: { type: 'string' },
          },
          required: ['title'],
        },
      },
      {
        name: 'move_deal',
        description: 'Move an existing deal to a different pipeline stage. Identify the deal by title (fuzzy match) or id.',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Title (or part of it) of the deal to move' },
            id: { type: 'number', description: 'Deal id, if known' },
            stage: { type: 'string', enum: STAGES, description: 'New stage' },
          },
          required: ['stage'],
        },
      },
      {
        name: 'add_to_watchlist',
        description: "Add a stock ticker to the owner's portfolio watchlist so it's tracked for news and performance. He'll enter share counts and cost himself in the Performance tab.",
        input_schema: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol, e.g. NVDA' },
            note: { type: 'string', description: 'Optional label, e.g. "monthly dividend"' },
          },
          required: ['ticker'],
        },
      },
      {
        name: 'remove_from_watchlist',
        description: "Remove a stock ticker from the owner's portfolio watchlist (also clears its news and position).",
        input_schema: {
          type: 'object',
          properties: {
            ticker: { type: 'string', description: 'Stock ticker symbol to remove' },
          },
          required: ['ticker'],
        },
      },
      {
        name: 'add_event',
        description: "Add a deadline or reminder to the owner's calendar (tax-sale date, auction close, earnings, or a personal reminder).",
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'What the event/deadline is' },
            event_date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
            event_type: { type: 'string', enum: ['tax_sale', 'auction', 'earnings', 'reminder', 'other'] },
            notes: { type: 'string' },
          },
          required: ['title', 'event_date'],
        },
      },
      {
        name: 'save_note',
        description: "Save a note or draft to the owner's Notes tab. Use for drafting email inquiries, letters of intent (LOIs), and NON-BINDING offers, or saving research. Never use for binding contracts.",
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Short title for the note/draft' },
            body: { type: 'string', description: 'The full text of the note or draft' },
            category: { type: 'string', enum: ['email', 'loi', 'offer', 'research', 'note'] },
          },
          required: ['title', 'body'],
        },
      },
    ];

    const fetch = (await import('node-fetch')).default;

    async function callApi(msgs) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        timeout: 120000,
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system: systemPrompt(snapshot),
          tools,
          messages: msgs,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        throw new Error(`Anthropic HTTP ${resp.status}: ${body.slice(0, 200)}`);
      }
      return resp.json();
    }

    // Execute one of our custom pipeline tools, returning a result string.
    async function runTool(name, input) {
      try {
        if (name === 'add_deal') {
          const d = await addDeal(input);
          return `Added "${d.title}" to the pipeline at stage "${d.stage}".`;
        }
        if (name === 'move_deal') {
          const d = await moveDeal(input);
          return `Moved "${d.title}" to stage "${d.stage}".`;
        }
        if (name === 'add_to_watchlist') {
          const t = await addToWatchlist(input.ticker, input.note);
          return `Added ${t} to the portfolio watchlist. News will populate on the next run; enter shares and cost in the Performance tab to track gain/loss.`;
        }
        if (name === 'remove_from_watchlist') {
          const t = await removeFromWatchlist(input.ticker);
          return `Removed ${t} from the portfolio watchlist.`;
        }
        if (name === 'add_event') {
          const e = await addEvent(input);
          return `Added "${e.title}" to the calendar for ${e.event_date}.`;
        }
        if (name === 'save_note') {
          const n = await addNote(input);
          return `Saved "${n.title}" (${n.category}) to the Notes tab.`;
        }
        return `Unknown tool: ${name}`;
      } catch (e) {
        return `Tool error: ${e.message}`;
      }
    }

    // Tool-use loop: keep calling until Claude stops requesting our tools.
    // (web_search is server-side and resolves within a single response.)
    let data = await callApi(messages);
    let guard = 0;
    while (data.stop_reason === 'tool_use' && guard < 5) {
      guard++;
      const toolUses = (data.content || []).filter(b => b.type === 'tool_use');
      const customUses = toolUses.filter(b =>
        b.name === 'add_deal' || b.name === 'move_deal' ||
        b.name === 'add_to_watchlist' || b.name === 'remove_from_watchlist' ||
        b.name === 'add_event' || b.name === 'save_note');
      // If the only tool calls are server-side (web_search), nothing for us to do.
      if (customUses.length === 0) break;

      messages.push({ role: 'assistant', content: data.content });
      const toolResults = [];
      for (const tu of customUses) {
        const out = await runTool(tu.name, tu.input || {});
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: out });
      }
      messages.push({ role: 'user', content: toolResults });
      data = await callApi(messages);
    }

    let answer = '';
    for (const block of data.content || []) {
      if (block.type === 'text') answer += block.text;
    }
    answer = answer.trim() || "I couldn't pull that together just now — try asking again.";

    // Persist this turn for cross-session memory.
    try {
      await pool.query(
        `INSERT INTO conversations (role, content) VALUES ('user', $1), ('assistant', $2)`,
        [question, answer]
      );
      // Keep the table from growing unbounded — retain the most recent 200 turns.
      await pool.query(
        `DELETE FROM conversations WHERE id < (
           SELECT MIN(id) FROM (SELECT id FROM conversations ORDER BY id DESC LIMIT 200) t
         )`
      );
    } catch (e) {
      console.error('[minerva] failed to persist conversation:', e.message);
    }

    res.json({ answer });
  } catch (err) {
    console.error('Minerva error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
