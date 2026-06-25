// routes/businesses.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/businesses?status=&maxPrice=
router.get('/', async (req, res) => {
  try {
    const { status, maxPrice } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;
    if (status) { conditions.push(`status = $${i++}`); values.push(status); }
    if (maxPrice) { conditions.push(`price <= $${i++}`); values.push(maxPrice); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM businesses ${where}
       ORDER BY (status = 'new') DESC, (price IS NULL), price ASC
       LIMIT 200`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching businesses:', err);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// GET /api/businesses/stats/summary
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_count,
        COUNT(*) FILTER (WHERE status = 'watching') AS watching_count,
        COUNT(*) FILTER (WHERE price < 25000) AS under_25k_count
      FROM businesses
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching business stats:', err);
    res.status(500).json({ error: 'Failed to fetch business stats' });
  }
});

// PATCH /api/businesses/:id  { status, notes }
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (status !== undefined) { updates.push(`status = $${i++}`); values.push(status); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE businesses SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating business:', err);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

module.exports = router;
