# CLAUDE.md

Guidance for Claude working on this repository.

**Doc map**: this file is *how to operate* day to day. `DECISIONS.md`
is *why* things are the way they are (ADR log). `HANDOVER.md` is *what
happened*, session by session, and what to do first if resuming cold.

## Language policy

Converse with Hidenori (chat, CLI turns, questions) in **Japanese**.
Everything that lands in the repository — code, comments, `.md` prose,
commit messages — stays in **English**, matching the `optgeo`/`hfu`
family of sibling repos. Don't mix.

## Mission

Produce Mapterhorn-format terrain tiles (PMTiles, Terrarium encoding)
for Japan, as an **interim bridge** until upstream
`mapterhorn/mapterhorn`'s own Japan 1m source (`jpdem1a`) picks up a
2026-07-31 GSI DEM1A survey update for Hokkaido. Once upstream catches
up, this whole effort — this repo, the `hfu/mapterhorn` source-catalog
entries it depends on, the `smartmaps/mapterhorn-japan-bridge` Source
Cooperative product — should be considered retirable.

This repo itself contains **no data-processing pipeline**. It's the
documentation home for the bridge effort as a whole, plus a GitHub
Pages preview viewer. The actual pipeline lives in `hfu/mapterhorn`
(see below) — deliberately kept there separately, not merged into
this repo or vice versa.

## The four-way split (repos × machines) — read this before doing anything

This effort spans **two repos** and **two machines**. Mixing them up
is the single easiest way to waste a session, so:

