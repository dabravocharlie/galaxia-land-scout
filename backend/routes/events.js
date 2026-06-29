// routes/events.js
// Calendar / deadlines: tax-sale dates, auction closes, earnings, reminders.
const express = require('express');
const router = express.Router();
const { pool } = require('../db/pool');

const TYPES = ['tax_sale', 'auction', 'earnings', 'reminder', 'other'];

async function listEvents({ upcomingOnly = false } = {}) {
  const where = upcomingOnly ? `WHERE event_date >= CURRENT_DATE AND done = FALSE` : '';
  const r = await pool.query(`SELECT * FROM events ${where} ORDER BY event_date ASC`);
  return r.rows;
}

async function addEvent({ title, event_date, event_type, notes }) {
  if (!title || !title.trim()) throw new Error('Event title required');
  if (!event_date) throw new Error('Event date required (YYYY-MM-DD)');
  const type = TYPES.includes(event_type) ? event_type : 'other';
  const r = await pool.query(
    `INSERT INTO events (title, event_date, event_type, notes)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [title.trim(), event_date, type, notes || null]
  );
  return r.rows[0];
}

router.get('/', async (req, res) => {
  try { res.json(await listEvents({ upcomingOnly: req.query.upcoming === '1' })); }
  catch (err) { res.status(500).json({ error: 'Failed to fetch events' }); }
});

router.post('/', async (req, res) => {
  try { res.json(await addEvent(req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { title, event_date, event_type, notes, done } = req.body;
    const updates = []; const values = []; let i = 1;
    if (title !== undefined) { updates.push(`title = $${i++}`); values.push(title); }
    if (event_date !== undefined) { updates.push(`event_date = $${i++}`); values.push(event_date); }
    if (event_type !== undefined) { updates.push(`event_type = $${i++}`); values.push(event_type); }
    if (notes !== undefined) { updates.push(`notes = $${i++}`); values.push(notes); }
    if (done !== undefined) { updates.push(`done = $${i++}`); values.push(done); }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields' });
    values.push(req.params.id);
    const r = await pool.query(`UPDATE events SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Failed to update event' }); }
});

router.delete('/:id', async (req, res) => {
  try { await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]); res.json({ removed: req.params.id }); }
  catch (err) { res.status(500).json({ error: 'Failed to delete event' }); }
});

module.exports = router;
module.exports.listEvents = listEvents;
module.exports.addEvent = addEvent;
