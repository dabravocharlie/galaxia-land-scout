// jobs/scheduler.js
// Wires each scraper job to its cadence:
//   - Tax Sale Tracker: checks county tax-sale pages for changes 3x/week
//     (Mon/Wed/Fri). When a county posts a new sale list, it flags an alert
//     for manual review.
//   - Craigslist + retail (LandWatch/Land.com): checked weekly, feeds the
//     weekly digest email.
//
// Cron schedules are in the server's local time. Render runs in UTC by
// default - adjust if you want these aligned to Eastern time specifically.

const cron = require('node-cron');
const { scrapeCraigslist } = require('./craigslist');
const { scrapeLandWatch, scrapeLandCom, scrapeLandSearch } = require('./retail');
const { trackTaxSales } = require('./taxSaleTracker');
const { sendWeeklyDigest } = require('../emails/weeklyDigest');
const { sendTrackerAlert } = require('../emails/trackerAlert');
const { discoverTechStocks } = require('./techDiscovery');
const { sendTechDigest } = require('../emails/techDigest');
const { scrapeBusinesses } = require('./businesses');
const { sendBusinessDigest } = require('../emails/businessDigest');
// const { sendTrackerAlert } = require('../emails/trackerAlert'); // TODO: build with email layer
// const { sendWeeklyDigest } = require('../emails/weeklyDigest'); // TODO: build with email layer

function startScheduler() {
  // Tax sale tracker - Mon/Wed/Fri at 7:00 AM server time
  cron.schedule('0 7 * * 1,3,5', async () => {
    console.log('[scheduler] Running tax sale tracker...');
    try {
      await trackTaxSales();
      // Email a one-time alert for any counties that newly changed.
      await sendTrackerAlert();
    } catch (err) {
      console.error('[scheduler] Tax sale tracker failed:', err.message);
    }
  });

  // Craigslist check - weekly, Monday 7:00 AM server time
  cron.schedule('0 7 * * 1', async () => {
    console.log('[scheduler] Running weekly Craigslist check...');
    try {
      await scrapeCraigslist();
      // Retail scrapers (LandSearch/LandWatch) DISABLED — both sites require
      // ScraperAPI's paid premium proxy pools to get past their anti-bot
      // blocks, which the free tier doesn't include. Code is left intact;
      // re-enable these two lines (and ensure a paid SCRAPERAPI_KEY) to resume.
      // await scrapeLandSearch();
      // await scrapeLandWatch();
      await sendWeeklyDigest();
    } catch (err) {
      console.error('[scheduler] Weekly check failed:', err.message);
    }
  });

  // Tech stock discovery + digest - weekly, Monday 8:00 AM server time
  // (an hour after the land digest, so the two emails don't arrive together)
  cron.schedule('0 8 * * 1', async () => {
    console.log('[scheduler] Running weekly tech discovery...');
    try {
      await discoverTechStocks();
      await sendTechDigest();
    } catch (err) {
      console.error('[scheduler] Tech discovery failed:', err.message);
    }
  });

  // Cheap businesses scrape + digest - weekly, Monday 9:00 AM server time
  cron.schedule('0 9 * * 1', async () => {
    console.log('[scheduler] Running weekly businesses scrape...');
    try {
      await scrapeBusinesses();
      await sendBusinessDigest();
    } catch (err) {
      console.error('[scheduler] Businesses scrape failed:', err.message);
    }
  });

  console.log('✅ Scheduler started: tracker Mon/Wed/Fri @ 7am, Craigslist+digest Mon @ 7am, tech Mon @ 8am, businesses Mon @ 9am');
}

module.exports = { startScheduler };
