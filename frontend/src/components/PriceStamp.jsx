// src/components/PriceStamp.jsx
// The signature element of this design: listings under the $1,000 threshold
// get a hand-stamped "FLAGGED" treatment, like a courthouse ledger entry
// that's been rubber-stamped for attention. Everything else reads as plain
// ledger text — the stamp only fires when it means something.

const THRESHOLD = 1000;

export default function PriceStamp({ price, listingType }) {
  if (price === null || price === undefined) {
    return <span style={{ color: 'var(--parchment-dim)', fontFamily: 'var(--font-mono)' }}>—</span>;
  }

  const isUnderThreshold = Number(price) < THRESHOLD;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);

  if (!isUnderThreshold) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--parchment)' }}>
        {formatted}
      </span>
    );
  }

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--rust-bright)',
        }}
      >
        {formatted}
      </span>
      <span
        aria-label="Under threshold"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--rust-bright)',
          border: '1.5px solid var(--rust-bright)',
          borderRadius: 2,
          padding: '2px 5px',
          transform: 'rotate(-4deg)',
          opacity: 0.85,
        }}
      >
        Flagged
      </span>
    </span>
  );
}
