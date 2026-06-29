// src/components/Notes.jsx
// Notes & drafts: store email inquiries, LOIs, non-binding offers, and research.
// Minerva can write drafts here ("draft an LOI for the Macon parcel"). You copy
// drafts into your real email/document to send yourself.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const CAT_COLORS = {
  email: 'var(--lcars-blue)', loi: 'var(--brass)', offer: 'var(--lcars-gold)',
  research: 'var(--sage)', note: 'var(--parchment-dim)',
};
const CAT_LABEL = { email: 'EMAIL', loi: 'LOI', offer: 'OFFER', research: 'RESEARCH', note: 'NOTE' };

export default function Notes() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // id or 'new'
  const [form, setForm] = useState({ title: '', body: '', category: 'note' });

  const load = useCallback(() => {
    setLoading(true);
    api.getNotes().then(setNotes).catch(() => setNotes([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const startNew = () => { setEditing('new'); setForm({ title: '', body: '', category: 'note' }); };
  const startEdit = (n) => { setEditing(n.id); setForm({ title: n.title, body: n.body || '', category: n.category || 'note' }); };

  const save = async () => {
    if (!form.title.trim()) return;
    try {
      if (editing === 'new') await api.addNote(form);
      else await api.updateNote(editing, form);
      setEditing(null); load();
    } catch { /* ignore */ }
  };
  const remove = async (id) => { try { await api.removeNote(id); if (editing === id) setEditing(null); load(); } catch { /* ignore */ } };
  const copy = (text) => { try { navigator.clipboard.writeText(text || ''); } catch { /* ignore */ } };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', margin: 0, maxWidth: 540 }}>
          Drafts and research. Store email inquiries, letters of intent, and non-binding offers - Minerva can write these for you. Copy a draft to send it yourself. (Binding contracts should go through an attorney.)
        </p>
        <button onClick={startNew} style={btn('var(--brass)')}>+ New Note</button>
      </div>

      {editing !== null && (
        <div style={{ border: '1px solid var(--brass)', borderRadius: 12, background: 'var(--ink-raised)', padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" style={inp(280)} />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} style={inp(140)}>
              <option value="note">Note</option>
              <option value="email">Email</option>
              <option value="loi">LOI</option>
              <option value="offer">Offer</option>
              <option value="research">Research</option>
            </select>
          </div>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Write your note or draft here..."
            style={{ width: '100%', minHeight: 180, background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-serif)', fontSize: 14, lineHeight: 1.5, padding: 12, borderRadius: 8, resize: 'vertical', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button onClick={save} disabled={!form.title.trim()} style={btn('var(--sage)')}>Save</button>
            <button onClick={() => setEditing(null)} style={{ background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--parchment-dim)', fontFamily: 'var(--font-ui)', fontSize: 13, padding: '10px 16px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>Loading notes...</div>
      ) : notes.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)', borderRadius: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--parchment)', marginBottom: 8 }}>No notes yet</div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>Create one above, or ask Minerva to draft an inquiry or LOI for a deal.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notes.map(n => {
            const color = CAT_COLORS[n.category] || 'var(--parchment-dim)';
            return (
              <div key={n.id} style={{ border: '1px solid var(--ink-line)', borderLeft: `4px solid ${color}`, borderRadius: 12, background: 'var(--ink-raised)', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color, border: `1px solid ${color}`, padding: '1px 6px', borderRadius: 4 }}>
                    {CAT_LABEL[n.category] || 'NOTE'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--parchment)' }}>{n.title}</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button onClick={() => copy(n.body)} style={miniBtn('var(--brass)')}>copy</button>
                    <button onClick={() => startEdit(n)} style={miniBtn('var(--lcars-blue)')}>edit</button>
                    <button onClick={() => remove(n.id)} style={miniBtn('var(--parchment-dim)')}>delete</button>
                  </div>
                </div>
                {n.body && (
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.5, maxHeight: 200, overflow: 'auto' }}>
                    {n.body}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function btn(color) {
  return { background: color, border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '10px 18px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap' };
}
function miniBtn(color) {
  return { background: 'transparent', border: `1px solid ${color}`, color, fontFamily: 'var(--font-ui)', fontSize: 10, padding: '4px 9px', borderRadius: 8, cursor: 'pointer' };
}
function inp(width) {
  return { background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-ui)', fontSize: 13, padding: '9px 12px', borderRadius: 8, width, maxWidth: '100%' };
}
