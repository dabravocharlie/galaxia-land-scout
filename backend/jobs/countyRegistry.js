// jobs/countyRegistry.js
// The list of county tax-sale pages the tracker monitors for changes.
// Adding a new county is just adding one entry here — no new code needed.
//
// Focus: metro Atlanta (high volume) + middle/south Georgia (cheaper rural
// parcels, which is where sub-$1,000 land actually shows up).
//
// Many of these run on the "Government Window" vendor platform and share the
// same /tax-sales.html URL pattern, but the tracker doesn't care about the
// platform — it just watches each URL for changes.

const COUNTIES = [
  // --- Metro Atlanta ---
  { county: 'Cobb',       state: 'GA', url: 'https://www.cobbtax.gov/property/tax_sale/index.php', platform: 'revize' },
  { county: 'DeKalb',     state: 'GA', url: 'https://dekalbtax.org/property-tax/tax-sales/',        platform: 'custom' },
  { county: 'Fulton',     state: 'GA', url: 'https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales', platform: 'custom' },
  { county: 'Clayton',    state: 'GA', url: 'https://www.claytoncountyga.gov/government/tax-commissioner/', platform: 'custom' },
  { county: 'Coweta',     state: 'GA', url: 'https://www.cowetataxcom.com/tax-sales.html',          platform: 'government_window' },
  { county: 'Fayette',    state: 'GA', url: 'https://www.fayettecountypay.com/tax-sales.html',       platform: 'government_window' },
  { county: 'Henry',      state: 'GA', url: 'https://henrycountytax.com/172/Property-for-Sale',       platform: 'custom' },

  // --- Middle Georgia ---
  { county: 'Bibb',       state: 'GA', url: 'https://www.maconbibbtax.us/tax-sales.html',            platform: 'government_window' },
  { county: 'Houston',    state: 'GA', url: 'https://www.houstoncountyga.org/residents/tax-commissioner.cms', platform: 'custom' },
  { county: 'Sumter',     state: 'GA', url: 'https://www.sumtercountygatax.com/tax-sales.html',      platform: 'government_window' },

  // --- South Georgia (cheaper rural parcels) ---
  { county: 'Lowndes',    state: 'GA', url: 'https://lowndescountytax.com/',                         platform: 'government_window' },
  { county: 'Colquitt',   state: 'GA', url: 'https://www.colquittcountytax.com/',                    platform: 'custom' },
  { county: 'Thomas',     state: 'GA', url: 'https://www.thomascountytax.com/tax-sales.html',        platform: 'government_window' },
  { county: 'Tift',       state: 'GA', url: 'https://www.tiftcounty.org/government/tax_commissioner/index.php', platform: 'custom' },
  { county: 'Ware',       state: 'GA', url: 'https://www.warecountytax.com/tax-sales.html',          platform: 'government_window' },
  { county: 'Glynn',      state: 'GA', url: 'https://www.glynntaxoffice.org/property/delinquent_tax/index.php', platform: 'custom' },
];

module.exports = { COUNTIES };
