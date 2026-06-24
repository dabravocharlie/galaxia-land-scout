// jobs/retailDebug.js
// Diagnostic: fetches one page from each retail source THROUGH ScraperAPI and
// reports what comes back, so we can confirm the key works and listings are
// present before running the full job.

async function debugRetail() {
  const fetch = (await import('node-fetch')).default;
  const key = process.env.SCRAPERAPI_KEY;

  const targets = [
    { name: 'landsearch', url: 'https://www.landsearch.com/properties/georgia/search/under-10000' },
    { name: 'landwatch',  url: 'https://www.landwatch.com/georgia-land-for-sale/price-under-49999' },
  ];

  const report = { scraperApiKeySet: !!key };

  if (!key) {
    report.note = 'SCRAPERAPI_KEY not set — add it as an env var in Render.';
    return report;
  }

  for (const t of targets) {
    try {
      const wrapped = `https://api.scraperapi.com/?${new URLSearchParams({ api_key: key, url: t.url, render: 'true', ultra_premium: 'true' })}`;
      const res = await fetch(wrapped, { timeout: 70000 });
      const html = await res.text();

      report[t.name] = {
        status: res.status,
        htmlLength: html.length,
        hasPropertiesLinks: (html.match(/\/properties\/[^"']+\/\d+/g) || []).length,
        hasPidLinks: (html.match(/\/pid\/\d+/g) || []).length,
        looksBlocked: /access denied|verification required|captcha/i.test(html),
        snippet: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300),
      };
    } catch (err) {
      report[t.name] = { error: err.message };
    }
  }

  return report;
}

module.exports = { debugRetail };
