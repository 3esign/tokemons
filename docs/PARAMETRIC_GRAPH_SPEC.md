# Tokemons Parametric Graph Specification (`.tokemongh`)

Grasshopper-inspired DAG format for all procedural content.

## File format

```json
{
  "version": 1,
  "id": "world_biome_base",
  "inputs": [{ "name": "worldSeed", "type": "u64" }],
  "nodes": [...],
  "outputs": [{ "name": "biomeId", "from": "node_biome", "port": "out" }]
}
```

## Port types

| Type | Description |
|------|-------------|
| `u64` | Seed integer |
| `f32` | Scalar field sample |
| `vec2` | 2D vector |
| `bool` | Mask |
| `tileId` | Resolved tile index |
| `biomeId` | Enum string |
| `spriteRef` | Baked sprite handle |

## Node definition

```json
{
  "id": "n_moisture",
  "type": "FBm",
  "params": { "octaves": 4, "lacunarity": 2, "gain": 0.5, "frequency": 0.02 },
  "inputs": {
    "seed": { "node": "n_seed", "port": "out" },
    "x": { "node": "n_coord", "port": "x" },
    "y": { "node": "n_coord", "port": "y" }
  }
}
```

## Standard library (MVP)

### Sources
- **Seed** — `worldSeed ⊕ salt`
- **CellCoord** — chunk-local `x,y` from context
- **Constant**

### Fields
- **Perlin2D**, **Simplex2D**, **Worley2D**
- **FBm** — fractal sum of Perlin
- **DomainWarp** — offset sample coords by noise

### Operators
- **Remap** — input min/max → output min/max
- **Curve** — piecewise linear or bezier keys
- **Threshold** — `f32 → bool`
- **Blend** — lerp by mask

### World
- **BiomeClassifier** — temp, moisture, elevation → `biomeId`
- **TilePicker** — weighted table from biome + sub-noise
- **Scatter** — Poisson/Worley prop placement
- **TownGrammar** — expand L-system / grammar rules

### Tokemon
- **RigTemplate** — `bodyPlan` + gene ports
- **MorphStage** — `stage = floor(morph * 9)`
- **PaletteMap** — genes → 4 GB colors
- **Rasterize** — vector rig → sprite bitmap

### Emit
- **EmitTile** — writes to cell `groundTileId`
- **EmitProp** — `overlay` / `structure`
- **EmitWild** — encounter slot

## Evaluation context

```ts
interface EvalContext {
  worldSeed: bigint;
  chunkX: number;
  chunkY: number;
  localX: number;  // 0..chunkSize-1
  localY: number;
  playerX?: number;
  playerY?: number;
}
```

## Cell seed derivation

```
cellSeed = murmur64(worldSeed, chunkX, chunkY, localX, localY, graphSalt)
```

All stochastic rolls use `cellSeed` — never `Math.random()` without seeding.

## Graph composition

Graphs can **import** subgraphs:

```json
{ "type": "SubGraph", "params": { "path": "terrain_meadow.tokemongh" } }
```

Parent passes through `EvalContext`; child exposes outputs as ports.

## Designer workflow (later)

1. Visual editor exports `.tokemongh`
2. `bake-chunk.ts` renders PNG preview per chunk
3. CI diff detects accidental graph drift

## Example: moisture field snippet

```
Seed(worldSeed) ──┬──> FBm(freq=0.01) ──> Remap(0,1) ──> moisture
CellCoord(x,y) ───┘
```

## Example: evolution morph

```
genes.mass ──> Curve(keys evolution_mass) ──┐
evolutionStage (0..9) ──> Normalize(0,9) ──┼──> Lerp ──> limbScale
genes.limbCount ───────────────────────────┘
```

---

See `assets/graphs/world_biome_base.tokemongh` (Phase 0 deliverable).
