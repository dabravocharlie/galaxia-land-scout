// src/components/FilterBar.jsx
const selectStyle = {
  background: 'var(--ink-raised)',
  border: '1px solid var(--ink-line)',
  color: 'var(--parchment)',
  fontFamily: 'var(--font-ui)',
  fontSize: 13,
  padding: '8px 12px',
  borderRadius: 2,
};

export default function FilterBar({ filters, onChange, sourceStatus }) {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 20 }}>
      <select style={selectStyle} value={filters.state || ''} onChange={(e) => update('state', e.target.value)}>
        <option value="">All states</option>
        <option value="GA">Georgia</option>
        <option value="AL">Alabama</option>
        <option value="MS">Mississippi</option>
      </select>

      <select style={selectStyle} value={filters.source || ''} onChange={(e) => update('source', e.target.value)}>
        <option value="">All sources</option>
        <option value="craigslist">Craigslist</option>
        <option value="landsearch">LandSearch</option>
        <option value="landwatch">LandWatch</option>
      </select>

      <select style={selectStyle} value={filters.status || ''} onChange={(e) => update('status', e.target.value)}>
        <option value="">All statuses</option>
        <option value="new">New</option>
        <option value="reviewed">Reviewed</option>
        <option value="flagged">Flagged</option>
        <option value="dismissed">Dismissed</option>
      </select>

      <input
        type="number"
        placeholder="Max price"
        style={{ ...selectStyle, width: 110 }}
        value={filters.maxPrice || ''}
        onChange={(e) => update('maxPrice', e.target.value)}
      />

      {(filters.state || filters.source || filters.status || filters.maxPrice) && (
        <button
          onClick={() => onChange({})}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--brass)',
            fontFamily: 'var(--font-ui)',
            fontSize: 13,
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Clear filters
        </button>
      )}

      {sourceStatus && sourceStatus.length > 0 && (
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
          {sourceStatus.map((s) => (
            <div key={s.source} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--parchment-dim)' }}>
              {s.source}: {s.finished_at ? new Date(s.finished_at).toLocaleDateString() : 'never run'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
