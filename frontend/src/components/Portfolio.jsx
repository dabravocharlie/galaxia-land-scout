// src/components/Portfolio.jsx
// Portfolio module: the owner's editable stock watchlist with the latest AI
// news summary per ticker. Add/remove tickers right here.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';

const SENT = {
  positive: { color: 'var(--sage)', label: 'POSITIVE' },
  negative: { color: 'var(--rust-bright)', label: 'NEGATIVE' },
  neutral:  { color: 'var(--parchment-dim)', label: 'NEUTRAL' },
};

function formatDate(iso) {
  if (!iso) return 'not yet checked';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Portfolio() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTicker, setNewTicker] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getPortfolio()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTicker = async () => {
    const t = newTicker.toUpperCase().trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      await api.addTicker(t);
      setNewTicker('');
      load();
    } catch { /* ignore; reload shows state */ }
    finally { setAdding(false); }
  };

  const removeTicker = async (ticker) => {
    try { await api.removeTicker(ticker); load(); } catch { /* ignore */ }
  };

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 20, maxWidth: 640 }}>
        Your holdings and watchlist, with the latest news on each. Updated Monday, Wednesday, and Friday. Add or remove tickers anytime - Minerva can see this list too.
      </p>

      {/* Add ticker row */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 22 }}>
        <input
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTicker(); }}
          placeholder="Add ticker (e.g. NVDA)"
          style={{
            background: 'var(--ink-raised)', border: '1px solid var(--ink-line)', color: 'var(--parchment)',
            fontFamily: 'var(--font-mono)', fontSize: 14, padding: '10px 14px', borderRadius: 10, width: 200,
            textTransform: 'uppercase',
          }}
        />
        <button onClick={addTicker} disabled={adding || !newTicker.trim()}
          style={{
            background: 'var(--brass)', border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '10px 18px', borderRadius: 10, cursor: (adding || !newTicker.trim()) ? 'default' : 'pointer',
          }}>
          Add
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Loading holdings...
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)', borderRadius: 12 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--parchment)', marginBottom: 8 }}>
            No tickers yet
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>
            Add a ticker above to start tracking it.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((r) => {
            const sent = SENT[r.sentiment] || SENT.neutral;
            return (
              <div key={r.id} style={{
                border: '1px solid var(--ink-line)', borderLeft: `4px solid ${sent.color}`,
                borderRadius: 12, background: 'var(--ink-raised)', padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 16,
              }}>
                <div style={{ minWidth: 90 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--parchment)' }}>
                    {r.ticker}
                  </div>
                  {r.note && (
                    <div style={{ fontFamily: 'var(--font-ui)', fontSize: 10, color: 'var(--parchment-dim)', marginTop: 2 }}>
                      {r.note}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment)', lineHeight: 1.45 }}>
                    {r.summary || 'No news pulled yet - runs Mon/Wed/Fri, or trigger a refresh.'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)', marginTop: 6 }}>
                    <span style={{ color: sent.color }}>{sent.label}</span>
                    {' '}&middot; {formatDate(r.updated_at)}
                    {r.source_url ? <> &middot; <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)', textDecoration: 'none' }}>source</a></> : null}
                  </div>
                </div>

                <button onClick={() => removeTicker(r.ticker)} title="Remove ticker"
                  style={{
                    background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--parchment-dim)',
                    fontFamily: 'var(--font-ui)', fontSize: 11, padding: '4px 9px', borderRadius: 8, cursor: 'pointer',
                  }}>
                  remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
