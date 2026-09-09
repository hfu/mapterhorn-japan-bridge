# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-09 (night JST)**: the 2026-09-09 (early morning)
"current state" section (D148-D153, elevation+lineage published and
verified) has been moved into `HANDOVER-archive.md`, unedited. This
file keeps only the current state and a short recent-context summary.
Compact again the same way once this file itself grows unwieldy --
archive everything above the current-state section, keep only a fresh
snapshot.

## Current state (2026-09-09, night JST): elevation downsampling regen in flight (rounding cap 32m->1m + bundled lineage fix), not yet published

**Read DECISIONS.md D147 (2026-09-09 addendum) through D155 for the
full arc since the last compaction.** Summary:

- **D147 addendum: the JGD2011->JGD2024 CRS question is now fully
  resolved, not just deferred.** Hidenori asked whether GSI itself
  says it's fine to keep using EPSG:6668 -- re-investigation via
  `OSGeo/PROJ`'s own commit history (`7f1fdb39`, EPSG Dataset v12.055,
  2026-04) found EPSG resolved JGD2024 by **renaming EPSG:6668 in
  place** ("rename JGD2011 to JGD2024... sigh"), not minting a new
  code -- matching GSI's own statement that horizontal coordinate
  values are numerically unchanged from JGD2011. This machine's GDAL
  3.13.3/PROJ install was on EPSG v12.029 (2025-10) as of the original
  2026-09-07 check, which is why that check saw no code yet -- pure
  local staleness, not a registry gap. **`gmldem2tif.rb`'s hardcoded
  EPSG:6668 was correct all along; no fix needed, ever.** Updated
  CLAUDE.md/START_HERE.md/PLAN.md to stop describing this as an open
  2号-readiness item.
- **D154: triaged D152's other 9 code-review findings** by re-reading
  the actual code rather than trusting a compacted summary. 2 didn't
  hold up on re-verification (`majority_vote_downsample()`'s
  all-zero-argmax concern -- the `np.where(any_valid, ...)` mask
  already discards it; `aggregation_tile.py`'s "widened race window"
  from D150/D151 -- re-reading the actual diff showed it narrowed the
  window, since `create_archive()` already writes via atomic
  temp-file+`os.replace()`). 6 were real and fixed: all-nodata parent
  tiles in `lineage_extend_low_zoom.py` now skipped instead of
  written+propagated (confirmed 29 of 117 real z7 parent tiles were
  fully empty); the unexplained `factor > 32` rounding cap got a
  comment (confirmed present-but-unexplained in upstream too, not a
  local addition); `lineage_extend_low_zoom.py` and
  `downsampling_run.py`'s duplicated lineage-tile-encoding logic
  extracted into `lineage_downsample.build_parent_tile_bytes()`; a
  `lineage-extend-low-zoom.done` completion marker added (this
  standalone script previously left no on-disk trace it had run);
  `get_cached_reader()`'s misleading "no staleness check needed"
  comment corrected (real latent risk for future long-lived callers
  reading `lineage_extend_low_zoom.py`'s fixed filenames, doesn't bite
  today since that script is single-shot). All verified against real
  production data via a `/tmp` symlink mirror -- production
  `pmtiles-store` untouched at the time. Not yet applied to production
  output at that point (see D155 below).
