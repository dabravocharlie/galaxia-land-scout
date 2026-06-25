// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const listingsRouter = require('./routes/listings');
const sourcesRouter = require('./routes/sources');
const jobsRouter = require('./routes/jobs');
const countiesRouter = require('./routes/counties');
const emailsRouter = require('./routes/emails');
const techStocksRouter = require('./routes/techstocks');
const businessesRouter = require('./routes/businesses');
const minervaRouter = require('./routes/minerva');
const portfolioRouter = require('./routes/portfolio');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'galaxia-land-scout-api' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/listings', listingsRouter);
app.use('/api/sources', sourcesRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/counties', countiesRouter);
app.use('/api/emails', emailsRouter);
app.use('/api/techstocks', techStocksRouter);
app.use('/api/businesses', businessesRouter);
app.use('/api/minerva', minervaRouter);
app.use('/api/portfolio', portfolioRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Galaxia Land Scout API running on port ${PORT}`);
  if (process.env.ENABLE_SCHEDULER !== 'false') {
    startScheduler();
  }
});
