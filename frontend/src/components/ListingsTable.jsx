// src/components/ListingsTable.jsx
import PriceStamp from './PriceStamp';

const SOURCE_LABELS = {
  govease: 'GovEase',
  craigslist: 'Craigslist',
  landwatch: 'LandWatch',
  landsearch: 'LandSearch',
  land_com: 'Land.com',
};

const STATUS_COLORS = {
  new: 'var(--brass)',
  reviewed: 'var(--sage)',
  flagged: 'var(--rust-bright)',
  dismissed: 'var(--parchment-dim)',
  archived: 'var(--parchment-dim)',
};

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ListingsTable({ listings, loading, onSelect }) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--parchment-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
        Pulling the ledger...
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px dashed var(--ink-line)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--parchment)', marginBottom: 8 }}>
          No entries yet
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--parchment-dim)', maxWidth: 380, margin: '0 auto' }}>
          Once the scrapers run, parcels matching your filters will appear here.
          Nothing has been collected for this view yet.
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--ink-line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--ink-line)' }}>
            {['State', 'County', 'Title', 'Source', 'Type', 'Price', 'Acreage', 'Sale Date', 'Found', 'Status', 'View'].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '10px 16px',
                  fontFamily: 'var(--font-ui)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--parchment-dim)',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {listings.map((listing, idx) => (
            <tr
              key={listing.id}
              onClick={() => onSelect?.(listing)}
              style={{
                borderBottom: '1px solid var(--ink-line)',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                cursor: onSelect ? 'pointer' : 'default',
              }}
            >
              <td style={cellStyle}>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{listing.state}</span>
              </td>
              <td style={cellStyle}>{listing.county || '-'}</td>
              <td style={{ ...cellStyle, maxWidth: 260 }}>
                <span
                  title={listing.title || ''}
                  style={{
                    display: 'block',
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-serif)',
                  }}
                >
                  {listing.title || '-'}
                </span>
              </td>
              <td style={cellStyle}>{SOURCE_LABELS[listing.source] || listing.source}</td>
              <td style={{ ...cellStyle, color: 'var(--parchment-dim)', fontSize: 12 }}>
                {listing.listing_type ? listing.listing_type.replace('_', ' ') : '-'}
              </td>
              <td style={cellStyle}>
                <PriceStamp price={listing.price} listingType={listing.listing_type} />
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)' }}>
                {listing.acreage ? `${listing.acreage} ac` : '-'}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                {formatDate(listing.sale_date)}
              </td>
              <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--parchment-dim)' }}>
                {formatDate(listing.date_found)}
              </td>
              <td style={cellStyle}>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 11,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: STATUS_COLORS[listing.status] || 'var(--parchment-dim)',
                  }}
                >
                  * {listing.status}
                </span>
              </td>
              <td style={cellStyle}>
                {listing.source_url ? (
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontFamily: 'var(--font-ui)',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--brass)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      borderBottom: '1px solid var(--brass-dim)',
                    }}
                  >
                    View >>
                  </a>
                ) : (
                  <span style={{ color: 'var(--parchment-dim)' }}>-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const cellStyle = {
  padding: '10px 16px',
  fontSize: 13,
  color: 'var(--parchment)',
  verticalAlign: 'middle',
};
