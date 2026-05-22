# Tokemons - Web deployment (Vercel & GitHub Pages)

Tokemons is a **static web game** (Vite + Phaser) with optional **serverless AI** on Vercel.

## Architecture

| Piece | Host | Notes |
|-------|------|--------|
| Game client | Vercel or GitHub Pages | Static `packages/client/dist` |
| Procedural kernel | Bundled in client | `@tokemons/kernel` compiled by Vite |
| OpenRouter | Vercel `/api/chat` only | Never put API keys in the browser |

## Local development

```bash
npm install
npm run dev
```

Opens Vite at `http://localhost:5173` - procedural biome debug map, WASD to pan, `R` to reseed.

### AI chat (local)

1. Copy `.env.example` -> `.env` and set `OPENROUTER_API_KEY`.
2. From repo root: `npx vercel dev` (serves `/api/chat` + can proxy the Vite app).
3. Or deploy to Vercel preview and test there.

Client calls:

```ts
await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'openrouter/auto',
    messages: [{ role: 'user', content: 'Hello from the meadow.' }],
  }),
});
```

## Vercel

1. Import the GitHub repo in [vercel.com](https://vercel.com).
2. **Root directory:** repository root (default).
3. Build uses root `vercel.json`:
   - `installCommand`: `npm ci`
   - `buildCommand`: `npm run build`
   - `outputDirectory`: `packages/client/dist`
4. **Environment variables** (Production + Preview):
   - `OPENROUTER_API_KEY` - your OpenRouter key
5. Deploy. Game at `/`, API at `/api/chat`.

`VITE_BASE_PATH` defaults to `/` on Vercel (no change needed).

## GitHub Pages

1. Repo -> **Settings -> Pages -> Build and deployment -> GitHub Actions**.
2. Push to `main`; workflow `.github/workflows/deploy-pages.yml` runs.
3. Site URL: `https://<user>.github.io/<repo-name>/`

The workflow sets `VITE_BASE_PATH=/<repo-name>/` so assets resolve correctly.

**Note:** GitHub Pages is **static only**. AI chat requires either:

- A separate Vercel project for `/api/chat` with CORS, or
- Phase 3+ GitHub Actions-less approach: user brings own key in dev only (not recommended for production).

Recommended: **game on Pages, API on Vercel** (same or subdomain) when you need chat in production.

## Environment variables

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENROUTER_API_KEY` | Vercel server only | Proxy to OpenRouter |
| `VITE_BASE_PATH` | Build time | Asset prefix (`/` or `/repo/`) |
| `VITE_API_BASE` | Optional client | Override API origin if API is on another host |

## Build commands

```bash
npm run build          # kernel + Tokemon generator + client
npm run ci             # tests + full production build
npm run build -w @tokemons/client   # client only
npm run preview -w @tokemons/client # local static preview
```

## Checklist before publish

- [ ] `npm run build` succeeds
- [ ] Playable in browser (biome map moves)
- [ ] `OPENROUTER_API_KEY` set on Vercel if using chat
- [ ] For Pages: enable GitHub Actions as Pages source
- [ ] For Pages: confirm `VITE_BASE_PATH` matches repo name
