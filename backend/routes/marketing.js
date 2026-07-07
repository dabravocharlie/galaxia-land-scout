// routes/marketing.js
// Marketing workflow: content/campaign pieces through production stages.
// Media referenced by link/thumbnail (Higgsfield project, published post,
// preview image) rather than hosted here.
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const STAGES = ['idea', 'scripting', 'production', 'ready', 'posted', 'parked'];

async function listMarketing() {
  const r = await pool.query('SELECT * FROM marketing ORDER BY updated_at DESC');
  return r.rows;
}

async function addMarketing({ title, product, channel, stage, link, thumbnail, script, notes }) {
  if (!title || !title.trim()) throw new Error('Marketing item title required');
  const s = STAGES.includes(stage) ? stage : 'idea';
  const r = await pool.query(
    `INSERT INTO marketing (title, product, channel, stage, link, thumbnail, script, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title.trim(), product || null, channel || null, s, link || null, thumbnail || null, script || null, notes || null]
  );
  return r.rows[0];
}

async function moveMarketing({ id, title, stage }) {
  if (!STAGES.includes(stage)) throw new Error(`Invalid stage. Use one of: ${STAGES.join(', ')}`);
  let itemId = id;
  if (!itemId && title) {
    const found = await pool.query(
      `SELECT id FROM marketing WHERE title ILIKE $1 ORDER BY updated_at DESC LIMIT 1`, [`%${title}%`]
    );
    if (found.rows.length === 0) throw new Error(`No marketing item matching "${title}"`);
    itemId = found.rows[0].id;
  }
  if (!itemId) throw new Error('Need an id or title');
  const r = await pool.query(
    `UPDATE marketing SET stage = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [stage, itemId]
  );
  if (r.rows.length === 0) throw new Error('Item not found');
  return r.rows[0];
}

router.get('/', async (req, res) => {
  try { res.json(await listMarketing()); }
  catch (err) { res.status(500).json({ error: 'Failed to fetch marketing' }); }
});

router.post('/', async (req, res) => {
  try { res.json(await addMarketing(req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const fields = ['title', 'product', 'channel', 'stage', 'link', 'thumbnail', 'script', 'notes'];
    const updates = []; const values = []; let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        if (f === 'stage' && !STAGES.includes(req.body[f])) return res.status(400).json({ error: 'Invalid stage' });
        updates.push(`${f} = $${i++}`); values.push(req.body[f]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const r = await pool.query(`UPDATE marketing SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update' }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM marketing WHERE id = $1', [req.params.id]); res.json({ removed: req.params.id }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete' }); }
});

module.exports = router;
module.exports.listMarketing = listMarketing;
module.exports.addMarketing = addMarketing;
module.exports.moveMarketing = moveMarketing;
module.exports.MKT_STAGES = STAGES;
