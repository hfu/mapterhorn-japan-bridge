# mapterhorn-japan-bridge

An interim bridge that converts GSI's (国土地理院) 基盤地図情報 DEM data for
Japan into a [Mapterhorn](https://github.com/mapterhorn/mapterhorn)-format
terrain PMTiles archive (`japan.pmtiles`), priority-merged from six GSI
product types (1m, 5m×3, 10m×2) plus a global fallback — until upstream
Mapterhorn's own Japan source (`jpdem1a`) catches up with the same GSI
survey updates. Once it does, this whole effort is meant to be retirable.

**Live preview**: https://hfu.github.io/mapterhorn-japan-bridge/

## What's in this repo

This repo is the documentation home and preview viewer only — **no
data-processing pipeline lives here**. It holds:

- `index.html` / `app.js` / `style.json` — a MapLibre GL viewer for the
  current `japan.pmtiles` build (3D terrain toggle included).
- `CLAUDE.md` — how the pipeline operates day to day.
- `DECISIONS.md` — architecture decision records (the *why*).
- `HANDOVER.md` — session-by-session narrative (the *what happened*).

The actual pipeline lives in a separate repo,
[`hfu/mapterhorn`](https://github.com/hfu/mapterhorn) — a fork of
[`mapterhorn/mapterhorn`](https://github.com/mapterhorn/mapterhorn),
kept deliberately close to upstream. Source data comes from
[`smartmaps/japan-geotiff-dem`](https://source.coop/smartmaps/japan-geotiff-dem)
on Source Cooperative, itself produced by
[`optgeo/japan-geotiff-dem`](https://github.com/optgeo/japan-geotiff-dem).

## Data

- **Source**: GSI (国土地理院) 基盤地図情報 DEM — 1m (DEM1A, airborne
  laser), 5m (DEM5A laser / DEM5B / DEM5C photogrammetry fallbacks),
  10m (DEM10A / DEM10B), plus Copernicus GLO-30 as a universal fallback
  for areas GSI hasn't surveyed.
- **Priority order**: 1m > 5a > 5b > 5c > 10a > 10b > sea, merged at
  the pixel level (see `DECISIONS.md` D18/D20 for how and why).
- **Format**: PMTiles, Terrarium RGB elevation encoding.
- **License / attribution**: GSI data used under 測量法に基づく国土地理院長承認
  (Approval for Reproduction pursuant to the Survey Act). See
  `japan-geotiff-dem`'s own README for the current approval number and
  full attribution text — that repo is the canonical source for
  GSI-data licensing terms, not duplicated here.

## License

Code and documentation in this repo (viewer, docs) are released under
[CC0 1.0](LICENSE) — public domain, no rights reserved. This does
**not** apply to the GSI-derived elevation data itself, which carries
its own Survey Act approval and attribution requirements (see above);
CC0 here covers only what this specific repo contributes (the viewer
code and documentation).
