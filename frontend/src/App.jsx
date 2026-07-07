// src/App.jsx
import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import StatCard from './components/StatCard';
import FilterBar from './components/FilterBar';
import ListingsTable from './components/ListingsTable';
import CountyWatch from './components/CountyWatch';
import TechStocks from './components/TechStocks';
import BusinessList from './components/BusinessList';
import Minerva from './components/Minerva';
import Portfolio from './components/Portfolio';
import Pipeline from './components/Pipeline';
import Performance from './components/Performance';
import Calendar from './components/Calendar';
import Notes from './components/Notes';
import Marketing from './components/Marketing';

const TABS = [
  { id: 'minerva', label: 'Minerva' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'performance', label: 'Performance' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'notes', label: 'Notes' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'land', label: 'Land Scout' },
  { id: 'tech', label: 'Tech Stocks' },
  { id: 'biz', label: 'Businesses' },
];

function LandModule() {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState(null);
  const [sourceStatus, setSourceStatus] = useState([]);
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getListings(filters);
      setListings(data.listings);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadListings(); }, [loadListings]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.getSourceStatus().then(setSourceStatus).catch(() => {});
  }, []);

  return (
    <div>
      <p style={{ fontFamily: 'var(--font-serif)', fontSize: 14, color: 'var(--parchment-dim)', marginTop: 0, marginBottom: 24, maxWidth: 560 }}>
        Tracking tax-deed auctions, retail listings, and classifieds across Georgia, Alabama, and Mississippi.
      </p>

      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <StatCard label="Total tracked" value={stats.total} />
          <StatCard label="New" value={stats.new_count} accent="var(--brass)" />
          <StatCard label="Flagged" value={stats.flagged_count} accent="var(--rust-bright)" />
          <StatCard label="Under $1,000" value={stats.under_threshold_count} accent="var(--rust-bright)" />
          <StatCard label="Georgia" value={stats.ga_count} />
          <StatCard label="Alabama" value={stats.al_count} />
          <StatCard label="Mississippi" value={stats.ms_count} />
        </div>
      )}

      <FilterBar filters={filters} onChange={setFilters} sourceStatus={sourceStatus} />

      {error && (
        <div style={{ padding: 16, border: '1px solid var(--rust)', color: 'var(--rust-bright)', fontFamily: 'var(--font-ui)', fontSize: 13, marginBottom: 16 }}>
          Couldn't reach the backend: {error}. Check that the API is running and VITE_API_URL is set correctly.
        </div>
      )}

      <ListingsTable listings={listings} loading={loading} />

      <CountyWatch />
    </div>
  );
}

export default function App() {
  const validTabs = TABS.map(t => t.id);
  const tabFromHash = () => {
    const h = window.location.hash.replace('#', '');
    return validTabs.includes(h) ? h : 'minerva';
  };
  const [tab, setTabState] = useState(tabFromHash());

  // Keep the tab in sync with the URL hash so each tab is directly linkable
  // (e.g. .../#marketing) and can be opened in its own window on another screen.
  useEffect(() => {
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = (id) => {
    if (window.location.hash.replace('#', '') !== id) window.location.hash = id;
    setTabState(id);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* LCARS header bar */}
        <header style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginBottom: 10 }}>
            {/* Left elbow block */}
            <div style={{
              background: 'var(--brass)', borderTopLeftRadius: 24, borderBottomLeftRadius: 24,
              borderTopRightRadius: 8, borderBottomRightRadius: 8,
              width: 120, minHeight: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
              padding: '0 14px 8px 0',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink)', letterSpacing: '0.05em' }}>
                LCARS 47
              </span>
            </div>
            {/* Title block */}
            <div style={{
              flex: 1, background: 'var(--ink-raised)', borderRadius: 8,
              display: 'flex', alignItems: 'center', padding: '0 20px',
              border: '1px solid var(--ink-line)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--brass)' }}>
                  Galaxia Investment
                </div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, margin: 0, color: 'var(--parchment)', letterSpacing: '0.06em', textShadow: '0 0 18px rgba(255,159,85,0.35)' }}>
                  COMMAND CENTER
                </h1>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--sage)' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--sage)', marginRight: 6, animation: 'lcars-pulse 2s infinite' }} />
                  ALL SYSTEMS ONLINE
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)', marginTop: 4 }}>
                  10 MODULES ACTIVE
                </div>
              </div>
            </div>
            {/* Right cap */}
            <div style={{
              background: 'var(--lcars-lilac)', borderTopRightRadius: 24, borderBottomRightRadius: 24,
              borderTopLeftRadius: 8, borderBottomLeftRadius: 8, width: 60, minHeight: 56,
            }} />
          </div>
        </header>

        {/* LCARS tab nav — rounded pills, active one glows amber. Each pill has
            a small pop-out button to open that tab in its own window. */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 26, flexWrap: 'wrap' }}>
          {TABS.map((t, idx) => {
            const active = tab === t.id;
            const palette = ['var(--brass)', 'var(--lcars-blue)', 'var(--lcars-gold)', 'var(--lcars-lilac)'];
            const c = palette[idx % palette.length];
            const popOut = (e) => {
              e.stopPropagation();
              const url = `${window.location.origin}${window.location.pathname}#${t.id}`;
              window.open(url, `galaxia_${t.id}`, 'width=1100,height=800');
            };
            return (
              <div key={t.id} style={{
                display: 'flex', alignItems: 'stretch',
                background: active ? c : 'var(--ink-raised)',
                border: `1px solid ${active ? c : 'var(--ink-line)'}`,
                borderRadius: 18, overflow: 'hidden',
                boxShadow: active ? `0 0 16px ${c}` : 'none',
                transition: 'all 0.15s ease',
              }}>
                <button
                  onClick={() => setTab(t.id)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: active ? 'var(--ink)' : 'var(--parchment-dim)',
                    fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    padding: '9px 14px 9px 22px', cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
                <button
                  onClick={popOut}
                  title={`Open ${t.label} in a new window`}
                  style={{
                    background: 'transparent', border: 'none',
                    borderLeft: `1px solid ${active ? 'rgba(0,0,0,0.25)' : 'var(--ink-line)'}`,
                    color: active ? 'var(--ink)' : 'var(--parchment-dim)',
                    fontSize: 13, cursor: 'pointer', padding: '0 10px', lineHeight: 1,
                  }}
                >
                  ⇱
                </button>
              </div>
            );
          })}
        </div>

        {/* Active module */}
        {tab === 'minerva' && <Minerva />}
        {tab === 'pipeline' && <Pipeline />}
        {tab === 'portfolio' && <Portfolio />}
        {tab === 'performance' && <Performance />}
        {tab === 'calendar' && <Calendar />}
        {tab === 'notes' && <Notes />}
        {tab === 'marketing' && <Marketing />}
        {tab === 'land' && <LandModule />}
        {tab === 'tech' && <TechStocks />}
        {tab === 'biz' && <BusinessList />}

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--ink-line)', fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.05em', color: 'var(--parchment-dim)' }}>
          GALAXIA COMMAND CENTER &middot; STARDATE {new Date().toISOString().slice(0,10)} &middot; LAND / TECH / BUSINESS / MINERVA
        </footer>
      </div>
    </div>
  );
}
