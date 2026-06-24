// routes/listings.js
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

// GET /api/listings
// Query params: state, source, status, minPrice, maxPrice, listingType, limit, offset
router.get('/', async (req, res) => {
  try {
    const {
      state,
      source,
      status,
      listingType,
      minPrice,
      maxPrice,
      limit = 100,
      offset = 0,
      sortBy = 'date_found',
      sortDir = 'DESC'
    } = req.query;

    const conditions = [];
    const values = [];
    let i = 1;

    if (state) {
      conditions.push(`state = $${i++}`);
      values.push(state.toUpperCase());
    }
    if (source) {
      conditions.push(`source = $${i++}`);
      values.push(source);
    }
    if (status) {
      conditions.push(`status = $${i++}`);
      values.push(status);
    }
    if (listingType) {
      conditions.push(`listing_type = $${i++}`);
      values.push(listingType);
    }
    if (minPrice) {
      conditions.push(`price >= $${i++}`);
      values.push(minPrice);
    }
    if (maxPrice) {
      conditions.push(`price <= $${i++}`);
      values.push(maxPrice);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSortColumns = ['date_found', 'price', 'acreage', 'sale_date', 'state'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'date_found';
    const safeSortDir = sortDir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    values.push(limit, offset);
    const query = `
      SELECT * FROM listings
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortDir} NULLS LAST
      LIMIT $${i++} OFFSET $${i++}
    `;

    const countQuery = `SELECT COUNT(*) FROM listings ${whereClause}`;

    const [results, countResult] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, conditions.length))
    ]);

    res.json({
      listings: results.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });
  } catch (err) {
    console.error('Error fetching listings:', err);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM listings WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching listing:', err);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// PATCH /api/listings/:id
// Used by the dashboard to update status/notes (e.g. mark reviewed, flag, dismiss)
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes, flag_reason } = req.body;
    const updates = [];
    const values = [];
    let i = 1;

    if (status !== undefined) {
      updates.push(`status = $${i++}`);
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push(`notes = $${i++}`);
      values.push(notes);
    }
    if (flag_reason !== undefined) {
      updates.push(`flag_reason = $${i++}`);
      values.push(flag_reason);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);

    const query = `UPDATE listings SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`;
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating listing:', err);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// GET /api/listings/stats/summary
// Quick counts for dashboard header cards
router.get('/stats/summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'new') AS new_count,
        COUNT(*) FILTER (WHERE status = 'flagged') AS flagged_count,
        COUNT(*) FILTER (WHERE price < 1000) AS under_threshold_count,
        COUNT(*) FILTER (WHERE state = 'GA') AS ga_count,
        COUNT(*) FILTER (WHERE state = 'AL') AS al_count,
        COUNT(*) FILTER (WHERE state = 'MS') AS ms_count
      FROM listings
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
