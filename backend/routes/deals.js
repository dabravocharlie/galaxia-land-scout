// routes/deals.js
// Deal pipeline: a unified board of opportunities across all asset types.
// Exposes CRUD for the dashboard, and exports helper functions Minerva uses
// to add/move/list deals on the owner's behalf.

const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const STAGES = ['interested', 'researching', 'contacted', 'offer', 'closed', 'passed'];

// ---- shared helpers (also imported by Minerva) ----

async function listDeals() {
  const result = await pool.query('SELECT * FROM deals ORDER BY updated_at DESC');
  return result.rows;
}

async function addDeal({ title, deal_type, amount, link, notes, stage }) {
  if (!title || !title.trim()) throw new Error('Deal title is required');
  const s = STAGES.includes(stage) ? stage : 'interested';
  const result = await pool.query(
    `INSERT INTO deals (title, deal_type, stage, amount, link, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title.trim(), deal_type || 'other', s, amount || null, link || null, notes || null]
  );
  return result.rows[0];
}

// Move a deal to a new stage. Accepts a deal id, or fuzzy-matches a title.
async function moveDeal({ id, title, stage }) {
  if (!STAGES.includes(stage)) throw new Error(`Invalid stage. Use one of: ${STAGES.join(', ')}`);
  let dealId = id;
  if (!dealId && title) {
    const found = await pool.query(
      `SELECT id FROM deals WHERE title ILIKE $1 ORDER BY updated_at DESC LIMIT 1`,
      [`%${title}%`]
    );
    if (found.rows.length === 0) throw new Error(`No deal found matching "${title}"`);
    dealId = found.rows[0].id;
  }
  if (!dealId) throw new Error('Need a deal id or title to move');
  const result = await pool.query(
    `UPDATE deals SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [stage, dealId]
  );
  if (result.rows.length === 0) throw new Error('Deal not found');
  return result.rows[0];
}

// ---- HTTP routes ----

router.get('/', async (req, res) => {
  try {
    res.json(await listDeals());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

router.post('/', async (req, res) => {
  try {
    const deal = await addDeal(req.body);
    res.json(deal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { stage, title, deal_type, amount, link, notes } = req.body;
    const updates = [];
    const values = [];
    let i = 1;
    if (stage !== undefined) {
      if (!STAGES.includes(stage)) return res.status(400).json({ error: 'Invalid stage' });
      updates.push(`stage = $${i++}`); values.push(stage);
    }
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
    if (deal_type !== undefined) { updates.push(`deal_type = $${i++}`); values.push(deal_type); }
    if (amount !== undefined) { updates.push(`amount = $${i++}`); values.push(amount); }
    if (link !== undefined) { updates.push(`link = $${i++}`); values.push(link); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE deals SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Deal not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM deals WHERE id = $1', [req.params.id]);
    res.json({ removed: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

module.exports = router;
module.exports.listDeals = listDeals;
module.exports.addDeal = addDeal;
module.exports.moveDeal = moveDeal;
module.exports.STAGES = STAGES;
