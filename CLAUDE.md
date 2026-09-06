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

**Scope, updated 2026-09-06 — this paragraph moves fast, verify
against `HANDOVER.md`/`DECISIONS.md` before trusting it**: all four
sources (`jpnational1`/`5`/`10`/`sea`) are full national scope as of
1号 (generation `01M0MWK852631SHCHPA66F21WQ`), published and stable on
`stars`. **1.5号** (generation `01M1MKD73P0KDT719H21NJV9VR`) has since
reached mission complete (D145/D146): a structurally-rewritten pipeline
(generation_id/layer/datatype namespace separation, D95/D124) validated
at real national scale, plus the lineage feature (D93/D94/D96)
implemented, published, and extended to a lower zoom floor (D146).
Both elevation and lineage archives are live on `stars`, verified
clean; 1号's own data was never touched. **2号 is next** — gated on
GSI shipping a new DEM1A update (not yet, see `PLAN.md` §1's live
checks), to launch in a fresh session per Hidenori's own call (avoids
juggling two differently-scoped generations in one session's context).
See `PLAN.md` §8 for the current 2号 launch-readiness checklist
(mostly ready; the JGD2011→JGD2024 CRS question is now investigated
and deliberately deferred rather than open — D147: real 2026 source
data already carries `srsName="fguuid:jgd2024.bl"` and the external
`gmldem2tif.rb` tool silently mislabels it as JGD2011, but JGD2024 has
no EPSG code yet as of 2026-09-07, so Hidenori chose not to patch it
until one exists — not a 2号 launch blocker).
**Do not treat `find aggregation-store/*/ -name '*.done' | wc -l`
alone as proof of correctness** — this exact class of stale-marker bug
(D53/D69/D100) has recurred at increasing scale; always cross-check
against `check_downsampling_done_integrity.py` and
`check_pmtiles_integrity.py` before trusting a `.done` count.

