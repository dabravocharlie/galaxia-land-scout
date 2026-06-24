// jobs/jobHelpers.js
// Shared utilities used by every scraper job: run tracking + listing upsert.
const { pool } = require('../db/pool');

/**
 * Wraps a scraper job function with run-tracking: creates a scrape_runs row,
 * marks it success/error when done, and returns the result.
 *
 * @param {string} source - 'govease' | 'craigslist' | 'landwatch' | 'land_com'
 * @param {string|null} state - 'GA' | 'AL' | 'MS' | null for multi-state jobs
 * @param {Function} jobFn - async function that does the scraping, returns { listingsFound, newListings }
 */
async function runTrackedJob(source, state, jobFn) {
  const runResult = await pool.query(
    `INSERT INTO scrape_runs (source, state, status) VALUES ($1, $2, 'running') RETURNING id`,
    [source, state]
  );
  const runId = runResult.rows[0].id;

  try {
    const { listingsFound = 0, newListings = 0 } = await jobFn();
    await pool.query(
      `UPDATE scrape_runs
       SET finished_at = NOW(), status = 'success', listings_found = $1, new_listings = $2
       WHERE id = $3`,
      [listingsFound, newListings, runId]
    );
    console.log(`✅ [${source}${state ? '/' + state : ''}] run complete: ${listingsFound} found, ${newListings} new`);
    return { listingsFound, newListings };
  } catch (err) {
    await pool.query(
      `UPDATE scrape_runs SET finished_at = NOW(), status = 'error', error_message = $1 WHERE id = $2`,
      [err.message, runId]
    );
    console.error(`❌ [${source}${state ? '/' + state : ''}] run failed:`, err.message);
    throw err;
  }
}

/**
 * Upserts a single listing. Returns true if it was a new row, false if it
 * already existed (and was just refreshed / date_last_seen bumped).
 */
async function upsertListing(listing) {
  const {
    source, source_url, external_id, state, county, address, parcel_id,
    title, description, price, acreage, listing_type, sale_date
  } = listing;

  const result = await pool.query(
    `INSERT INTO listings (
       source, source_url, external_id, state, county, address, parcel_id,
       title, description, price, acreage, listing_type, sale_date
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     ON CONFLICT (source, external_id)
     DO UPDATE SET
       date_last_seen = NOW(),
       price = EXCLUDED.price,
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       updated_at = NOW()
     RETURNING (xmax = 0) AS inserted`,
    [source, source_url, external_id, state, county, address, parcel_id,
     title, description, price, acreage, listing_type, sale_date]
  );

  return result.rows[0].inserted;
}

module.exports = { runTrackedJob, upsertListing };
