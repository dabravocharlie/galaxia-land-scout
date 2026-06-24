// src/components/CountyWatch.jsx
// Shows the tax-sale tracker: which county pages are being watched, and which
// have changed since last review (alert_pending). Changed counties surface to
// the top with a brass highlight and a "Mark reviewed" action.

import { useEffect, useState } from 'react';
import { api } from '../api';

function formatDate(iso) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CountyWatch() {
  const [counties, setCounties] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.getCounties()
      .then(setCounties)
      .catch(() => setCounties([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleReviewed = async (id) => {
    try {
      await api.markCountyReviewed(id);
      load();
    } catch {
      // silently ignore — refresh will show current state
    }
  };

  const pendingCount = counties.filter(c => c.alert_pending).length;

  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: 0, color: 'var(--parchment)' }}>
          County Tax-Sale Watch
        </h2>
        {pendingCount > 0 && (
          <span style={{
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            color: 'var(--ink)', background: 'var(--brass)',
            padding: '4px 10px', borderRadius: 2, letterSpacing: '0.04em',
          }}>
            {pendingCount} need{pendingCount === 1 ? 's' : ''} review
          </span>
        )}
      </div>

      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 13, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 16, maxWidth: 620 }}>
        These county pages are watched for changes. When a county posts a new tax-sale list, it's flagged here for you to review the parcels directly on the county site.
      </p>

      {loading ? (
        <div style={{ padding: 24, color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          Loading watch list…
        </div>
      ) : counties.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', border: '1px dashed var(--ink-line)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)' }}>
            No counties tracked yet. Run the tax sale tracker to establish baselines.
          </div>
        </div>
      ) : (
        <div style={{ border: '1px solid var(--ink-line)' }}>
          {counties.map((c, idx) => (
            <div
              key={c.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '12px 16px',
                borderBottom: idx < counties.length - 1 ? '1px solid var(--ink-line)' : 'none',
                background: c.alert_pending ? 'rgba(184,137,63,0.08)' : 'transparent',
              }}
            >
              {/* Alert dot */}
              <div style={{ width: 8, flexShrink: 0 }}>
                {c.alert_pending && (
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--brass)' }} />
                )}
              </div>

              {/* County name + state */}
              <div style={{ minWidth: 150 }}>
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                   style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: c.alert_pending ? 'var(--brass)' : 'var(--parchment)', textDecoration: 'none' }}>
                  {c.county}, {c.state}
                </a>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--parchment-dim)' }}>
                  {c.platform || 'custom'}
                </div>
              </div>

              {/* Status */}
              <div style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)' }}>
                {c.last_error ? (
                  <span style={{ color: 'var(--rust-bright)' }}>Error: {c.last_error}</span>
                ) : c.alert_pending ? (
                  <span style={{ color: 'var(--parchment)' }}>
                    Changed {formatDate(c.last_changed_at)}
                    {c.pdf_links && c.pdf_links.length > 0 && (
                      <> · <a href={c.pdf_links[0]} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brass)' }}>view list (PDF)</a></>
                    )}
                  </span>
                ) : (
                  <span>Checked {formatDate(c.last_checked_at)} · no change</span>
                )}
              </div>

              {/* Action */}
              {c.alert_pending && (
                <button
                  onClick={() => handleReviewed(c.id)}
                  style={{
                    background: 'transparent', border: '1px solid var(--brass)',
                    color: 'var(--brass)', fontFamily: 'var(--font-ui)', fontSize: 11,
                    padding: '5px 10px', borderRadius: 2, cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  Mark reviewed
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