**Upstream sync with `mapterhorn/mapterhorn` (D22's original ask) has
happened twice now** (D63, D82) — most upstream churn since has been
new source-catalog entries for other countries (low-risk, additive)
plus a shift toward a multi-host distributed worker architecture that
doesn't apply to this project's single-machine (`slate`) model. Not a
standing todo anymore; re-check only if upstream's architecture
direction becomes relevant again (e.g. if 号2's scale ever demands
distributing across more than one machine).

**「1.5号」 — mission complete (D145/D146, 2026-09-06)**: a
staging/regression run using 1号's own already-downloaded source data
but a structurally-fixed pipeline (D95/D107: separate the aggregation
and downsampling layers' file namespaces AND add a generation_id
directory level, the root design flaw behind D74-D76/D100/D123), plus
the lineage-tile feature (D93/D94/D96). Both of D96's founding goals
are done: the namespace fix validated at real national scale with zero
incidents, and lineage implemented, published, then extended to a
lower zoom floor for a nationwide overview (D146) — including a
standalone showcase site (`hfu/japan-bridge-lineage`, GitHub Pages)
shared with Oliver Wipfli. 1.5号's terrarium output replaced 1号 on
`stars`; its lineage output is new (`mapterhorn-japan-bridge-
lineage.pmtiles`). 1号's own data was never touched throughout.

**Next: 2号** (real production run, gated on GSI shipping a new DEM1A
update — see `PLAN.md` §1, working estimate end of November 2026, live-
checked 2026-09-06 as not yet triggered). By design (1.5号's whole
purpose) 2号 should need **no pipeline code changes**, just a fresh
generation_id and a fast run — see `PLAN.md` §8 for the current launch-
readiness checklist and its few still-open items (the JGD2011→JGD2024
CRS question from `PLAN.md` §1 is investigated and deferred, not open
— D147). **2号 launches in a fresh
session, not whichever session did 1.5号's prep work** — Hidenori's own
call, to avoid the kind of cross-generation mix-ups a single session
juggling multiple repos/generations can produce.

## Source priority order (read before touching aggregation code)

Production merges seven tiers, highest accuracy first: **`1` (DEM1A) >
`5a` (DEM5A) > `5b` (DEM5B) > `5c` (DEM5C) > `10a` (DEM10A) > `10b`
(DEM10B) > `sea` (Copernicus GLO-30)**. `A` = airborne laser survey
(1m/5m) or finer 1:10,000-contour derivation (10m); `B`/`C` = coarser
photogrammetry or 1:25,000-contour fallbacks used where no better
survey exists yet — lower letter/tier always means higher trustworthy
accuracy, and should win wherever two tiers cover the same cell.

**Where this is actually enforced, in code** (not just convention):
- All seven tiers are genuinely separate priority *groups* at the
  pixel level — `utils.get_grouped_source_items()` groups by `(maxzoom,
  source, product_type_rank)`, so `1`, `5a`, `5b`, `5c`, `10a`, `10b`,
  `sea` each become their own group when present for a tile. Ordering
  across groups: `-maxzoom` first (each file's own real native
  resolution, computed from `bounds.csv`, not a hardcoded per-source
  constant — D8), then product-type rank ascending (`A`=0, `B`=1,
  `C`=2) as the tiebreaker within a resolution tier.
- `aggregation_reproject.py`'s `reproject()` warps each group in
  priority order, stopping early once one group has no `nodata`
  pixels left. `aggregation_merge.py`'s `merge()` then composites
  *across* however many groups got warped: per-pixel nodata-fill from
  the next-priority group, with an erosion + Gaussian-blurred seam
  blend at the boundary — genuinely pixel-level, not "one whole file
  wins over another." Both functions are generic over group count, so
  going from four groups to seven (D20, 2026-08-20) needed **no
  changes to either function** — only to how `get_grouped_source_items()`
  partitions its input.
- This wasn't always pixel-level *within* a resolution tier: D18
  (2026-08-20) first found that same-cell `5a`/`5b`/`5c` (and
  `10a`/`10b`) files sorted purely alphabetically by filename and got
  merged via a single `gdalbuildvrt` call per tier, where
  `gdalbuildvrt`'s confirmed last-file-wins overlap behavior made the
  *lower*-accuracy product silently win (25,522 affected 5m cells
  nationally). D18's first fix reordered files *within* one
  `gdalbuildvrt` call to get the winner right; D20 replaced that with
  the proper seven-group split above, once Hidenori pointed out a
  tile can contain a genuine spatial *mix* of product types that
  deserves the same seam-aware blending the four coarser tiers
  already got, not just a binary overwrite. Read D18 then D20 in that
  order for the full story — D18 isn't wrong, just superseded.
- `pipelines/lineage_inspect.py` (D20) is a standalone, on-demand tool
  for spot-checking which group actually won each pixel of a given
  aggregation item — not wired into production, reuses `aggregation_
  reproject.reproject()` and mirrors `aggregation_merge.py`'s own
  nodata-fill walk to build a colorized provenance PNG. Use it to
  sanity-check this whole mechanism against a real tile.
- This exact tier order isn't a fresh guess — it matches Hidenori's
  earlier, independent `fusi` toolchain's own real production command
  (`dem1a dem5a dem5b dem5c dem10a dem10b`, `fusi`'s `README.md`) and
  its explicit "earlier entries have higher priority" convention — see
  D18's "Grounding for the order" for the full citation.

If a new resolution tier or product-type split is ever added, extend
`get_product_type_rank()`'s pattern/rank table (`utils.py`) — it only
recognizes `A`/`B`/`C` suffixes today.

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
| **Publishes to** | `smartmaps/japan-geotiff-dem` | (nothing directly) | `smartmaps/mapterhorn-japan-bridge` (README + `mapterhorn-japan-bridge.pmtiles`) |

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
(`/Volumes/Migrate-2025-04/github/hfu-mapterhorn/`). **Renamed
2026-08-19** from the original `jpkyushutest*`/`jphakodatetrial*`/
`jphokkaidodem1` test-scale names — the sections below describing those
old names are historical (see
`project_mapterhorn_japan_bridge_slate.md`-style memory / this repo's
own git log around `25a3f7e`/`ffcd665` for the rename+cleanup detail).
**Current, live entries**:

- `jpnational1` / `jpnational5` / `jpnational10` / `jpnationalsea` —
  the real, full-national-scope entries (`jpnational5`/`jpnational10`
  went national 2026-08-19; `jpnational1` followed once
  `japan-geotiff-dem`'s own JCI 2026-09 finished all 11 zones).
  `jpnational1` is the only one git-tracked (`git mv`'d, not
  regenerated fresh); `5`/`10`/`sea` stay untracked, regenerable
  derived artifacts. `jpnationalsea` sources Copernicus GLO-30 from
  the AWS S3 mirror specifically (`copernicus-dem-30m.s3.amazonaws.com`),
  not OpenTopography's MinIO mirror — the latter returns placeholder
  ETags that break the checksum-skip download optimization.
- Every other test/trial entry from the pre-national era
  (`jphakodatetrial*`, `jpsapporo*`, `jpshakotan*`, `jphakodatecity*`)
  was **deleted** in the same 2026-08-19 cleanup once `jpnational*`
  superseded them — don't expect to find them in `source-store/`
  anymore. `jphokkaidodem1` is the one exception, deliberately left in
  place but **frozen** (stale partial data, "do not touch without an
  explicit fresh decision").
- Existing upstream entries `jpdem1a`/`jpdem5a-c`/`jpdem10a-b` (full
  Japan, various resolutions, produced via `hfu/fusi`, not this
  effort) — **never put these in `source-store/` alongside
  `jpnational*`** in the same run. `jpdem1a` is 1m at the *same*
  maxzoom as our own 1m source, and the tie-break for equal-maxzoom
  sources is alphabetical (`jpdem1a` < `jpnational1`) — `jpdem1a`'s
  stale pre-update data would win over our fresher data in any overlap
  (D6). Keep them out of `source-store/` entirely for bridge runs.

`jpnational*`'s `file_list.csv[.gz]` (format changed from `.txt` to
CSV with `url,size,md5` columns, D14) point at public
`https://data.source.coop/smartmaps/japan-geotiff-dem/{1,5,10}/...`
URLs — fed via `source_download.py`'s `aria2c`-based downloader (D14),
which uses the manifest's real MD5 (from S3 ETags) to skip
already-correct local files with zero network requests where the
source host supports it.

## Pipeline (run on `slate`, from `hfu-mapterhorn/pipelines/`)

```
uv run python source_download.py <source>      # fetch from Source Cooperative
uv run python source_bounds.py <source>        # bounds.csv (cheap, header-only)
uv run python source_polygonize.py <source> N  # coverage polygon (reads full-res data)
uv run python aggregation_covering.py          # plans work, ALL source-store/*/bounds.csv at once
AGGREGATION_WORKERS=N uv run python aggregation_run.py     # does the reprojection+merge+tile work (EMIT_LINEAGE=1 also emits the lineage sibling archive, D93/D96)
uv run python downsampling_covering.py         # plans the z-pyramid overviews (datatype-agnostic, shared by both datatypes)
DOWNSAMPLING_WORKERS=N DOWNSAMPLING_DATATYPE=elevation|lineage uv run python downsampling_run.py   # builds them -- run once per datatype (D93/D107)
uv run python lineage_extend_low_zoom.py       # lineage-only, standalone: extends its pyramid below z8 (D146) -- run once, after lineage's own downsampling_run.py pass, before bundle.py
BUNDLE_DATATYPE=elevation|lineage uv run python bundle.py 1   # packages into {z}-{x}-{y}-lineage?.pmtiles + planet(-lineage)?.pmtiles -- run once per datatype
MERGE_DATATYPE=elevation|lineage uv run python merge_japan_bundles.py   # merges + auto-clusters (D144) into the final per-datatype archive
```

`aggregation_covering.py` has no source-selection flag — it globs
*every* `source-store/*/bounds.csv` present. Control scope by
controlling what's physically in `source-store/`, not by config.

**Two datatypes since 1.5号 (D93/D96/D107)**: `elevation` (default,
1号's only mode, Terrarium-encoded real heights) and `lineage` (which
source tier filled each pixel, D93/D94, a single-channel category
byte). `downsampling_run.py`/`bundle.py`/`merge_japan_bundles.py` all
take a `*_DATATYPE` env var and process exactly one datatype per
invocation — building both means running each script twice. Every
`get_pmtiles_folder()` call additionally requires a `generation_id`
(no default) since D95/D124 — see `PLAN.md` §0 for the label↔ULID
table and this file's own Mission section for current generation
status.

**Priority-merge, verified correct by reading the code (D8)**: sources
are sorted by `-maxzoom` (so higher-resolution = earlier = "most
important"), and merging only ever copies a lower-priority source's
pixel into a still-`-9999`(nodata) slot in the higher-priority result
— never overwrites a pixel that already has real data. "First/highest
priority" means *base layer*, not *painted-over-first*. See
`aggregation_merge.py`'s `copy_mask = (merged_tile == -9999) &
(current_tile != -9999)` and `utils.py`'s `get_grouped_source_items`.

## `mapterhorn-japan-bridge.pmtiles`: single ever-growing merged archive (D7, renamed D46)

After `bundle.py` produces `planet.pmtiles` + per-region
`{z}-{x}-{y}.pmtiles` files, `merge_japan_bundles.py` merges **all** of
them (not just the new ones) into one intermediate file, named
`mapterhorn-japan-bridge.z8plus.pmtiles` since D109 (`japan.pmtiles`
before D46, plain `mapterhorn-japan-bridge.pmtiles` between D46 and
D109 — three different names for this same intermediate step across
this file's own history, a live illustration of why D109 introduced
the `.z8plus` suffix in the first place). A separate manual `pmtiles
merge` step splices in the z0-7 global overview to produce the final
`mapterhorn-japan-bridge.pmtiles` (the plain name now refers to *only*
this final, publishable product). This is a full rebuild each time, not
an incremental append — accepted cost for a temporary bridge product
at its current scale (see D7 for the tradeoff).

**Lineage's sibling archive, since 1.5号 (D96/D107)**:
`mapterhorn-japan-bridge-lineage.pmtiles` — same `merge_japan_bundles.py`,
`MERGE_DATATYPE=lineage`, own OUTPUT constant, no z0-7 global-overview
splice (lineage has no external global counterpart to splice in, D96).
`merge_japan_bundles.py`'s `main()` now runs `./pmtiles cluster` on its
own output unconditionally for every datatype (D144) — lineage in
particular dedupes ~83.5% of its tile content this way (D143, far more
than elevation's ~19%), so this is not optional. Published separately
to `stars` alongside the elevation archive, at a `-lineage` suffixed
path matching the filename.

**`publish_cycle.py` is currently hard-disabled** (`sys.exit(1)` at the
top of `main()`, D115) — it was found to have a catastrophic bug
(would delete the local archive, bundle an empty tree under the
post-D107 layout, then delete the *live* archive on `stars` and rsync
nothing) that was never actually exercised because 1号 was always
published by hand. Do not remove the guard without first doing the
repair D115 names. Until then, publishing is a manual `rsync`, per the
runbook in `DECISIONS.md` D124/D125. `merge_japan_bundles.py` is checked in to `hfu-
mapterhorn`'s own `pipelines/`, a generalization of `hfu/mapterhorn`'s
own `pipelines/merge_bundles.py` to `glob("bundle-store/*.pmtiles")`
instead of that script's hardcoded two-file `INPUTS` list.

**Hosting is `stars`/`martin`, not Source Cooperative** (D13) — see
this file's own "Source Cooperative publishing" section below for why,
and `DECISIONS.md` D46 for the rename this section's own name reflects.

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
