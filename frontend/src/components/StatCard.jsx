// src/components/StatCard.jsx
export default function StatCard({ label, value, accent }) {
  return (
    <div
      style={{
        background: 'var(--ink-raised)',
        border: '1px solid var(--ink-line)',
        padding: '16px 20px',
        minWidth: 120,
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--parchment-dim)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 32,
          fontWeight: 600,
          color: accent || 'var(--parchment)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  );
}
