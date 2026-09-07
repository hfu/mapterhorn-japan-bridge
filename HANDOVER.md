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

## Current state (2026-09-08, early morning JST): D148 elevation regen in flight, D152 lineage fix regenerated (unpublished), 1.6-go blocked pending redesign

**Read DECISIONS.md D147 through D152 for the full arc since the last
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
  - **`bundle.py`(elevation) → `merge_japan_bundles.py`(elevation,
    includes D144's auto-cluster) → `pmtiles merge` (z0-7 splice) →
    `pmtiles verify` is running RIGHT NOW** in screen
    `d148_bundle_merge`, started 2026-09-08 ~06:28 JST. **Known
    monitoring gotcha**: the launch command's `2>&1 | tee
    /tmp/d148_bundle_merge.log` only binds to the *last* `&&`-chained
    command (a shell operator-precedence mistake made when launching
    it), so that log file will stay absent/empty until either the
    whole chain succeeds (at which point it gets exactly one line,
    `=== ALL STAGES COMPLETE ===`) or nothing at all if any stage
    fails. **Check progress by process name instead**
    (`pgrep -f "bundle.py 1"` / `merge_japan_bundles.py` / `pmtiles
    merge` / `pmtiles verify`) or by watching `bundle-store/`'s file
    sizes grow. A background watcher script
    (`/tmp/watch_d148_bundle.sh`, polls every 60s) was started via
    `run_in_background` but the tool's own timeout is only 10 minutes,
    so it likely needs restarting if you're resuming this later --
    the underlying `screen -S d148_bundle_merge` session is
    independent and keeps running regardless.
  - **Not yet published to stars.** Estimated new archive size
    ~225-235GB (down from 314.66GB) -- confirm with Hidenori before
    the stars publish step (delete-old-then-transfer pattern, per
    D142/D145's runbook, since stars only has 149GB free).
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
  verify clean, min/max zoom 4/16, clustered) -- **not yet published
  to stars** (small file, no delete-old-first dance needed, just
  needs a go-ahead). The other 9 review findings (a latent
  `majority_vote_downsample()` argmax-on-all-zero bug in
  `lineage_downsample.py`; all-nodata parent tiles written and
  propagated instead of skipped; a widened stale-file race window in
  `aggregation_tile.py`/`lineage_tile.py`; an undocumented rounding
  cap; code-duplication between `lineage_extend_low_zoom.py` and
  `downsampling_run.py`; missing `.done`-marker coverage for the new
  low-zoom archives; a missing cache-freshness check; an inefficient
  per-level encode/decode round trip) are recorded but **not yet
  triaged or fixed** -- see the code-review tool's own findings output
  from this session, or re-run `/code-review` on this same diff range
  to regenerate them.

**What's next / open decisions, in likely order**:
1. Let D148's `d148_bundle_merge` screen finish (bundle → merge →
   z0-7 splice → verify). Check its actual state by process name, not
   the log file (see the gotcha above).
2. Confirm with Hidenori, then publish the fixed D152 lineage archive
   to stars (small, low-risk, no elevation-style outage expected).
3. Confirm with Hidenori, then publish D148's regenerated elevation
   archive to stars (bigger operation -- old 314.66GB file must be
   deleted before the new ~225-235GB one transfers, given stars' 149GB
   headroom; elevation tile serving will be briefly down mid-transfer,
   lineage unaffected either way).
4. Decide whether/how to triage the other 9 code-review findings from
   D152 (none are known to be live-data-affecting the way the lineage
   glob bug was, but several are real latent bugs).
5. Resume 1.6-go once `downsampling_covering.py`'s redesign is worked
   out -- not started this session.
6. The two original 2号-readiness items untouched all session: the
   untested 5m/10m corruption-bug-class question (`PLAN.md` §3), and
   the dirty-tracking design decision (`PLAN.md` §4/D57).
7. Whether to loop in Oliver Wipfli on the D147 JGD2024 finding is
   still undecided.

**Monitoring**: Hidenori asked for 15-min periodic status reports
mid-session; those were running via a `Monitor` task tied to the (now
stale) downsampling log and were stopped once D148's downsampling
stage finished and the bundle/merge stage's own logging turned out to
be broken (see the gotcha above). No periodic monitor is currently
armed -- re-arm one against process names or `bundle-store/` file
growth if picking this back up, not against `/tmp/d148_bundle_merge.log`.

**Git state**: both repos (`mapterhorn-japan-bridge`, `hfu-mapterhorn`)
are fully committed and pushed as of this snapshot -- confirmed via
`git status --short` (clean) and `git log origin/main..HEAD` (empty)
in both immediately before writing this. If you're resuming and see
otherwise, something changed after this snapshot was written.
