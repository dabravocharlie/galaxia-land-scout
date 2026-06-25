// src/components/BusinessList.jsx
// Cheap businesses for sale (BizBuySell, GA, under $50k). Shows title,
// location, asking price, and cash flow, with watch/dismiss + a view link.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import StatCard from './StatCard';

const STATUS_COLORS = {
  new: 'var(--brass)',
  watching: 'var(--sage)',
  reviewed: 'var(--parchment-dim)',
  dismissed: 'var(--parchment-dim)',
};

function money(n) {
  if (n === null || n === undefined) return '-';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function BusinessList() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.getBusinesses()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    api.getBusinessStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const setStatus = async (id, status) => {
    try { await api.updateBusiness(id, { status }); load(); } catch { /* refresh shows state */ }
  };

  return (
    <div>
      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <StatCard label="Total found" value={stats.total} />
          <StatCard label="New" value={stats.new_count} accent="var(--brass)" />
          <StatCard label="Watching" value={stats.watching_count} accent="var(--sage)" />
          <StatCard label="Under $25k" value={stats.under_25k_count} accent="var(--rust-bright)" />
        </div>
      )}

      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 20, maxWidth: 620 }}>
        Cheap businesses for sale in Georgia under $50,000, from BizBuySell - established operations, asset sales, and startup/franchise opportunities. Cheapest first.
      </p>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Pulling the ledger...
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '48px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--parchment)', marginBottom: 8 }}>
            No businesses yet
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>
            Run the businesses scraper to populate this list.
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--ink-line)' }}>
          {items.map((b, idx) => (
            <div
              key={b.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 16px',
                borderBottom: idx < items.length - 1 ? '1px solid var(--ink-line)' : 'none',
                background: b.status === 'new' ? 'rgba(184,137,63,0.06)' : 'transparent',
                opacity: b.status === 'dismissed' ? 0.5 : 1,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--parchment)' }}>
                  {b.title || 'Business for sale'}
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)', marginTop: 2 }}>
                  {b.location || b.state || 'Georgia'}
                  {b.source_url ? <> &middot; <a href={b.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)', textDecoration: 'none' }}>view listing</a></> : null}
                </div>
              </div>

              <div style={{ textAlign: 'right', whiteSpace: 'nowrap', minWidth: 110 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--parchment)' }}>
                  {money(b.price)}
                </div>
                {b.cash_flow ? (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)', marginTop: 2 }}>
                    CF {money(b.cash_flow)}
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', minWidth: 70 }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase',
                  color: STATUS_COLORS[b.status] || 'var(--parchment-dim)',
                }}>
                  {b.status}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {b.status !== 'watching' && (
                    <button onClick={() => setStatus(b.id, 'watching')} style={miniBtn('var(--sage)')}>watch</button>
                  )}
                  {b.status !== 'dismissed' && (
                    <button onClick={() => setStatus(b.id, 'dismissed')} style={miniBtn('var(--parchment-dim)')}>dismiss</button>
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
    background: 'transparent', border: '1px solid ' + color, color,
    fontFamily: 'var(--font-ui)', fontSize: 10, padding: '3px 7px',
    borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap',
  };
}
