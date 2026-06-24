// routes/counties.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/counties
// Returns all watched counties with their status, newest changes first.
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, county, state, url, platform, content_snippet, pdf_links,
             last_checked_at, last_changed_at, change_count, alert_pending, last_error
      FROM county_watch
      ORDER BY alert_pending DESC, last_changed_at DESC NULLS LAST, county ASC
    `);
    // Parse pdf_links JSON for convenience
    const counties = result.rows.map(r => ({
      ...r,
      pdf_links: r.pdf_links ? JSON.parse(r.pdf_links) : []
    }));
    res.json(counties);
  } catch (err) {
    console.error('Error fetching counties:', err);
    res.status(500).json({ error: 'Failed to fetch counties' });
  }
});

// GET /api/counties/alerts
// Just the counties with a pending alert (changed since last review).
router.get('/alerts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, county, state, url, content_snippet, pdf_links, last_changed_at, change_count
      FROM county_watch
      WHERE alert_pending = TRUE
      ORDER BY last_changed_at DESC NULLS LAST
    `);
    const counties = result.rows.map(r => ({
      ...r,
      pdf_links: r.pdf_links ? JSON.parse(r.pdf_links) : []
    }));
    res.json(counties);
  } catch (err) {
    console.error('Error fetching county alerts:', err);
    res.status(500).json({ error: 'Failed to fetch county alerts' });
  }
});

// PATCH /api/counties/:id/reviewed
// Clears the alert_pending flag once you've manually reviewed the county.
router.patch('/:id/reviewed', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE county_watch SET alert_pending = FALSE WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'County not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error marking county reviewed:', err);
    res.status(500).json({ error: 'Failed to update county' });
  }
});

module.exports = router;
