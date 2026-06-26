// src/components/Performance.jsx
// Portfolio performance: cost basis, live value, gain/loss, and dividends per
// holding (live prices from Finnhub), plus portfolio-wide totals. Edit your
// position (shares, avg cost, dividends, purchase date) inline per ticker.

import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import StatCard from './StatCard';

function money(n, sign) {
  if (n === null || n === undefined) return '-';
  const v = Number(n);
  const s = '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (sign && v > 0) return '+' + s;
  if (v < 0) return '-' + s;
  return s;
}
function pct(n) {
  if (n === null || n === undefined) return '-';
  const v = Number(n);
  return (v > 0 ? '+' : '') + v.toFixed(2) + '%';
}
function gainColor(n) {
  if (n === null || n === undefined) return 'var(--parchment-dim)';
  return Number(n) >= 0 ? 'var(--sage)' : 'var(--rust-bright)';
}

export default function Performance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // ticker being edited
  const [form, setForm] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    api.getPerformance().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const startEdit = (h) => {
    setEditing(h.ticker);
    setForm({
      shares: h.shares || '',
      avg_cost: h.avg_cost || '',
      dividends_received: h.dividends_received || '',
      purchase_date: h.purchase_date ? h.purchase_date.slice(0, 10) : '',
    });
  };

  const saveEdit = async (ticker) => {
    try {
      await api.updatePosition(ticker, {
        shares: form.shares === '' ? '' : Number(form.shares),
        avg_cost: form.avg_cost === '' ? '' : Number(form.avg_cost),
        dividends_received: form.dividends_received === '' ? '' : Number(form.dividends_received),
        purchase_date: form.purchase_date || '',
      });
      setEditing(null);
      load();
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>Pulling live quotes...</div>;
  }
  if (!data) {
    return <div style={{ padding: 24, color: 'var(--rust-bright)', fontFamily: 'var(--font-ui)', fontSize: 13 }}>Couldn't load performance. Check the backend.</div>;
  }

  const t = data.totals;

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 18, maxWidth: 640 }}>
        Live gain/loss across your holdings. Click any ticker to enter your shares, average cost, dividends received, and purchase date. Prices update each time you open this tab.
      </p>

      {!t.finnhub_configured && (
        <div style={{ padding: 14, border: '1px solid var(--lcars-gold)', borderRadius: 10, color: 'var(--lcars-gold)', fontFamily: 'var(--font-ui)', fontSize: 13, marginBottom: 18 }}>
          Live prices are off - set FINNHUB_API_KEY in Render to enable them. Cost basis still shows from your entered positions.
        </div>
      )}

      {/* Totals */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
        <StatCard label="Cost Basis" value={money(t.cost)} />
        <StatCard label="Market Value" value={money(t.value)} accent="var(--lcars-blue)" />
        <StatCard label="Gain / Loss" value={money(t.gain, true)} accent={gainColor(t.gain)} />
        <StatCard label="Return %" value={pct(t.gain_pct)} accent={gainColor(t.gain)} />
        <StatCard label="Dividends" value={money(t.dividends)} accent="var(--lcars-gold)" />
        <StatCard label="Total Return" value={money(t.total_return, true)} accent={gainColor(t.total_return)} />
      </div>

      {/* Holdings table */}
      <div style={{ border: '1px solid var(--ink-line)', borderRadius: 12, overflow: 'hidden' }}>
        {data.holdings.map((h, idx) => (
          <div key={h.id} style={{
            borderBottom: idx < data.holdings.length - 1 ? '1px solid var(--ink-line)' : 'none',
            background: h.has_position ? 'transparent' : 'rgba(255,255,255,0.02)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <div style={{ minWidth: 70 }}>
                <button onClick={() => startEdit(h)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--brass)' }}>{h.ticker}</span>
                </button>
              </div>

              {h.has_position ? (
                <>
                  <div style={cell()}>
                    <div style={lbl()}>{h.shares} sh @ {money(h.avg_cost)}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--parchment)' }}>{money(h.cost_basis)}</div>
                  </div>
                  <div style={cell()}>
                    <div style={lbl()}>price {h.priced ? money(h.price) : 'n/a'}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--parchment)' }}>{h.market_value !== null ? money(h.market_value) : '-'}</div>
                  </div>
                  <div style={cell()}>
                    <div style={lbl()}>gain/loss</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: gainColor(h.gain) }}>
                      {money(h.gain, true)} {h.gain_pct !== null ? `(${pct(h.gain_pct)})` : ''}
                    </div>
                  </div>
                  <div style={cell()}>
                    <div style={lbl()}>dividends</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--lcars-gold)' }}>{money(h.dividends_received)}</div>
                  </div>
                </>
              ) : (
                <div style={{ flex: 1, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)' }}>
                  No position entered - click the ticker to add your shares & cost.
                </div>
              )}
            </div>

            {/* Inline editor */}
            {editing === h.ticker && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <input value={form.shares} onChange={(e) => setForm({ ...form, shares: e.target.value })} placeholder="Shares" type="number" style={inp(90)} />
                <input value={form.avg_cost} onChange={(e) => setForm({ ...form, avg_cost: e.target.value })} placeholder="Avg cost $" type="number" style={inp(100)} />
                <input value={form.dividends_received} onChange={(e) => setForm({ ...form, dividends_received: e.target.value })} placeholder="Dividends $" type="number" style={inp(100)} />
                <input value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} placeholder="Purchase date" type="date" style={inp(150)} />
                <button onClick={() => saveEdit(h.ticker)} style={{ background: 'var(--sage)', border: 'none', color: 'var(--ink)', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}>Save</button>
                <button onClick={() => setEditing(null)} style={{ background: 'transparent', border: '1px solid var(--ink-line)', color: 'var(--parchment-dim)', fontFamily: 'var(--font-ui)', fontSize: 12, padding: '8px 14px', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function cell() { return { flex: 1, minWidth: 110 }; }
function lbl() { return { fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--parchment-dim)', marginBottom: 2 }; }
function inp(width) {
  return { background: 'var(--ink)', border: '1px solid var(--ink-line)', color: 'var(--parchment)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '8px 10px', borderRadius: 8, width };
}
