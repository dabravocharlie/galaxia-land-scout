// src/components/TechStocks.jsx
// Tech Stocks module: notable tech names surfaced by the discovery job.
// Shows ticker, company, category badge, and the one-line reason, with a
// status workflow (new -> watching / reviewed / dismissed).

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import StatCard from './StatCard';

const CATEGORY_COLORS = {
  mover: 'var(--brass)',
  upgrade: 'var(--sage)',
  earnings: 'var(--rust-bright)',
  emerging: 'var(--brass)',
  product: 'var(--sage)',
  other: 'var(--parchment-dim)',
};

const STATUS_COLORS = {
  new: 'var(--brass)',
  watching: 'var(--sage)',
  reviewed: 'var(--parchment-dim)',
  dismissed: 'var(--parchment-dim)',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TechStocks() {
  const [stocks, setStocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getTechStocks()
      .then(setStocks)
      .catch(() => setStocks([]))
      .finally(() => setLoading(false));
    api.getTechStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try {
      await api.updateTechStock(id, { status });
      load();
    } catch { /* refresh will reflect current state */ }
  };

  return (
    <div>
      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <StatCard label="On radar" value={stats.total} />
          <StatCard label="New" value={stats.new_count} accent="var(--brass)" />
          <StatCard label="Watching" value={stats.watching_count} accent="var(--sage)" />
        </div>
      )}

      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 20, maxWidth: 620 }}>
        Notable technology names surfaced each week — movers, analyst calls, earnings standouts, and emerging small-caps. Mark the ones worth tracking as "watching."
      </p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Scanning the radar…
        </div>
      ) : stocks.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--parchment)', marginBottom: 8 }}>
            No tech names yet
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>
            Run the discovery job to populate the radar.
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--ink-line)' }}>
          {stocks.map((s, idx) => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 16px',
                borderBottom: idx < stocks.length - 1 ? '1px solid var(--ink-line)' : 'none',
                background: s.status === 'new' ? 'rgba(184,137,63,0.06)' : 'transparent',
                opacity: s.status === 'dismissed' ? 0.5 : 1,
              }}
            >
              <div style={{ minWidth: 92, flexShrink: 0 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--parchment)' }}>
                  {s.ticker}
                </div>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: CATEGORY_COLORS[s.category] || 'var(--parchment-dim)',
                  border: `1px solid ${CATEGORY_COLORS[s.category] || 'var(--ink-line)'}`,
                  padding: '1px 5px', display: 'inline-block', marginTop: 4,
                }}>
                  {s.category || 'notable'}
                </span>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--parchment)' }}>
                  {s.company || s.ticker}
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 2 }}>
                  {s.reason || ''}
                </div>
                <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)' }}>
                  seen {formatDate(s.last_seen_at)}{s.times_seen > 1 ? ` · ${s.times_seen}x` : ''}
                  {s.source_url ? <> · <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)', textDecoration: 'none' }}>source</a></> : null}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: STATUS_COLORS[s.status] || 'var(--parchment-dim)',
                }}>
                  ● {s.status}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {s.status !== 'watching' && (
                    <button onClick={() => setStatus(s.id, 'watching')} style={miniBtn('var(--sage)')}>watch</button>
                  )}
                  {s.status !== 'dismissed' && (
                    <button onClick={() => setStatus(s.id, 'dismissed')} style={miniBtn('var(--parchment-dim)')}>dismiss</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function miniBtn(color) {
  return {
    background: 'transparent', border: `1px solid ${color}`, color,
    fontFamily: 'var(--font-ui)', fontSize: 10, padding: '3px 7px',
    borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
