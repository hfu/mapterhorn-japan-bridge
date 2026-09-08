# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-08**: the 2026-09-06 "current state" section
(1.5-go mission complete, 2号 launch-readiness reviewed, D132-D147) has
been moved into `HANDOVER-archive.md`, unedited. This file keeps only
the current state and a short recent-context summary. Compact again
the same way once this file itself grows unwieldy -- archive
everything above the current-state section, keep only a fresh
snapshot.

## Current state (2026-09-09, early morning JST): D148 + D152 both published to stars, verified clean. 1.6-go still blocked pending redesign

**Read DECISIONS.md D147 through D153 for the full arc since the last
compaction.** This was one long, dense session -- summary:

- **D147**: investigated the JGD2011→JGD2024 CRS question (one of
  2号's three open readiness items). Confirmed with real 2026 data that
  GSI's GML now carries `srsName="fguuid:jgd2024.bl"` and that
  `gmldem2tif.rb` (external tool) ignores it, always stamping
  `EPSG:6668`. JGD2024 has no EPSG code yet (only ESRI:104221/104220,
  confirmed against this machine's GDAL 3.13.3/PROJ database) --
  Hidenori's call: **wait for EPSG, don't patch now**. Not a 2号
  blocker. Whether to loop in Oliver Wipfli on this is still open.
- **D148: Oliver Wipfli found and fixed a real upstream bug** in
  `mapterhorn/mapterhorn` (`53e4d3d`, "Fix rounding on downsampling
  bug") -- downsampling's parent tiles were never quantized to their
  own zoom's vertical resolution after averaging, unlike aggregation's
  leaf tiles. Ported the fix into `hfu-mapterhorn` (new
  `utils.get_rounded_elevation_data()`, called from both
  `save_terrarium_tile()` and `downsampling_run.py`'s `create_tile()`).
  Measured **78.7% smaller** on a 400-tile real sample of the
  downsampling layer alone. Given stars' tight disk headroom (149GB
  free), Hidenori chose to **regenerate 1.5-go's published elevation
  archive** rather than wait for 2号:
  - Deleted the 8,223 elevation `*-downsampling.done` markers (lineage's
    untouched) and re-ran `downsampling_run.py` -- **completed cleanly,
    8,223/8,223, zero errors/warnings** (screen `downsample_round_fix`,
    ~4h45m wall time).
  - `bundle.py`(elevation) → `merge_japan_bundles.py`(elevation,
    includes D144's auto-cluster) → `pmtiles merge` (z0-7 splice) →
    `pmtiles verify` completed cleanly in screen `d148_bundle_merge`
    (started 2026-09-08 ~06:28 JST, ~2h35m wall time). Final archive:
    258.08GB (down from 314.66GB, ~18% smaller -- less than the
    downsampling-only 78.7% figure since that only measures the
    downsampling layer, not the full archive including aggregation).
  - **Published to stars, D153 (2026-09-09 03:02:57 JST)** -- see below.
- **D149/D150/D151: "1.6-go"** -- investigated two more of Hidenori's
  observations (lineage rendering nodata as if it were the 1m tier;
  elevation holes near islands lacking 1m coverage) and found they
  share one root cause: 51% of land aggregation items (2,128/4,133)
  cap out below the national z16 ceiling. Verified against MapLibre
  GL JS's own source that no available release (including the pinned
  5.24.0) falls back to an ancestor tile for a missing raster-dem tile
  -- the fix for that landed upstream only 4 days ago, not in any
  release yet. **Design agreed** (upsample land-only items to z16 via
  `aggregation_covering.py`/`aggregation_reproject.py`, scoped
  separately from 2号). A single-item rehearsal
  (`pipelines-rehearsal-16go/`, D124-style) proved the core mechanism
  works (86s/item, smooth/plausible elevation) but found a real bug:
  `aggregation_tile.py`/`lineage_tile.py` named their output archive
  by the stale *planned* child_z instead of the actually-produced one
  -- **fixed and verified in production code** (harmless for existing
  native-zoom runs). A follow-up **chained** 2-item rehearsal then
  found a second, worse bug: `downsampling_covering.py` determines
  each item's finest zoom from the aggregation covering CSV's
  filename (still the stale planned value), not from the real
  pmtiles-store output -- **upsampled leaves would silently never
  enter the downsampling pyramid, no crash, just permanent gaps**.
  **1.6-go is blocked on this until it's redesigned** (likely: scan
  `pmtiles-store` directly instead of the covering CSVs). Not
  resumed this session per Hidenori's own call to pivot to a code
  review instead.
- **D152: comprehensive code review (`/code-review high`, 9 parallel
  agents) of every code change since 1.5-go mission complete** (D146's
  `lineage_extend_low_zoom.py`, D148's rounding fix, D150/151's
  filename fix -- 5 files, ~340 diff lines). Found 10 findings; **the
  most severe was live and public-facing**: `lineage_extend_low_zoom.py`'s
  z8-archive discovery glob was non-recursive, and
  `utils.get_pmtiles_folder()` buckets z>=7 extents into nested
  subfolders -- verified directly against real data that only 14 of
  107 real z8 lineage archives (13%) were ever read. **The z4-z7
  lineage overview D146 published and is currently live on stars was
  built from ~13% of the country, not the full national picture it
  was supposed to show.** Fixed (recursive glob + a basename→relpath
  map, since the shared `get_tile_to_pmtiles_filename()` helper can
  only parse bare basenames), verified against real data (107/107
  archives now found, 440 real z8 tiles), regenerated (z7 68→117, z6
  17→37, z5 10→13), and re-bundled/merged
  (`bundle-store/mapterhorn-japan-bridge-lineage.pmtiles`, 204.7MB,
  verify clean, min/max zoom 4/16, clustered).
  **Published to stars, D153 (2026-09-09 03:02:57 JST)** -- see below.
  The other 9 review findings (a latent
  `majority_vote_downsample()` argmax-on-all-zero bug in
  `lineage_downsample.py`; all-nodata parent tiles written and
  propagated instead of skipped; a widened stale-file race window in
  `aggregation_tile.py`/`lineage_tile.py`; an undocumented rounding
  cap; code-duplication between `lineage_extend_low_zoom.py` and
  `downsampling_run.py`; missing `.done`-marker coverage for the new
  low-zoom archives; a missing cache-freshness check; an inefficient
  per-level encode/decode round trip) are recorded but **still not
  triaged or fixed** -- see the code-review tool's own findings output
  from this session, or re-run `/code-review` on this same diff range
  to regenerate them.
- **D153: D148 + D152 both published to stars, verified clean**
  (2026-09-09 03:02:57 JST). Same delete-then-transfer pattern as
  D142/D145 (old 314.66GB elevation file deleted first, given stars'
  149GB headroom), run via `screen publish_d148_d152` +
  `/tmp/publish_d148_d152.sh` (a copy of the proven `publish_1p5go.sh`
  pattern), started 20:50:32 JST, took ~6h12m. Progress was tracked by
  periodically `ssh`-ing to stars and `stat`-ing the in-flight
  `.mapterhorn-japan-bridge.pmtiles.new.*` temp file directly (rsync's
  `--progress` output isn't reliably parseable through a detached
  `screen` + `tee`), which let ETA estimates get consistently within
  ~15 minutes of the real completion time. Spot-checked against
  D145's own known-good byte counts after publish: elevation z13
  (aggregation layer, untouched by D148's rounding fix) and lineage
  z8 both came back byte-identical to their D145 values; elevation z8
  (downsampling layer, the actual target of D148's fix) dropped from
  225,036 to 61,812 bytes (~72.5% smaller) -- consistent with, not a
  regression from, the fix. 1.5-go's elevation and lineage archives on
  stars are now both fully current.

**Also this session, in a sibling repo**: at Hidenori's request,
[`hfu/japan-bridge-lineage`](https://github.com/hfu/japan-bridge-lineage)
(the standalone lineage showcase, previously undocumented -- no
README at all) got a README.md + LICENSE (CC0, matching this repo's),
and a fix for
[hfu/japan-bridge-lineage#1](https://github.com/hfu/japan-bridge-lineage/issues/1)
(a "がっくん" jolt on every scroll-zoom once terrain is on). Traced
through maplibre-gl's own source to a per-render-frame terrain
elevation feedback loop (`centerClampedToGround`'s default `true`
continuously re-samples live DEM data under the map center and feeds
it back into zoom/distance math -- a known, still-open upstream issue,
maplibre/maplibre-gl-js#2937, independent of globe projection though
globe's own zoom-around-cursor heuristics likely compound it). Fixed
with `centerClampedToGround: false` (a real, documented option, not a
hack), pushed (`7535666`), and written up as a comment on the issue --
**not yet visually verified** (no working browser tooling this
session, and the fix landed while D148's stars transfer had elevation
tile serving down anyway) -- ask Hidenori to confirm live now that
stars is back. This work is entirely independent of `mapterhorn-japan-
bridge`'s own pipeline; noted here only for continuity, not tracked in
this repo's own `DECISIONS.md`.

**What's next / open decisions, in likely order**:
1. Ask Hidenori (or wait for him) to confirm the `japan-bridge-lineage`
   #1 fix actually stops the jolt, now that stars' elevation tiles are
   back.
2. Decide whether/how to triage the other 9 code-review findings from
   D152 (none are known to be live-data-affecting the way the lineage
   glob bug was, but several are real latent bugs).
3. Resume 1.6-go once `downsampling_covering.py`'s redesign is worked
   out -- not started this session.
4. The two original 2号-readiness items untouched all session: the
   untested 5m/10m corruption-bug-class question (`PLAN.md` §3), and
   the dirty-tracking design decision (`PLAN.md` §4/D57).
5. Whether to loop in Oliver Wipfli on the D147 JGD2024 finding is
   still undecided.

**Monitoring**: a `Monitor` task tracked the D148/D152 stars publish
by `ssh`-checking the in-flight temp file size on stars every 15
minutes (see D153) until it completed; that task has ended on its own
(the underlying script finished). No periodic monitor is currently
armed.

**Git state**: both repos (`mapterhorn-japan-bridge`, `hfu-mapterhorn`)
should be fully committed and pushed once this snapshot itself is
committed -- verify with `git status --short` (expect clean) and
`git log origin/main..HEAD` (expect empty) in both before trusting
this note blindly.
