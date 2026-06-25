// routes/jobs.js
// Manual trigger endpoints, useful for testing scrapers without waiting for
// the cron schedule. Not linked from the public dashboard UI by default.
const express = require('express');
const router = express.Router();
const { scrapeGovEase } = require('../jobs/govease');
const { scrapeCraigslist } = require('../jobs/craigslist');
const { scrapeLandWatch, scrapeLandCom, scrapeLandSearch } = require('../jobs/retail');
const { trackTaxSales } = require('../jobs/taxSaleTracker');
const { debugRetail } = require('../jobs/retailDebug');
const { discoverTechStocks } = require('../jobs/techDiscovery');
const { scrapeBusinesses, debugBusinesses } = require('../jobs/businesses');

const JOB_MAP = {
  govease: scrapeGovEase,
  craigslist: scrapeCraigslist,
  landwatch: scrapeLandWatch,
  landsearch: scrapeLandSearch,
  land_com: scrapeLandCom,
  tax_sale_tracker: trackTaxSales,
  tech_discovery: discoverTechStocks,
  businesses: scrapeBusinesses
};

// GET /api/jobs/debug/businesses — diagnostic for the BizBuySell scraper
router.get('/debug/businesses', async (req, res) => {
  try {
    const report = await debugBusinesses();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/jobs/debug/retail — diagnostic, returns what node-fetch sees.
// Browser-friendly (GET), so you can just open the URL.
router.get('/debug/retail', async (req, res) => {
  try {
    const report = await debugRetail();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/run/:jobName
router.post('/run/:jobName', async (req, res) => {
  const jobFn = JOB_MAP[req.params.jobName];
  if (!jobFn) {
    return res.status(404).json({
      error: `Unknown job '${req.params.jobName}'`,
      available: Object.keys(JOB_MAP)
    });
  }

  try {
    const result = await jobFn();
    res.json({ job: req.params.jobName, ...result });
  } catch (err) {
    res.status(500).json({ job: req.params.jobName, error: err.message });
  }
});

module.exports = router;
