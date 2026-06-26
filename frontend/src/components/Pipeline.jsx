// src/components/Pipeline.jsx
// Deal pipeline board. Columns = stages; each deal is a card you can move
// between stages via a dropdown. Add deals manually here (Minerva can add them
// too, by chat/voice).

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const STAGES = [
  { id: 'interested',  label: 'Interested',  color: 'var(--brass)' },
  { id: 'researching', label: 'Researching', color: 'var(--lcars-blue)' },
  { id: 'contacted',   label: 'Contacted',   color: 'var(--lcars-lilac)' },
  { id: 'offer',       label: 'Offer',       color: 'var(--lcars-gold)' },
  { id: 'closed',      label: 'Closed',      color: 'var(--sage)' },
  { id: 'passed',      label: 'Passed',      color: 'var(--parchment-dim)' },
];

const TYPE_LABEL = { land: 'LAND', business: 'BIZ', stock: 'STOCK', other: 'OTHER' };

function money(n) {
  if (n === null || n === undefined) return null;
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function Pipeline() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', deal_type: 'other', amount: '', link: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.getDeals().then(setDeals).catch(() => setDeals([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addDeal = async () => {
    if (!form.title.trim()) return;
    try {
      await api.addDeal({
        title: form.title.trim(),
        deal_type: form.deal_type,
        amount: form.amount ? Number(form.amount) : null,
        link: form.link.trim() || null,
      });
      setForm({ title: '', deal_type: 'other', amount: '', link: '' });
      setShowAdd(false);
      load();
    } catch { /* ignore */ }
  };

  const moveDeal = async (id, stage) => {
    try { await api.updateDeal(id, { stage }); load(); } catch { /* ignore */ }
  };

  const removeDeal = async (id) => {
    try { await api.removeDeal(id); load(); } catch { /* ignore */ }
  };

  const counts = STAGES.reduce((acc, s) => {
    acc[s.id] = deals.filter(d => d.stage === s.id).length; return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', margin: 0, maxWidth: 520 }}>
          Every opportunity you're working, in one place. Move deals through the stages as they progress. Minerva can add or move deals when you ask her.
        </p>
        <button onClick={() => setShowAdd(v => !v)}
          style={{
            background: 'var(--brass)', border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '10px 18px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
          {showAdd ? 'Cancel' : '+ Add Deal'}
        </button>
      </div>

      {showAdd && (
        <div style={{ border: '1px solid var(--ink-line)', borderRadius: 12, background: 'var(--ink-raised)', padding: 16, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Deal title" style={inp(260)} />
          <select value={form.deal_type} onChange={(e) => setForm({ ...form, deal_type: e.target.value })} style={inp(120)}>
            <option value="land">Land</option>
            <option value="business">Business</option>
            <option value="stock">Stock</option>
            <option value="other">Other</option>
          </select>
          <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="Amount ($)" type="number" style={inp(120)} />
          <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })}
            placeholder="Link (optional)" style={inp(220)} />
          <button onClick={addDeal} disabled={!form.title.trim()}
            style={{ background: 'var(--sage)', border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, padding: '10px 18px', borderRadius: 10, cursor: form.title.trim() ? 'pointer' : 'default' }}>
            Save
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Loading pipeline...
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 12 }}>
          {STAGES.map(stage => (
            <div key={stage.id} style={{ minWidth: 230, flex: '1 0 230px' }}>
              {/* Column header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderTop: `3px solid ${stage.color}`, background: 'var(--ink-raised)',
                borderRadius: '0 0 8px 8px', padding: '8px 12px', marginBottom: 10,
              }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: stage.color }}>
                  {stage.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--parchment-dim)' }}>
                  {counts[stage.id]}
                </span>
              </div>

              {/* Cards */}
              {deals.filter(d => d.stage === stage.id).map(d => (
                <div key={d.id} style={{
                  border: '1px solid var(--ink-line)', borderRadius: 10, background: 'var(--ink-raised)',
                  padding: '10px 12px', marginBottom: 10,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em', color: stage.color, border: `1px solid ${stage.color}`, padding: '1px 5px', borderRadius: 4 }}>
                      {TYPE_LABEL[d.deal_type] || 'OTHER'}
                    </span>
                    <button onClick={() => removeDeal(d.id)} title="Delete"
                      style={{ background: 'transparent', border: 'none', color: 'var(--parchment-dim)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>
                      x
                    </button>
                  </div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment)', margin: '6px 0 4px' }}>
                    {d.title}
                  </div>
                  {money(d.amount) && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--brass)' }}>{money(d.amount)}</div>
                  )}
                  {d.link && (
                    <div style={{ marginTop: 4 }}>
                      <a href={d.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'var(--brass)', textDecoration: 'none' }}>view &raquo;</a>
                    </div>
                  )}
                  {/* Move dropdown */}
                  <select value={d.stage} onChange={(e) => moveDeal(d.id, e.target.value)}
                    style={{
                      marginTop: 8, width: '100%', background: 'var(--ink)', border: '1px solid var(--ink-line)',
                      color: 'var(--parchment-dim)', fontFamily: 'var(--font-ui)', fontSize: 11, padding: '4px 6px', borderRadius: 6,
                    }}>
                    {STAGES.map(s => <option key={s.id} value={s.id}>Move to: {s.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function inp(width) {
  return {
    background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)',
    fontFamily: 'var(--font-ui)', fontSize: 13, padding: '9px 12px', borderRadius: 8, width,
  };
}
