// src/components/Marketing.jsx
// Marketing workflow board: ad/content pieces through production stages.
// Visual: shows thumbnail previews. Media (video) is made in Higgsfield and
// referenced by link; we store the link + a preview image URL, not the file.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const STAGES = [
  { id: 'idea',       label: 'Idea',        color: 'var(--brass)' },
  { id: 'scripting',  label: 'Scripting',   color: 'var(--lcars-blue)' },
  { id: 'production', label: 'In Production',color: 'var(--lcars-lilac)' },
  { id: 'ready',      label: 'Ready',       color: 'var(--lcars-gold)' },
  { id: 'posted',     label: 'Posted',      color: 'var(--sage)' },
  { id: 'parked',     label: 'Parked',      color: 'var(--parchment-dim)' },
];

const CHANNELS = ['tiktok', 'instagram', 'youtube', 'facebook', 'x', 'other'];

export default function Marketing() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', product: '', channel: 'tiktok', link: '', thumbnail: '', script: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.getMarketing().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.title.trim()) return;
    try { await api.addMarketing(form); setForm({ title: '', product: '', channel: 'tiktok', link: '', thumbnail: '', script: '' }); setShowAdd(false); load(); }
    catch { /* ignore */ }
  };
  const move = async (id, stage) => { try { await api.updateMarketing(id, { stage }); load(); } catch { /* ignore */ } };
  const remove = async (id) => { try { await api.removeMarketing(id); load(); } catch { /* ignore */ } };

  const counts = STAGES.reduce((acc, s) => { acc[s.id] = items.filter(i => i.stage === s.id).length; return acc; }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', margin: 0, maxWidth: 560 }}>
          Your marketing pipeline - ad concepts and content from idea to posted. Videos are made in Higgsfield AI; paste the project or post link and a preview image on each card. Minerva can brainstorm concepts and add them here.
        </p>
        <button onClick={() => setShowAdd(v => !v)} style={btn('var(--brass)')}>{showAdd ? 'Cancel' : '+ Add Content'}</button>
      </div>

      {showAdd && (
        <div style={{ border: '1px solid var(--ink-line)', borderRadius: 12, background: 'var(--ink-raised)', padding: 16, marginBottom: 20, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Hermie launch teaser)" style={inp(260)} />
            <input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Product" style={inp(140)} />
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} style={inp(130)}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Higgsfield / post link" style={inp(260)} />
            <input value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} placeholder="Preview image URL" style={inp(260)} />
          </div>
          <textarea value={form.script} onChange={(e) => setForm({ ...form, script: e.target.value })} placeholder="Concept / script / copy..."
            style={{ width: '100%', minHeight: 80, background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-serif)', fontSize: 14, padding: 10, borderRadius: 8, resize: 'vertical', boxSizing: 'border-box' }} />
          <div><button onClick={add} disabled={!form.title.trim()} style={btn('var(--sage)')}>Save</button></div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>Loading marketing board...</div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
          {STAGES.map(stage => (
            <div key={stage.id} style={{ minWidth: 250, flex: '1 0 250px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `3px solid ${stage.color}`, background: 'var(--ink-raised)', borderRadius: '0 0 8px 8px', padding: '8px 12px', marginBottom: 10 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: stage.color }}>{stage.label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--parchment-dim)' }}>{counts[stage.id]}</span>
              </div>

              {items.filter(i => i.stage === stage.id).map(m => (
                <div key={m.id} style={{ border: '1px solid var(--ink-line)', borderRadius: 10, background: 'var(--ink-raised)', marginBottom: 10, overflow: 'hidden' }}>
                  {m.thumbnail && (
                    <a href={m.link || m.thumbnail} target="_blank" rel="noopener noreferrer">
                      <img src={m.thumbnail} alt={m.title} style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </a>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--parchment)' }}>{m.title}</div>
                      <button onClick={() => remove(m.id)} style={{ background: 'transparent', border: 'none', color: 'var(--parchment-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>x</button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--parchment-dim)', marginTop: 3 }}>
                      {m.product ? m.product : ''}{m.product && m.channel ? ' - ' : ''}{m.channel ? m.channel.toUpperCase() : ''}
                    </div>
                    {m.script && <div style={{ fontFamily: 'var(--font-serif)', fontSize: 12, color: 'var(--parchment-dim)', marginTop: 6, maxHeight: 60, overflow: 'auto' }}>{m.script}</div>}
                    {m.link && <div style={{ marginTop: 6 }}><a href={m.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--brass)', textDecoration: 'none' }}>open link &raquo;</a></div>}
                    <select value={m.stage} onChange={(e) => move(m.id, e.target.value)}
                      style={{ marginTop: 8, width: '100%', background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment-dim)', fontFamily: 'var(--font-ui)', fontSize: 11, padding: '4px 6px', borderRadius: 6 }}>
                      {STAGES.map(s => <option key={s.id} value={s.id}>Move to: {s.label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
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
function inp(width) {
  return { background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-ui)', fontSize: 13, padding: '9px 12px', borderRadius: 8, width, maxWidth: '100%' };
}
