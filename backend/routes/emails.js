// routes/emails.js
// Manual email triggers, for testing the digest/alert without waiting for cron.
const express = require('express');
const router = express.Router();
const { sendWeeklyDigest } = require('../emails/weeklyDigest');
const { sendTrackerAlert } = require('../emails/trackerAlert');
const { sendTechDigest } = require('../emails/techDigest');
const { sendBusinessDigest } = require('../emails/businessDigest');

// POST /api/emails/send/digest — send the weekly digest now
router.post('/send/digest', async (req, res) => {
  try {
    const result = await sendWeeklyDigest();
    res.json({ email: 'weekly_digest', ...result });
  } catch (err) {
    res.status(500).json({ email: 'weekly_digest', error: err.message });
  }
});

// POST /api/emails/send/alert — send the tracker alert now (if any pending)
router.post('/send/alert', async (req, res) => {
  try {
    const result = await sendTrackerAlert();
    res.json({ email: 'tracker_alert', ...result });
  } catch (err) {
    res.status(500).json({ email: 'tracker_alert', error: err.message });
  }
});

// POST /api/emails/send/tech — send the tech stock digest now
router.post('/send/tech', async (req, res) => {
  try {
    const result = await sendTechDigest();
    res.json({ email: 'tech_digest', ...result });
  } catch (err) {
    res.status(500).json({ email: 'tech_digest', error: err.message });
  }
});

// POST /api/emails/send/business — send the cheap-businesses digest now
router.post('/send/business', async (req, res) => {
  try {
    const result = await sendBusinessDigest();
    res.json({ email: 'business_digest', ...result });
  } catch (err) {
    res.status(500).json({ email: 'business_digest', error: err.message });
  }
});

module.exports = router;
