// routes/performance.js
// Portfolio performance: combines the watchlist positions (shares, cost,
// dividends) with live quotes from Finnhub to compute gain/loss per holding
// and across the whole portfolio. Also exposes endpoints to edit positions.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// Fetch current prices for a list of tickers from Finnhub.
// Returns a map { TICKER: price }. Missing/failed tickers are simply absent.
async function fetchQuotes(tickers) {
  const key = process.env.FINNHUB_API_KEY;
  const out = {};
  if (!key || tickers.length === 0) return out;
  const fetch = (await import('node-fetch')).default;

  for (const t of tickers) {
    try {
      const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(t)}&token=${key}`, { timeout: 12000 });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data.c === 'number' && data.c > 0) {
        out[t] = { price: data.c, changePct: data.dp };
      }
    } catch {
      // skip this ticker on error
    }
  }
  return out;
}

// Build the performance rows + totals.
async function buildPerformance() {
  const wl = await pool.query('SELECT * FROM watchlist ORDER BY ticker');
  const positions = wl.rows.filter(r => r.shares && Number(r.shares) > 0);
  const quotes = await fetchQuotes(positions.map(r => r.ticker));

  let totalCost = 0, totalValue = 0, totalDiv = 0;
  const holdings = wl.rows.map(r => {
    const shares = Number(r.shares) || 0;
    const avgCost = Number(r.avg_cost) || 0;
    const div = Number(r.dividends_received) || 0;
    const q = quotes[r.ticker];
    const price = q ? q.price : null;

    const costBasis = shares * avgCost;
    const marketValue = price !== null ? shares * price : null;
    const gain = marketValue !== null ? marketValue - costBasis : null;
    const gainPct = (gain !== null && costBasis > 0) ? (gain / costBasis) * 100 : null;
    const totalReturn = gain !== null ? gain + div : null;

    if (shares > 0) {
      totalCost += costBasis;
      if (marketValue !== null) totalValue += marketValue;
      totalDiv += div;
    }

    return {
      id: r.id, ticker: r.ticker, note: r.note,
      shares, avg_cost: avgCost, dividends_received: div, purchase_date: r.purchase_date,
      price, change_pct: q ? q.changePct : null,
      cost_basis: costBasis, market_value: marketValue,
      gain, gain_pct: gainPct, total_return: totalReturn,
      has_position: shares > 0,
      priced: price !== null,
    };
  });

  const totalGain = totalValue - totalCost;
  const totals = {
    cost: totalCost,
    value: totalValue,
    gain: totalGain,
    gain_pct: totalCost > 0 ? (totalGain / totalCost) * 100 : null,
    dividends: totalDiv,
    total_return: totalGain + totalDiv,
    priced: Object.keys(quotes).length,
    finnhub_configured: !!process.env.FINNHUB_API_KEY,
  };

  return { holdings, totals };
}

// GET /api/performance
router.get('/', async (req, res) => {
  try {
    res.json(await buildPerformance());
  } catch (err) {
    console.error('Performance error:', err);
    res.status(500).json({ error: 'Failed to build performance' });
  }
});

// PATCH /api/performance/:ticker — update position fields
router.patch('/:ticker', async (req, res) => {
  try {
    const ticker = (req.params.ticker || '').toUpperCase().trim();
    const { shares, avg_cost, dividends_received, purchase_date } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (shares !== undefined) { updates.push(`shares = $${i++}`); values.push(shares === '' ? null : shares); }
    if (avg_cost !== undefined) { updates.push(`avg_cost = $${i++}`); values.push(avg_cost === '' ? null : avg_cost); }
    if (dividends_received !== undefined) { updates.push(`dividends_received = $${i++}`); values.push(dividends_received === '' ? 0 : dividends_received); }
    if (purchase_date !== undefined) { updates.push(`purchase_date = $${i++}`); values.push(purchase_date || null); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(ticker);
    const result = await pool.query(
      `UPDATE watchlist SET ${updates.join(', ')} WHERE ticker = $${i} RETURNING *`, values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Ticker not found in watchlist' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating position:', err);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

module.exports = router;
module.exports.buildPerformance = buildPerformance;
