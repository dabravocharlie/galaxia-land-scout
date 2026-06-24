// db/init.js
// Run once to set up the database schema: npm run db:init
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,

  -- Source tracking
  source TEXT NOT NULL,              -- 'govease' | 'craigslist' | 'landwatch' | 'land_com'
  source_url TEXT NOT NULL,
  external_id TEXT,                  -- source's own listing/parcel id, for dedup

  -- Location
  state TEXT NOT NULL,               -- 'GA' | 'AL' | 'MS'
  county TEXT,                       -- relevant mainly for govease
  address TEXT,
  parcel_id TEXT,                    -- tax parcel number, govease listings

  -- Listing details
  title TEXT,
  description TEXT,
  price NUMERIC,                     -- opening bid or asking price, in dollars
  acreage NUMERIC,
  listing_type TEXT,                 -- 'tax_deed' | 'tax_lien' | 'retail' | 'classified'

  -- Dates
  sale_date DATE,                    -- for govease auctions
  date_found TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Workflow
  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'flagged' | 'dismissed' | 'archived'
  flag_reason TEXT,                    -- 'under_threshold' | 'below_market' | NULL
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(source, external_id)
);

CREATE INDEX IF NOT EXISTS idx_listings_state ON listings(state);
CREATE INDEX IF NOT EXISTS idx_listings_source ON listings(source);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price);
CREATE INDEX IF NOT EXISTS idx_listings_date_found ON listings(date_found);

-- Tracks each scraper run so the dashboard can show "last checked" per source
CREATE TABLE IF NOT EXISTS scrape_runs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  state TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error'
  listings_found INTEGER DEFAULT 0,
  new_listings INTEGER DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_scrape_runs_source ON scrape_runs(source);

-- Tracks which GovEase county sales we've already alerted on, so we don't
-- send duplicate "new sale posted" emails
CREATE TABLE IF NOT EXISTS govease_sales_seen (
  id SERIAL PRIMARY KEY,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  sale_date DATE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  alert_sent BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(state, county, sale_date)
);

-- Tax Sale Tracker: watches county tax-sale pages for changes rather than
-- parsing parcels. Each row is one county page we monitor. When the content
-- fingerprint changes, we flag it and queue an alert for manual review.
CREATE TABLE IF NOT EXISTS county_watch (
  id SERIAL PRIMARY KEY,
  county TEXT NOT NULL,
  state TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT,                       -- 'government_window' | 'revize' | 'custom' | etc (informational)

  -- Change detection
  content_hash TEXT,                   -- fingerprint of last-seen meaningful content
  content_snippet TEXT,                -- short human-readable excerpt of what we're tracking
  pdf_links TEXT,                      -- JSON array of any PDF links found on the page

  -- Status
  last_checked_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  change_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  alert_pending BOOLEAN NOT NULL DEFAULT FALSE,  -- true when changed & not yet reviewed
  alert_emailed BOOLEAN NOT NULL DEFAULT FALSE,  -- true once we've emailed about this change

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(county, state)
);

-- For databases created before alert_emailed existed, add it idempotently.
ALTER TABLE county_watch ADD COLUMN IF NOT EXISTS alert_emailed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_county_watch_state ON county_watch(state);
CREATE INDEX IF NOT EXISTS idx_county_watch_alert ON county_watch(alert_pending);

-- Tech Stocks: notable tech names surfaced by the discovery job (Anthropic API
-- + web search). Discovery-only for now — no fixed watchlist. Deduped by ticker
-- so a name resurfacing just refreshes its reason/last_seen rather than dupes.
CREATE TABLE IF NOT EXISTS tech_stocks (
  id SERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  company TEXT,
  category TEXT,                 -- 'mover' | 'upgrade' | 'earnings' | 'emerging' | 'product' | 'other'
  reason TEXT,                   -- one-line why-notable from the discovery run
  source_url TEXT,               -- citation link if provided

  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_seen INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'watching' | 'reviewed' | 'dismissed'
  notes TEXT,
  emailed BOOLEAN NOT NULL DEFAULT FALSE,  -- included in a digest yet?

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticker)
);

CREATE INDEX IF NOT EXISTS idx_tech_stocks_status ON tech_stocks(status);
CREATE INDEX IF NOT EXISTS idx_tech_stocks_seen ON tech_stocks(last_seen_at);
`;

async function init() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Running schema...');
    await client.query(SCHEMA);
    console.log('✅ Database schema initialized successfully.');
  } catch (err) {
    console.error('❌ Error initializing schema:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  init();
}

module.exports = { pool };
