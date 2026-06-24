// routes/sources.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/sources/status
// Returns last run info per source, for the dashboard's "last checked" display
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (source)
        source,
        started_at,
        finished_at,
        status,
        listings_found,
        new_listings,
        error_message
      FROM scrape_runs
      ORDER BY source, started_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching source status:', err);
    res.status(500).json({ error: 'Failed to fetch source status' });
  }
});

// GET /api/sources/runs?source=govease&limit=20
// History of recent scrape runs, useful for debugging
router.get('/runs', async (req, res) => {
  try {
    const { source, limit = 20 } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;

    if (source) {
      conditions.push(`source = $${i++}`);
      values.push(source);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    values.push(limit);

    const result = await pool.query(
      `SELECT * FROM scrape_runs ${whereClause} ORDER BY started_at DESC LIMIT $${i}`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching scrape runs:', err);
    res.status(500).json({ error: 'Failed to fetch scrape runs' });
  }
});

module.exports = router;
