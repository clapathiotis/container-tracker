# Container Tracker

Live container shipment tracking with a route map and movement ledger —
built for sending trackable shipment links by email.

## Stack

- React + TypeScript + Vite
- Leaflet / react-leaflet for the route map
- Supabase (Postgres + Auth) for data and admin login

## Structure

- `/` — landing page
- `/t/:slug` — public tracking page (the link you send by email)
- `/admin` — sign in and manage shipments/movements

## Local development

```bash
npm install
cp .env.example .env   # fill in your Supabase project URL + publishable key
npm run dev
```

## Deployment

Pushing to `main` builds and deploys automatically to GitHub Pages via
`.github/workflows/deploy.yml`. Set these repo secrets first:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`.

## Database

Two tables in Supabase: `shipments` and `shipment_stops` (ordered waypoints
per shipment — origin, transshipment ports, destination). Row Level Security
allows public read (so tracking links work without login) and restricts
writes to authenticated admin users.
