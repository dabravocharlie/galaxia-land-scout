// src/components/Calendar.jsx
// Deadlines & reminders: tax-sale dates, auction closes, earnings, personal
// reminders. Add here or via Minerva. Sorted by what's coming up next.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const TYPE_COLORS = {
  tax_sale: 'var(--brass)',
  auction: 'var(--lcars-lilac)',
  earnings: 'var(--lcars-blue)',
  reminder: 'var(--lcars-gold)',
  other: 'var(--parchment-dim)',
};
const TYPE_LABEL = {
  tax_sale: 'TAX SALE', auction: 'AUCTION', earnings: 'EARNINGS', reminder: 'REMINDER', other: 'OTHER',
};

function fmt(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function daysUntil(d) {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(d + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', event_date: '', event_type: 'reminder', notes: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.getEvents().then(setEvents).catch(() => setEvents([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const addEvent = async () => {
    if (!form.title.trim() || !form.event_date) return;
    try { await api.addEvent(form); setForm({ title: '', event_date: '', event_type: 'reminder', notes: '' }); setShowAdd(false); load(); }
    catch { /* ignore */ }
  };
  const markDone = async (id, done) => { try { await api.updateEvent(id, { done }); load(); } catch { /* ignore */ } };
  const removeEvent = async (id) => { try { await api.removeEvent(id); load(); } catch { /* ignore */ } };

  const upcoming = events.filter(e => !e.done);
  const past = events.filter(e => e.done);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', margin: 0, maxWidth: 520 }}>
          Deadlines and reminders - tax-sale dates, auction closes, earnings, and anything you ask Minerva to remember. Soonest first.
        </p>
        <button onClick={() => setShowAdd(v => !v)} style={btn('var(--brass)')}>{showAdd ? 'Cancel' : '+ Add Deadline'}</button>
      </div>

      {showAdd && (
        <div style={{ border: '1px solid var(--ink-line)', borderRadius: 12, background: 'var(--ink-raised)', padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What is it?" style={inp(240)} />
          <input value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} type="date" style={inp(150)} />
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} style={inp(140)}>
            <option value="tax_sale">Tax Sale</option>
            <option value="auction">Auction</option>
            <option value="earnings">Earnings</option>
            <option value="reminder">Reminder</option>
            <option value="other">Other</option>
          </select>
          <button onClick={addEvent} disabled={!form.title.trim() || !form.event_date} style={btn('var(--sage)')}>Save</button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>Loading calendar...</div>
      ) : upcoming.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)', borderRadius: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--parchment)', marginBottom: 8 }}>No deadlines yet</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>Add one above, or tell Minerva "remind me the Fulton tax sale is March 4."</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {upcoming.map(e => {
            const d = daysUntil(e.event_date);
            const soon = d !== null && d <= 7;
            const color = TYPE_COLORS[e.event_type] || 'var(--parchment-dim)';
            return (
              <div key={e.id} style={{ border: '1px solid var(--ink-line)', borderLeft: `4px solid ${color}`, borderRadius: 12, background: 'var(--ink-raised)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ minWidth: 64, textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: soon ? 'var(--rust-bright)' : 'var(--parchment)' }}>
                    {d === 0 ? 'TODAY' : d < 0 ? 'PAST' : d}
                  </div>
                  {d > 0 && <div style={{ fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.08em', color: 'var(--parchment-dim)' }}>DAYS</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--parchment)' }}>{e.title}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)', marginTop: 2 }}>
                    <span style={{ color }}>{TYPE_LABEL[e.event_type] || 'OTHER'}</span> &middot; {fmt(e.event_date)}
                  </div>
                  {e.notes && <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 4 }}>{e.notes}</div>}
                </div>
                <button onClick={() => markDone(e.id, true)} style={miniBtn('var(--sage)')}>done</button>
                <button onClick={() => removeEvent(e.id)} style={miniBtn('var(--parchment-dim)')}>delete</button>
              </div>
            );
          })}
        </div>
      )}

      {past.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--parchment-dim)', marginBottom: 10 }}>Completed</div>
          {past.map(e => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', opacity: 0.5, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>
              <span style={{ textDecoration: 'line-through' }}>{e.title}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{fmt(e.event_date)}</span>
              <button onClick={() => markDone(e.id, false)} style={{ ...miniBtn('var(--parchment-dim)'), marginLeft: 'auto' }}>undo</button>
              <button onClick={() => removeEvent(e.id)} style={miniBtn('var(--parchment-dim)')}>delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function btn(color) {
  return { background: color, border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function miniBtn(color) {
  return { background: 'transparent', border: `1px solid ${color}`, color, fontFamily: 'var(--font-ui)', fontSize: 10, padding: '4px 9px', borderRadius: 8, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function inp(width) {
  return { background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-ui)', fontSize: 13, padding: '9px 12px', borderRadius: 8, width };
}
