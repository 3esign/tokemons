# Agent Guide

Tokemons is a Vite + Phaser browser game with deterministic procedural systems. Keep changes small, deterministic, and easy to inspect.

## Project Map

- `packages/client`: Phaser game, UI panels, rendering, save flow.
- `packages/kernel`: deterministic world sampler, biomes, noise, cell contracts.
- `packages/tokemon-gen`: Tokemon genes, names, sprite baking.
- `api`: serverless chat endpoints for hosted AI providers.
- `docs`: architecture, deployment, budget, and roadmap notes.

## Current Gameplay Flow

1. `BootScene` shows a short title/preview.
2. `CreateScene` always lets the player generate a Tokemon.
3. `ENTER` starts a new run; `C` continues only when a save exists.
4. `RESET` and `L` clear save data and memory.
5. `PlayScene` draws the world from `@tokemons/kernel`, follows the player, and records memory.

## Engineering Rules

- Procedural output must be derived from `worldSeed` and cell coordinates. Do not use `Math.random()` in world sampling.
- Keep browser API keys out of production bundles. Use the serverless proxy for hosted providers.
- Prefer extending `WorldCell` and `sampleCell()` before adding client-only world hacks.
- Keep render work inside the active viewport budget in `docs/CONTENT_BUDGET.md`.
- If a save format changes, bump the save version in `packages/client/src/game/state.ts` and migrate old saves.

## Verification

Run from repo root unless noted:

```bash
npm run build
npm test
npm run dev
```

For quick client-only checks:

```bash
npm run build -w @tokemons/client
```
