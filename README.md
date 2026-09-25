# poker-pro

Minimal Next.js frontend for heads-up No-Limit Hold'em against the bot served by
[`poker-pro-BE`](https://github.com/Tho-phan/poker-pro-BE).

## Layout

- `app/page.tsx` — join form + table, wired up via `lib/useGame.ts`.
- `lib/useGame.ts` — owns the WebSocket connection and client-visible game state.
- `lib/protocol.ts` — the wire contract (`ClientMessage`/`ServerMessage`, wire
  types). This is a separate repo from the game server, so the contract is
  **mirrored here by hand** — keep it in sync with `packages/protocol` in
  `poker-pro-BE` when that changes.
- `components/` — `Table`, `PlayerSeat`, `PlayingCard`, `ActionBar`.

## Running locally

1. Start the game server (in `poker-pro-BE`):

   ```bash
   npm run build
   PORT=8080 npm start -w @poker-pro/server   # ws://localhost:8080
   ```

2. Start the frontend (in this repo):

   ```bash
   npm install
   npm run dev   # http://localhost:3000
   ```

   By default the app connects to `ws://localhost:8080`. To point at a
   different server, copy `.env.local.example` to `.env.local` and set
   `NEXT_PUBLIC_WS_URL`.

3. Open http://localhost:3000, sit down, and play — the server auto-deals the
   next hand once one finishes and stacks persist across hands for the
   connection's lifetime.
