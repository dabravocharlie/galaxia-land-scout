// jobs/govease.js
// Scrapes GovEase county tax sale listings for GA, AL, MS.
//
// STATUS: STUBBED. This file is wired into the run-tracking system and ready
// to be filled in with real scraping logic once the skeleton is confirmed
// working end-to-end. See jobHelpers.js for runTrackedJob / upsertListing.
//
// Real implementation will need to:
//   1. Fetch the list of GA/AL/MS counties currently running sales on GovEase
//   2. For each county, fetch its public (pre-bidding) parcel list
//   3. Parse parcel ID, address, opening bid, sale date
//   4. upsertListing() each one, tagged listing_type: 'tax_deed' or 'tax_lien'
//   5. After the run, check govease_sales_seen to detect newly-posted county
//      sales (not previously seen) and trigger the standalone alert email
//      for those, rather than waiting for the weekly digest.

const { runTrackedJob, upsertListing } = require('./jobHelpers');

const TARGET_STATES = ['GA', 'AL', 'MS'];

async function scrapeGovEase() {
  return runTrackedJob('govease', null, async () => {
    let listingsFound = 0;
    let newListings = 0;

    // TODO: real scraping logic per state goes here.
    // Placeholder loop just demonstrates the shape.
    for (const state of TARGET_STATES) {
      console.log(`[govease] (stub) would check ${state} counties here`);
      // const counties = await fetchGovEaseCounties(state);
      // for (const county of counties) {
      //   const parcels = await fetchCountyParcelList(county);
      //   for (const parcel of parcels) {
      //     const isNew = await upsertListing({ source: 'govease', state, ...parcel });
      //     listingsFound++;
      //     if (isNew) newListings++;
      //   }
      // }
    }

    return { listingsFound, newListings };
  });
}

module.exports = { scrapeGovEase };
