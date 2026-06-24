# Galaxia Land Scout

Tracks dirt-cheap land for sale across Georgia, Alabama, and Mississippi — tax-deed/lien auctions (GovEase), retail listings (LandWatch, Land.com), and classifieds (Craigslist) — and surfaces it in a dashboard plus email alerts/digests.

Built for **Galaxia Investment** as part of a broader set of automated research bots (alongside the Stock News Bot).

## Status: skeleton (v1, phase 1)

This is the **backend + frontend skeleton**, built first on purpose. The scraper jobs for GovEase, Craigslist, LandWatch, and Land.com are stubbed — wired into the run-tracking and database system, but not yet doing real scraping. That's the next phase.

What's working right now:
- Full database schema (Postgres)
- API for listing/filtering/updating parcels
- Dashboard UI showing listings, stats, and source status
- Cron scheduler wired to the agreed cadence (GovEase daily, Craigslist/retail weekly)
- Manual job-trigger endpoint for testing

What's NOT built yet:
- Actual scraping logic inside each job file
- Email sending (SendGrid integration is stubbed in `.env.example` but no email-sending code yet)
- The "new GovEase sale posted" standalone alert logic
- The weekly digest email content/template

## Architecture

```
galaxia-land-scout/
├── backend/          Express API + Postgres + scraper jobs (deploy to Render)
│   ├── server.js
│   ├── db/            schema (init.js) + connection pool (pool.js)
│   ├── routes/         listings, sources, jobs (manual trigger)
│   └── jobs/           govease.js, craigslist.js, retail.js (all stubbed) + scheduler.js
└── frontend/          React dashboard (deploy to Vercel)
    └── src/
        ├── App.jsx
        ├── api.js       API client
        └── components/  StatCard, FilterBar, ListingsTable, PriceStamp
```

Same pattern as Stock News Bot: Express/Render backend, React/Vercel frontend, SendGrid for email.

## Data model

One `listings` table holds everything — GovEase parcels, retail listings, Craigslist posts — distinguished by a `source` column. Key fields: `state`, `county`, `price`, `acreage`, `listing_type` (`tax_deed` / `tax_lien` / `retail` / `classified`), `sale_date`, `status` (`new` / `reviewed` / `flagged` / `dismissed`).

A `scrape_runs` table logs every scraper execution (success/error, counts) so the dashboard can show "last checked" per source.

A `govease_sales_seen` table will track which county sales have already triggered an alert email, to avoid duplicate notifications.

## Local setup

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env: set DATABASE_URL to your local or Render Postgres connection string
npm run db:init    # creates the schema
npm run dev        # starts on :3001
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:3001 (or your deployed backend URL)
npm run dev        # starts on :5173
```

## Deployment (same pattern as Stock News Bot)

- **Backend → Render**: new Web Service pointed at `backend/`, add a Render Postgres instance, set `DATABASE_URL` env var from it, run `npm run db:init` once via Render shell.
- **Frontend → Vercel**: new project pointed at `frontend/`, set `VITE_API_URL` to the Render backend URL.

## Filter logic

- **Hard flag** (shows the "Flagged" stamp in the UI): price under $1,000
- **Soft flag**: retail listings notably below regional per-acre market — not yet implemented, will need a market-price reference point per county/region

## Next steps (in order)

1. Build real GovEase scraping logic — find counties currently running sales, pull public pre-bid parcel lists
2. Build Craigslist scraping logic across GA/AL/MS regional subdomains
3. Build LandWatch/Land.com scraping for lowest-price-tier listings
4. Build the weekly digest email (Craigslist + retail) using SendGrid
5. Build the GovEase "new sale posted" standalone alert email
6. Deploy backend to Render + Postgres, frontend to Vercel
7. Add manual review workflow polish (notes, dismiss, etc.) if needed once real data is flowing
