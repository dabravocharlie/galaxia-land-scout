// emails/layout.js
// Shared HTML shell for emails. Email clients are picky (no external CSS,
// limited support), so everything is inline styles and tables. We echo the
// dashboard's ledger/parchment palette but keep it email-safe.

function money(n) {
  if (n === null || n === undefined) return '—';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrap({ title, intro, bodyHtml }) {
  return `
  <div style="background:#1A1C1A;padding:24px 0;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:640px;margin:0 auto;background:#232520;border:1px solid #34362F;">
      <div style="padding:24px 28px;border-bottom:1px solid #34362F;">
        <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B8893F;margin-bottom:6px;">
          Galaxia Investment
        </div>
        <div style="font-size:26px;font-weight:bold;color:#E8E4D9;">${escapeHtml(title)}</div>
        ${intro ? `<div style="font-size:14px;color:#A8A395;margin-top:8px;">${intro}</div>` : ''}
      </div>
      <div style="padding:20px 28px;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #34362F;font-family:Arial,sans-serif;font-size:11px;color:#A8A395;">
        Galaxia Land Scout · automated report ·
        <a href="https://galaxia-land-scout.vercel.app" style="color:#B8893F;text-decoration:none;">open dashboard</a>
      </div>
    </div>
  </div>`;
}

module.exports = { wrap, money, escapeHtml };
