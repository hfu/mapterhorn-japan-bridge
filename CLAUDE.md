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
Cooperative product — should be considered retirable. Being a real
`git` fork (not an independent reimplementation) is deliberate and
load-bearing for this mission — see DECISIONS.md D17 for why upstream
fidelity is treated as a standing practice here, not a one-time setup
step, and how this differs from `hfu/fusi` (an earlier, unrelated,
non-fork DEM→PMTiles toolchain whose role this project has since
mostly absorbed).

**Scope, updated 2026-08-20 (DECISIONS.md D16) — this paragraph moves
fast, verify against `HANDOVER.md`/`DECISIONS.md` before trusting it**:
`jpnational5`/`jpnational10`/`jpnationalsea` are national scope.
`jpnational1` (1m) is deliberately still Kyushu/Okinawa/Shikoku/
western-Chugoku only — not frozen, just sequenced after the other
three so the downstream pipeline gets stress-tested at a large-but-not-
largest scale first (D16). Hokkaido was un-frozen and fully redone as
part of `japan-geotiff-dem`'s own JCI 2026-09 (see that repo's own
docs) — the D12-era Hokkaido freeze below is historical, not current.

This repo itself contains **no data-processing pipeline**. It's the
documentation home for the bridge effort as a whole, plus a GitHub
Pages preview viewer. The actual pipeline lives in `hfu/mapterhorn`
(see below) — deliberately kept there separately, not merged into
this repo or vice versa.

## The three-way split (repos, one machine now) — read this before doing anything

This effort spans **two repos** — `hfu/mapterhorn` was always its own
third repo/fork, git-managed separately, see below — but as of
2026-08-11 (DECISIONS.md D12) they all run on **one machine**:
`aalto`'s external HDD (this whole project's original working-copy
location for `japan-geotiff-dem`) failed outright and is retired.
`slate` is now the sole machine for everything.

| | `japan-geotiff-dem` | `hfu/mapterhorn` | `hfu/mapterhorn-japan-bridge` (this repo) |
|---|---|---|---|
| **What** | GSI DEM → GeoTIFF, published to Source Cooperative | Fork of `mapterhorn/mapterhorn`; GeoTIFF → PMTiles pipeline | Docs + GitHub Pages preview viewer only |
| **Runs on** | `slate` (M4 Mac mini, 16GB, real SSD at `/Volumes/Migrate-2025-04`, reached via `ssh hfu@slate.local`) — `git`-tracked at `/Volumes/Migrate-2025-04/github/japan-geotiff-dem-repo`, not the old Justfile-only working copies | `slate`, same machine, `/Volumes/Migrate-2025-04/github/hfu-mapterhorn/` | Nowhere — static site only |
| **Why that machine** | `aalto`'s external HDD failed (D12); `slate` already had the fast SSD this needs anyway | Mapterhorn's aggregation stage needs RAM + genuine SSD random access `aalto` never had (D2) | N/A |
| **Constraints** | See that repo's own `CLAUDE.md` | **Don't add unrelated features** — Hidenori wants this fork to stay close to upstream, bug fixes only (see `FORK_NOTES.md`) | Keep it small: viewer + docs, no pipeline code |
| **Publishes to** | `smartmaps/japan-geotiff-dem` | (nothing directly) | `smartmaps/mapterhorn-japan-bridge` (README + `japan.pmtiles`) |

Practical consequence: **everything now runs on `slate` over SSH**
from whatever machine hosts this conversation — e.g.
`ssh hfu@slate.local 'eval "$(/opt/homebrew/bin/brew shellenv)" && cd
"/Volumes/Migrate-2025-04/github/hfu-mapterhorn/pipelines" && uv run
python ...'`. Uploads to Source Cooperative also happen directly from
`slate` (its own `source-coop`/`aws` credentials, set up 2026-08-10 via
an SSH-tunneled OAuth loopback — see `japan-geotiff-dem`'s own
`HANDOVER.md`) — no more routing through `aalto`, no more `scp`-ing
output between machines for a publish step.

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
  D3/D4 and `japan-geotiff-dem`'s own `HANDOVER.md`). **Frozen as of
  2026-08-11 (D12) — do not touch without an explicit fresh decision.**
- `jpkyushutest1`/`jpkyushutest5m`/`jpkyushutest10m` — the real
  Kyushu/Okinawa entries (this repo's sole focus as of D12), built
  2026-08-10/11 from whatever's currently published on
  `smartmaps/japan-geotiff-dem` for the 3900-5199 JIS mesh range, no
  geographic cropping. Originally `jpkyushutest1` was a throwaway
  pipeline speed-validation entry (name kept on repurposing to avoid
  re-downloading). No 5m/10m-fallback dedup issues found for `5m`/
  `10m`; `1m`'s `file_list.txt` needs periodic regeneration as more of
  the 2026-06-03 survey refresh lands and gets synced (see
  `japan-geotiff-dem`'s own `HANDOVER.md` for that pipeline's current
  state/ETA).
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
   The 2026-08-08 rendering bug (`DECISIONS.md` D10) was resolved as
   of 2026-08-09 — not reproducible, likely external and self-cleared;
   see D10's update. `app.js`'s `maxPitch` is raised to 85 (MapLibre's
   real internal cap, was the library default of 60) per Hidenori's
   request.

## Source Cooperative publishing

Same convention as `japan-geotiff-dem` (that repo's `CLAUDE.md`/
`DECISIONS.md` D2 has the full writeup) — Hidenori runs `source-coop
login` on **`slate`** (as of 2026-08-11, D12; previously `aalto`, now
retired), via an SSH-tunneled OAuth loopback since `slate` is headless
(`ssh -N -L 8484:localhost:8484 slate.local`, then `source-coop login
--port 8484` on `slate`, then Hidenori completes the browser auth
himself). Claude only ever uses `--profile source-coop`, never
`source-coop creds` directly, and deletes any `-v`/`--verbose` login
log immediately after confirming success (it can print live credentials
in plaintext). Target: `s3://smartmaps/mapterhorn-japan-bridge`.