- **D155: Oliver Wipfli followed up** ("32m might be too much... now
  1m") -- ported upstream's actual commit (`e964a04`, "Clamp vertical
  rounding to 1 meter", #310, one line: `factor > 32` -> `factor > 1`).
  This widens which zooms the cap affects (old: z<=5 only; new: z<=10),
  measured **~65.1% larger** on a 103-item real stratified z5-10
  sample vs. the old cap (giving back a chunk of D148's compression
  win in exchange for finer precision in that band). **Verified before
  regenerating**: all 6,373 real aggregation items have native maxzoom
  >=12 (well above the cap's z<=10 effective range), so a
  downsampling-only regen keeps the archive internally consistent --
  same precondition D148 relied on, re-confirmed for this change too.
  Hidenori's call: **bundle D154's lineage fix into this same
  regen/publish cycle** rather than doing separate cycles.
  - `lineage_extend_low_zoom.py` already re-run in production:
    z7 117->**88** tiles (29 empty ones now correctly skipped),
    z6/z5/z4 unchanged (37/13/6), `.done` marker written for the first
    time. Not yet bundled/merged/published.
  - Elevation: deleted the 8,223 `*-downsampling.done` markers, started
    `downsampling_run.py` in `screen downsample_1m_cap`. **First
    attempt used `DOWNSAMPLING_WORKERS=3`** (mistakenly copied from
    `AGGREGATION_WORKERS=3`'s D131 convention) **and ran far slower
    than D148's own precedent** (~6-10 items/min vs. D148's effective
    ~29/min at 8223 items in 4h45m). Diagnosed: `get_worker_count()`'s
    own coded default for downsampling is actually **5**, "optimized
    for current hardware" -- a different, already-tuned value from
    aggregation's separate, crash-driven 3-worker constraint (D129/D131
    was specifically about aggregation's heavier per-worker GeoTIFF
    memory footprint, not downsampling's lighter tile-decode work).
    Killed the 3-worker run at 383/8223 done and restarted with no
    override (defaults to 5) -- confirmed it correctly skipped the
    383 already-done items via the `.done`-marker freshness check, no
    wasted work. **Still running as of this snapshot** (~1095/8223,
    ~23:13 JST) at a fluctuating ~5-10 items/min -- noticeably slower
    than D148's own 4h45m run despite the same nominal worker count;
    cause not diagnosed (thermal throttling after the fan audibly spun
    up is one live hypothesis, not confirmed), but stable/healthy
    (no crashes, load average ~4-4.5 on a machine with headroom, no
    thermal warnings via `pmset -g therm`). Hidenori's instruction:
    leave it running, don't intervene further.

**What's left once the downsampling regen finishes** (elevation +
lineage, matching D148/D153's own proven sequence):
1. `BUNDLE_DATATYPE=elevation bundle.py` -> `MERGE_DATATYPE=elevation
   merge_japan_bundles.py` (D144 auto-cluster) -> `./pmtiles merge`
   (z0-7 splice) -> `./pmtiles verify`.
2. `BUNDLE_DATATYPE=lineage bundle.py` -> `MERGE_DATATYPE=lineage
   merge_japan_bundles.py` -> `./pmtiles verify` (lineage's
   `lineage_extend_low_zoom.py` re-run is already done, just needs
   bundling).
3. Publish both together to stars -- same delete-then-transfer pattern
   as D142/D145/D153 (`/tmp/publish_d148_d152.sh`-style script; old
   elevation archive on stars will again need deleting first given
   stars' tight headroom).
4. Spot-check known coordinates post-publish, same discipline as D153.

**Also this session, in a sibling repo, fully wrapped up**: at
Hidenori's request,
[`hfu/japan-bridge-lineage`](https://github.com/hfu/japan-bridge-lineage)
(the standalone lineage showcase, previously undocumented) got a
README.md + LICENSE (CC0), and
[issue #1](https://github.com/hfu/japan-bridge-lineage/issues/1) (a
"がっくん" jolt on every scroll-zoom once terrain is on) was
investigated, fixed (`centerClampedToGround: false`, traced to a
per-render-frame terrain elevation feedback loop -- a known, still-open
upstream issue, maplibre/maplibre-gl-js#2937, independent of globe
projection), and **confirmed working by Hidenori on real hardware** --
commented and **closed**. This work is entirely independent of
`mapterhorn-japan-bridge`'s own pipeline; noted here only for
continuity, not tracked in this repo's own `DECISIONS.md`.

A draft reply to Oliver Wipfli (thanking him for both the original
rounding tip and the 1m follow-up) was written collaboratively with
Hidenori in-chat but its send status/channel is unclear from this
session alone -- check with Hidenori before assuming it was sent.

**What's next / open decisions, in likely order**:
1. Let the elevation downsampling regen finish, then bundle/merge/
   splice/verify/publish both datatypes together (see checklist
   above).
2. The two original 2号-readiness items untouched all session: the
   untested 5m/10m corruption-bug-class question (`PLAN.md` §3), and
   the dirty-tracking design decision (`PLAN.md` §4/D57).
3. Resume 1.6-go once `downsampling_covering.py`'s redesign is worked
   out -- not started this session, still blocked (D151).
4. Diagnose why this regen ran slower than D148's own precedent at the
   same nominal worker count, if it recurs -- not urgent, didn't block
   completion.

**Monitoring**: a `Monitor` task (`bt3sw5mpt` as of this snapshot) is
tracking the elevation downsampling regen's progress every 15 minutes
by grepping `/tmp/downsample_1m_cap.log` for the latest `N / 8223`
line and checking the main process (PID printed in the task's own
command) is still alive -- re-arm a similar one (or check
`screen -r downsample_1m_cap`) if resuming after this task has ended.
Once downsampling finishes, the next stages (bundle/merge/verify/
publish) will need their own monitors, same pattern as D148/D153.

**Git state**: all three repos (`mapterhorn-japan-bridge`,
`hfu-mapterhorn`, `japan-bridge-lineage`) were fully committed and
pushed as of this snapshot -- confirmed via `git status --short`
(clean, aside from pre-existing untracked scratch files in
`hfu-mapterhorn` unrelated to this session's edits) and
`git log origin/main..HEAD` (empty) in all three immediately before
writing this. If you're resuming and see otherwise, something changed
after this snapshot was written.
