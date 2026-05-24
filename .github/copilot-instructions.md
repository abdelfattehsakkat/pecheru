# Copilot Instructions — FishCall

This is the FishCall project. Full context is in [.github/CONTEXT.md](.github/CONTEXT.md).

## Quick reference

- **Start dev server:** `npm start` (or `node --watch server.js`)
- **Generate VAPID keys:** `npm run generate-vapid`
- **Default admin password:** `fishcall2024` (set via `ADMIN_PASSWORD` in `.env`)

## Code style
- CommonJS (`require`/`module.exports`) — no ESM
- `'use strict'` at the top of every file
- Fastify route handlers are `async` functions
- No external ORM — raw better-sqlite3 prepared statements
- Input validation via Fastify JSON Schema, not manual checks

## Testing
- Run `node server.js` and test with `curl` or the browser
- Always test auth: unauthenticated requests to `/api/admin/*` must return 401
- Always verify stock deduction after a reservation
