# BrewLedger

A dashboard for tracking espresso extraction times from a Casadio Undici machine. It runs on Cloudflare Workers with D1 and Durable Objects.

## Features

- Receives extraction data through HTTP or WebSocket, authenticated with `API_KEY`.
- Provides a real-time dashboard through Durable Object WebSocket Hibernation.
- Lets users browse the full D1 history by date, without a 30-day history limit.
- Includes date-picker and previous/next-day controls. Shot-time filters apply to the selected date, and the shot log uses pagination.
- Supports analysis for a custom date range with five extraction-time groups: `<20s`, `20–25s`, `25–28s`, `28–30s`, and `>30s`.
- Shows daily consistency and 30-day consistency using the 24–27 second target range.
- Switches between a daily-average chart and a per-shot scatter chart with a fixed 0–40 second Y-axis and a 00:00–23:30 X-axis.

## Run locally

```bash
npm ci
npm run db:migrate:local
npx wrangler secret put API_KEY
npm run dev
```

## Test

```bash
npm run ci
```

## Deploy

```bash
npm run db:migrate:remote
npx wrangler deploy
```

Use `x-api-key` for `/api/ingest`. The `key` query parameter remains available for compatibility with the current firmware, but should be removed after the firmware has migrated to the header.
