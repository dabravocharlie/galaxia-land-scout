// src/App.jsx
import { useEffect, useState, useCallback } from 'react';
import { api } from './api';
import StatCard from './components/StatCard';
import FilterBar from './components/FilterBar';
import ListingsTable from './components/ListingsTable';
import CountyWatch from './components/CountyWatch';
import TechStocks from './components/TechStocks';

const TABS = [
  { id: 'land', label: 'Land Scout' },
  { id: 'tech', label: 'Tech Stocks' },
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
  const [tab, setTab] = useState('land');

  return (
    <div style={{ minHeight: '100vh', padding: '32px 24px 60px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--brass)', marginBottom: 8 }}>
            Galaxia Investment
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 600, margin: 0, color: 'var(--parchment)' }}>
            Investment Ledger
          </h1>
        </header>

        {/* Tab nav */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--ink-line)', marginBottom: 28 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--brass)' : '2px solid transparent',
                color: tab === t.id ? 'var(--parchment)' : 'var(--parchment-dim)',
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                fontWeight: 600,
                padding: '8px 16px',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Active module */}
        {tab === 'land' ? <LandModule /> : <TechStocks />}

        <footer style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid var(--ink-line)', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--parchment-dim)' }}>
          Galaxia Investment · land scout + tech radar · automated research
        </footer>
      </div>
    </div>
  );
}
