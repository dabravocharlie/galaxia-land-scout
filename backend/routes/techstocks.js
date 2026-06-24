// routes/techstocks.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/techstocks?status=&category=
router.get('/', async (req, res) => {
  try {
    const { status, category } = req.query;
    const conditions = [];
    const values = [];
    let i = 1;
    if (status) { conditions.push(`status = $${i++}`); values.push(status); }
    if (category) { conditions.push(`category = $${i++}`); values.push(category); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM tech_stocks ${where}
       ORDER BY (status = 'new') DESC, last_seen_at DESC
       LIMIT 200`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching tech stocks:', err);
    res.status(500).json({ error: 'Failed to fetch tech stocks' });
  }
});

// GET /api/techstocks/stats/summary
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_count,
        COUNT(*) FILTER (WHERE status = 'watching') AS watching_count
      FROM tech_stocks
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching tech stats:', err);
    res.status(500).json({ error: 'Failed to fetch tech stats' });
  }
});

// PATCH /api/techstocks/:id  { status, notes }
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
      `UPDATE tech_stocks SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating tech stock:', err);
    res.status(500).json({ error: 'Failed to update tech stock' });
  }
});

module.exports = router;
