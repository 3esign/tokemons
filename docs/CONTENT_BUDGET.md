# Content And Performance Budget

This document is the working budget for procedural detail. It keeps the game readable and publishable while the world grows.

## Viewport Budget

- Canvas mode: Phaser `RESIZE`, fills the browser viewport.
- Tile size: `16px`.
- Visible cells: approximately `(viewport width / 16) * (viewport height / 16)`.
- Target desktop viewport: under 9,000 visible cells.
- Target mobile/tablet viewport: under 4,000 visible cells.

## Per-Cell Budget

Each visible cell may have:

- one base biome fill
- one ground detail mark
- one prop or vegetation object
- one placed block override

Avoid multi-pass effects across the whole map unless they are bounded to the visible viewport.

## Procedural Fields

Current seeded fields in `sampleCell()`:

- elevation
- moisture
- temperature
- weirdness
- settlement
- vegetation

Add new fields only when they create a distinct gameplay or visual purpose. Reuse existing fields for simple palette or prop variation.

## Biome Budget

Current biome families:

- ocean/coast
- meadow/deep forest/wetland
- mountain/snowfield
- desert
- crystal fields
- ancient ruins
- urban fringe/town core

Before adding a biome, define:

- color palette
- walkability rules
- 2-4 props or vegetation types
- memory/chat name
- how it differs from existing biomes

## Prop Budget

Props should be low-cost pixel marks drawn with Phaser graphics. Use sprites only for entities or objects that need animation.

Current prop families:

- obstacles: tree, rock, cactus, crystal, ruin, pine
- vegetation: tall grass, fern, bush, berry bush, vine, reeds, lily, scrub, blossom
- flavor: shell, mushroom, lamp, sign, snowdrift

## Future Detail Hooks

- animated water shimmer using sparse per-tile marks
- biome transition bands
- landmark rooms generated from chunk-level seeds
- prop clustering using vegetation/settlement thresholds
- creature encounters tied to biome + memory state
