// routes/notes.js
// Notes / documents: stored drafts (email inquiries, LOIs, non-binding offers)
// and research notes. Minerva can write drafts here. NOT for binding contracts.
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const CATEGORIES = ['email', 'loi', 'offer', 'research', 'note'];

async function listNotes() {
  const r = await pool.query('SELECT * FROM notes ORDER BY updated_at DESC');
  return r.rows;
}

async function addNote({ title, body, category }) {
  if (!title || !title.trim()) throw new Error('Note title required');
  const cat = CATEGORIES.includes(category) ? category : 'note';
  const r = await pool.query(
    `INSERT INTO notes (title, body, category) VALUES ($1,$2,$3) RETURNING *`,
    [title.trim(), body || null, cat]
  );
  return r.rows[0];
}

router.get('/', async (req, res) => {
  try { res.json(await listNotes()); }
  catch (err) { res.status(500).json({ error: 'Failed to fetch notes' }); }
});

router.post('/', async (req, res) => {
  try { res.json(await addNote(req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { title, body, category } = req.body;
    const updates = []; const values = []; let i = 1;
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
    if (body !== undefined) { updates.push(`body = $${i++}`); values.push(body); }
    if (category !== undefined) { updates.push(`category = $${i++}`); values.push(category); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const r = await pool.query(`UPDATE notes SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update note' }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM notes WHERE id = $1', [req.params.id]); res.json({ removed: req.params.id }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete note' }); }
});

module.exports = router;
module.exports.listNotes = listNotes;
module.exports.addNote = addNote;