| | `japan-geotiff-dem` | `hfu/mapterhorn` | `hfu/mapterhorn-japan-bridge` (this repo) |
|---|---|---|---|
| **What** | GSI DEM → GeoTIFF, published to Source Cooperative | Fork of `mapterhorn/mapterhorn`; GeoTIFF → PMTiles pipeline | Docs + GitHub Pages preview viewer only |
| **Runs on** | `aalto` (this session's main Mac, M1/8GB, external HDD at `/Volumes/github`) | `slate` (M4 Mac mini, 16GB, real SSD at `/Volumes/Migrate-2025-04`, reached via `ssh hfu@slate.local`) | Nowhere — static site only |
| **Why that machine** | Already set up there; unrelated to this effort | Mapterhorn's aggregation stage needs RAM + genuine SSD random access `aalto` doesn't have (D2) | N/A |
| **Constraints** | See that repo's own `CLAUDE.md` | **Don't add unrelated features** — Hidenori wants this fork to stay close to upstream, bug fixes only (see `FORK_NOTES.md`) | Keep it small: viewer + docs, no pipeline code |
| **Publishes to** | `smartmaps/japan-geotiff-dem` | (nothing directly) | `smartmaps/mapterhorn-japan-bridge` (README + `japan.pmtiles`), via `aalto` since only `aalto` has `aws`/`source-coop` credentials set up |

Practical consequence: when you (Claude) are working on the mapterhorn
pipeline itself, you'll be running commands **on `slate` over SSH**
from whatever machine hosts this conversation — e.g.
`ssh hfu@slate.local 'eval "$(/opt/homebrew/bin/brew shellenv)" && cd
"/Volumes/Migrate-2025-04/github/hfu-mapterhorn/pipelines" && uv run
python ...'`. Uploads to Source Cooperative, by contrast, need to
happen from wherever `aws`/`source-coop` are actually configured
(`aalto` in this session) — `scp` the output there first if it was
built on `slate`.

## Source-catalog entries in `hfu/mapterhorn`

All under `source-catalog/` in the `hfu/mapterhorn` clone on `slate`
(`/Volumes/Migrate-2025-04/github/hfu-mapterhorn/`):

- `jphakodatetrial1`, `jphakodatetrial5m`, `jphakodatetrial10m` —
  small, real, throwaway-but-currently-live smoke-test sources (Mt.
  Hakodate / Goryokaku area, ~2 mesh blocks). Used to validate the
  whole pipeline end to end and to test the 1m→5m→10m priority-merge
  specifically (D9). Safe to delete once superseded by full coverage.
- `jphokkaidodem1` — the real target, full Hokkaido 1m, **not yet run
  through aggregation** (only `file_list.txt` exists, generated from
  `japan-geotiff-dem`'s local `dst/1` at the time — 12,736 entries,
  covering only Z001–Z012's worth of Hokkaido; needs regenerating
  against whatever's actually published before using it for real, see
  D3/D4 and `japan-geotiff-dem`'s own `HANDOVER.md`).
- Existing upstream entries `jpdem1a`/`jpdem5a-c`/`jpdem10a-b` (full
  Japan, various resolutions, produced via `hfu/fusi`, not this
  effort) — **never put these in `source-store/` alongside the
  `jphakodate*`/`jphokkaido*` entries** in the same run. `jpdem1a` is
  1m at the *same* maxzoom as our own 1m sources, and the tie-break for
  equal-maxzoom sources is alphabetical (`jpdem1a` < `jphokkaidodem1`)
  — `jpdem1a`'s stale pre-update data would win over our fresher data
  in any overlap (D6). Keep them out of `source-store/` entirely for
  bridge runs.

All three `jphakodatetrial*`/`jphokkaidodem1` entries' `file_list.txt`
point at public `https://data.source.coop/smartmaps/japan-geotiff-dem/
{1,5,10}/...` URLs (D3) — fed via `source_download.py`, not by copying
files between machines. `source_to_cog.py` is deliberately skipped in
their `Justfile`s (D5).

## Pipeline (run on `slate`, from `hfu-mapterhorn/pipelines/`)

```
uv run python source_download.py <source>      # fetch from Source Cooperative
uv run python source_bounds.py <source>        # bounds.csv (cheap, header-only)
uv run python source_polygonize.py <source> N  # coverage polygon (reads full-res data)
uv run python aggregation_covering.py          # plans work, ALL source-store/*/bounds.csv at once
AGGREGATION_WORKERS=N uv run python aggregation_run.py     # does the reprojection+merge+tile work
uv run python downsampling_covering.py         # plans the z-pyramid overviews
DOWNSAMPLING_WORKERS=N uv run python downsampling_run.py   # builds them
uv run python bundle.py 1                      # packages into {z}-{x}-{y}.pmtiles + planet.pmtiles
```

`aggregation_covering.py` has no source-selection flag — it globs
*every* `source-store/*/bounds.csv` present. Control scope by
controlling what's physically in `source-store/`, not by config.

**Priority-merge, verified correct by reading the code (D8)**: sources
are sorted by `-maxzoom` (so higher-resolution = earlier = "most
important"), and merging only ever copies a lower-priority source's
pixel into a still-`-9999`(nodata) slot in the higher-priority result
— never overwrites a pixel that already has real data. "First/highest
priority" means *base layer*, not *painted-over-first*. See
`aggregation_merge.py`'s `copy_mask = (merged_tile == -9999) &
(current_tile != -9999)` and `utils.py`'s `get_grouped_source_items`.

## `japan.pmtiles`: single ever-growing merged archive (D7)

After `bundle.py` produces `planet.pmtiles` + per-region
`{z}-{x}-{y}.pmtiles` files, merge **all** of them (not just the new
ones) into one file, always named `japan.pmtiles`, and re-upload it
over the same key every time. This is a full rebuild each time, not an
incremental append — accepted cost for a temporary bridge product at
its current scale (see D7 for the tradeoff). The merge script is
ad hoc (not a checked-in pipeline script — see `HANDOVER.md` for the
exact snippet last used); it's a straightforward re-implementation of
`hfu/mapterhorn`'s own `pipelines/merge_bundles.py`, generalized to
`glob("bundle-store/*.pmtiles")` instead of that script's
hardcoded two-file `INPUTS` list.

Rebuild it, `scp` to wherever `aws` runs, then:

```
aws s3 cp japan.pmtiles s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles \
  --profile source-coop --acl bucket-owner-full-control
```

## Preview

Two viewers:
1. `https://mapterhorn.com/viewer/#url=<pmtiles-url>` — official
   Mapterhorn viewer. Works (verified real hillshade renders), but
   bare (no basemap) and its `#map=z/lat/lon` camera-position hash
   doesn't reliably restore the view on load in practice — treat any
   camera position you set via that URL as unreliable; set it via
   `map.jumpTo()` in the console if you need a specific view.
2. **This repo's own page** (`index.html`/`app.js`/`style.json`,
   GitHub Pages at `hfu.github.io/mapterhorn-japan-bridge/`) — reuses
   `hfu/kitavolca`'s basemap+hillshade+3D-terrain pattern (GSI
   optimal vector tiles, grayscale, via `stars.optgeo.org/bvmap`).
   **Currently broken as of 2026-08-08 — see `HANDOVER.md`'s open
   issue before touching this.** The style loads successfully
   (controls render, bvmap's attribution string appears) but neither
   the bvmap vector layers nor the hillshade layer visibly render, and
   network logs show zero requests to `stars.optgeo.org` ever being
   made despite `bvmap` being a valid source in the loaded style.

## Source Cooperative publishing

Same convention as `japan-geotiff-dem` (that repo's `CLAUDE.md`/
`DECISIONS.md` D2 has the full writeup) — Hidenori runs `source-coop
login` on **aalto** (the only machine with `aws`/`source-coop`
installed in this session), Claude only ever uses `--profile
source-coop`, never `source-coop creds` directly. Target:
`s3://smartmaps/mapterhorn-japan-bridge`.
