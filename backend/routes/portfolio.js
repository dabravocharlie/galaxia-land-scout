// routes/portfolio.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/portfolio — watchlist joined with latest news
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.id, w.ticker, w.note, w.added_at,
             n.summary, n.sentiment, n.source_url, n.updated_at
      FROM watchlist w
      LEFT JOIN watchlist_news n ON n.ticker = w.ticker
      ORDER BY w.ticker
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

// POST /api/portfolio  { ticker, note }
router.post('/', async (req, res) => {
  try {
    const ticker = (req.body.ticker || '').toUpperCase().trim();
    const note = req.body.note || null;
    if (!ticker || ticker.length > 10 || !/^[A-Z.\-]+$/.test(ticker)) {
      return res.status(400).json({ error: 'Invalid ticker' });
    }
    const result = await pool.query(
      `INSERT INTO watchlist (ticker, note) VALUES ($1, $2)
       ON CONFLICT (ticker) DO UPDATE SET note = EXCLUDED.note
       RETURNING *`,
      [ticker, note]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding ticker:', err);
    res.status(500).json({ error: 'Failed to add ticker' });
  }
});

// DELETE /api/portfolio/:ticker
router.delete('/:ticker', async (req, res) => {
  try {
    const ticker = (req.params.ticker || '').toUpperCase().trim();
    await pool.query('DELETE FROM watchlist WHERE ticker = $1', [ticker]);
    await pool.query('DELETE FROM watchlist_news WHERE ticker = $1', [ticker]);
    res.json({ removed: ticker });
  } catch (err) {
    console.error('Error removing ticker:', err);
    res.status(500).json({ error: 'Failed to remove ticker' });
  }
});

module.exports = router;
