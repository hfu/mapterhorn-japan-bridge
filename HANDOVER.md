# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-13, 2026-09-19, and again 2026-09-24**: the
2026-09-11 (D156-D161), 2026-09-17 (D162-D173, 1.6号's launch), and
2026-09-19 (D174-D178, the wall fix) "current state" sections have all
been moved into `HANDOVER-archive.md`, unedited. This file keeps only
the current state and a short recent-context summary. Compact again
the same way once this file itself grows unwieldy — archive everything
above the current-state section, keep only a fresh snapshot.

**This handover is deliberately long.** The outgoing session expects
to be cleared and a fresh agent to pick up from here with zero memory
of what happened — read it in full before touching anything, especially
the strategic decision below and the exact next step in "What's next".

## Current state (2026-09-24): D179-D184 -- the coastal-blur fix (D180) and the z13+ wall extension (D182) both designed, implemented, verified, and now running as 1.7号's own full national rebuild

**The short version**: this session (2026-09-20 through 2026-09-24) found and fixed two more real, verified defects on top of 1.6号's already-live archive -- a nationwide "loose coastline" artifact (D180, real 1m DEM1A detail smoothed away by up to 102m near the coast) and a z13+ extension of D174's own wall fix (D182, empirically confirmed near Takeshima). Both are now implemented in `aggregation_merge.py`/`build_wall_fix_archive.py`, exhaustively verified against real production data, and bundled into a freshly-minted generation **1.7号** (`01M39W0T76QKN3GYJCPWX5MDHM`) rather than patched into 1.6号 in place. **1.7号's full national aggregation run is running RIGHT NOW** in a detached `screen` session on `slate` (`screen -r agg_1_7go`, PID 68918 at launch) -- do not start a second one. Expect ~17 hours (matching 1.6号's own original national run, D169) before aggregation finishes; downsampling/lineage/bundle/merge/splice steps still follow after that.

**Read in this order**: D180 (root cause, then two independent Opus design review addenda, then the implementation+verification addendum) is the long one; D182 (the Takeshima discovery, four addenda tracing the scope investigation, the implementation, the build, and the reproducibility check) is almost as long; D183 names the 1.7号 generation; D184 doesn't exist as its own entry -- the 1.7号 ID-minting and launch details are folded into D183's own thread and this handover.

### 1. D179: pre-2号 planning pass, then D181: site update

A routine "what's left before 2号" review (D179) found the wall fix (D174-D178) had never been written into `PLAN.md` §8 as a step 2号's own launch needs to repeat, and fixed that -- see D179/PLAN.md §8 for the exact runbook. Separately, D181 updated the GitHub Pages preview site: swapped the basemap to `bvmap-starlight` (Hidenori's own `hfu/stars` style) and pinned MapLibre GL JS to an exact `6.11.1`. Both shipped, unrelated to what follows.

### 2. D180: the "loose coastline" problem -- root cause, two independent Opus reviews, implementation, verification

Hidenori spotted rounded/soft coastline terrain near Shiripa Cape, Hokkaido, in areas with 1m DEM1A coverage. Root-caused (own investigation, then confirmed independently by two parallel Opus design-review subagents) to `aggregation_merge.py`'s D114(B)/D116 Gaussian seam blur -- a real, previously-validated fix for an unrelated problem (a fabricated near-vertical cliff at boundaries no source will ever fill) -- being applied uniformly to a second, much more common case: a seam between two priority groups that BOTH supplied real, measured data. At z16 the blur's buffer-derived sigma=30 was destroying up to 102m of real 1m DEM1A relief and stamping up to 48m of phantom land elevation onto the sea surface. D166's land-area upsampling (1.6号's own feature) made this worse for 2,126 of 4,133 land items by pushing their effective build zoom from z13/z14 (where the same blur was nearly harmless) up to z16.

**Both Opus reviews independently converged on the same fix**: split `boundary_tile` into a `never_covered_boundary` class (D116's own real target, unchanged sigma) and a `seam_boundary` class (capped at a new `utils.seam_blur_sigma_max = 6`), both blended from the same pre-blur composite so the result is bitwise-identical to the old code whenever `seam_boundary` is empty.

**Implemented and verified** (own work, not just the reviews' reprojected-copy harnesses -- ran the REAL modified `merge()`):
- D116 synthetic case + a real production item with 51.75% never-covered pixels (`12-3500-1741-13`, the exact case both reviews flagged as the single most important untested gap): **bitwise identical**, max diff 0.0.
- Real Shiripa Cape item (`12-3649-1501-16`): mean damage to real DEM1A land pixels 0.228m → 0.015m, >10m-error pixel count 238,479 → 10,456 -- matches one review's own cap=6 prediction (10,456) exactly.
- Hillshade render, old vs new side by side: coastline goes from a featureless black smear to visibly restored rock texture and offshore islets (sent to Hidenori, saved at `/tmp/d180impl/hillshade_before_after.png` on `slate` if it survives the scratchpad).

Committed to `hfu-mapterhorn` (`4581cbb` -- `aggregation_merge.py`/`utils.py`).

### 3. D182: the z13+ wall extension -- Takeshima, then a much bigger scope than expected, then implemented and merged

Hidenori spotted a wall artifact near Takeshima on the live site (after D181's basemap swap). Reproduced exactly via headless Chrome (`playwright` + the system's installed Google Chrome.app, since this session never got `claude-in-chrome` connected) against the real hash URL, pinpointed the ground position with `map.unproject()`+`queryTerrainElevation()` (-19732m at the wall's base -- the same degenerate-negative-elevation signature as D113-D118/D174). Confirmed z8-z12 tiles there are clean (D174's fix working) but z13-z16 all return 204 -- **this is exactly the "z13+ empirical question" D177 explicitly deferred**, now answered: yes, the wall recurs one zoom level deeper, and the true GLO-30 gap at that position (`N37_00_E132_00`/`N38_00_E132_00`, confirmed absent from the upstream inventory) is real.

**Then the scope turned out to be much bigger than D174's original framing implied**: a completely "normal" open-ocean point far from any known gap (30.0N/140.0E) showed the identical z13+ 204 pattern -- because sea-only z12 macrotiles never build past z12 by design (D149), independent of whether GLO-30 itself has a gap there. Precise measurement via a fast directory walk (not per-position scanning, which was too slow): of 223,800 real z12 tiles, 214,090 are "leaves" (no real z13 child). Hidenori chose the broad fix ("(b)じゃないかな。同じ空タイルならそれほど容量もとるまいね") once storage cost was confirmed cheap (pmtiles' own dedup).

**Implementation caught a real safety gap of its own**: the "broad" category can't safely use "present in the global GLO-30 inventory" (that inventory also covers real foreign land -- Korea, China, Russia, Taiwan -- inside the same 116-160E/15-52N box, which this project never downloaded and can't vouch for). Added `sea_fill_eligible()`, checking instead against `jpnationalsea`'s own downloaded 275-cell set. Real classification: 152,437 narrow (D174's own criterion, unchanged) + 34,887 broad (newly confirmed ocean) + 26,766 correctly left unfilled (touches unverified territory) = 187,324 eligible leaves × 340 descendant tiles = 63,690,160 fill tiles.

Built for real, merged into `bundle-store/mapterhorn-japan-bridge.z13fix.pmtiles` (272,864,968,030 bytes, only ~17KB more than the pre-fix 272,864,950,554 -- full dedup confirmed). `check_pmtiles_integrity.py` verified all 67,311,837 tiles: zero orphans, `addressed_tiles_count` matches the exact expected sum. Directly decoded the five originally-204 Takeshima-area positions: all now present, 52 bytes, 0.00m. Fuji's summit tile confirmed byte-identical before/after. Reproducibility verified: reran the build into a separate file, MD5 didn't match at first, but all 4 differing bytes (of 16,086 total) traced exactly to gzip's own MTIME header field -- the fill logic itself is fully deterministic.

Committed to `hfu-mapterhorn` (`9a2c8e8` -- the z13-z16 mode itself). **`mapterhorn-japan-bridge.z13fix.pmtiles` was never swapped into the live local path or published to `stars`** -- superseded by the decision below to fold it into 1.7号 instead of patching 1.6号 standalone. It still exists in `bundle-store/` and is safe to delete once 1.7号's own build supersedes it, but don't delete it before then without checking this note is stale.

### 4. D183: name the combined fix generation "1.7号", not "2号"

Hidenori: "z13+拡張にも着手するよ。2号はデータ更新を反映したときに使いたいので、必要であれば、1.7号という新しい名前にしてくれればいい。" -- 2号 stays reserved exclusively for the next real GSI DEM1A data update; this pipeline-only fix round (same source data as 1.6号, D180+D182 both bundled in) gets its own label, matching the 1.5号→1.6号 precedent. `PLAN.md` §0 updated.

### 5. 1.7号 launched: generation minted, the reuse trap found and avoided, national aggregation running now

**Critical finding before launch**: `aggregation_covering.py`'s `try_reuse_from_previous_generation()` (D163's dirty-tracking) only fingerprints INPUTS (covering CSV content + source file MD5s), never code version. Since 1.7号 uses the exact same source data as 1.6号, this mechanism would have silently COPIED 1.6号's own pre-D180-fix output into 1.7号 for every item, completely defeating the point. Caught before launch, not after.

**What actually ran, in order**:
1. Minted `01M39W0T76QKN3GYJCPWX5MDHM` (`str(ULID())`), added to `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` (target z16, same as 1.6号) in the same commit as minting (D166 finding #3's own discipline). `hfu-mapterhorn` `dcd2e75`; `mapterhorn-japan-bridge` `07b1a20` (PLAN.md §0 updated with the real ID).
2. Disk headroom check found `/Volumes/Migrate-2025-04` at **CRITICAL** (106.2GB free, below the 120GB threshold) -- `bundle-store/` held three ~254GB near-duplicate elevation archives at once. Deleted `mapterhorn-japan-bridge.pmtiles.pre-wallfix-20260919` (the 5-day-old pre-D178 backup, already long superseded and stable) with Hidenori's explicit approval. Freed to 380GB, back to `ok`.
3. `AGGREGATION_ID=01M39W0T76QKN3GYJCPWX5MDHM DISABLE_AGGREGATION_REUSE=1 uv run python aggregation_covering.py` -- confirmed "0/6373 reused ... 6373 queued for (re)processing", proving the reuse trap above was actually avoided, not just theorized about.
4. Launched the real run **inside a detached `screen` session** (not a bare background shell job, so it survives this session's own compaction/restart): `screen -dmS agg_1_7go bash -c 'EMIT_LINEAGE=1 uv run python aggregation_run.py > /tmp/d182/agg_1_7go_run.log 2>&1'`, from `hfu-mapterhorn/pipelines/`. Confirmed running: `start aggregating 6373 items... using 3 workers` (the D130/D131-fixed default, no override needed). `AGGREGATION_WORKERS`/`EMIT_LINEAGE=1` match 1.6号's own launch convention exactly.

**Still pending, asked but not yet confirmed as of this snapshot**: whether to also delete `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916` (478GB, D171's own 1.5号 backup, long superseded) for additional headroom ahead of 1.7号's own downsampling output. Check pmtiles-store's own free space and whether this session (or a resuming one) got an answer before assuming either way.

### What's next, in likely order

1. **Nothing to do right now except let `agg_1_7go` run and check on it periodically** (`screen -r agg_1_7go` to attach, `Ctrl-A D` to detach again without killing it; or just tail `/tmp/d182/agg_1_7go_run.log` -- note this log path is under the session scratchpad and may not survive a machine reboot, though the screen session and its own stdout redirect will keep working as long as `slate` itself stays up). Expect ~17 hours for aggregation alone, matching D169's own precedent.
2. Once aggregation finishes: `downsampling_covering.py`, then `downsampling_run.py` for both `elevation` and `lineage` datatypes, then `lineage_extend_low_zoom.py`, then `bundle.py` for both datatypes, then `merge_japan_bundles.py` for both datatypes -- the full pipeline sequence from `CLAUDE.md`'s own "Pipeline" section, using generation `01M39W0T76QKN3GYJCPWX5MDHM` throughout (should resolve automatically as the latest, but verify with `ls aggregation-store/` before trusting that).
3. **Re-apply D174's z8-z12 wall fix AND D182's z13-z16 extension to 1.7号's own freshly-built archive** -- these are NOT automatically included by the aggregation run itself; they're a separate `build_wall_fix_archive.py` pass (all three modes: z0-7, z8-z12, z13-z16) run against 1.7号's own merged elevation archive after `merge_japan_bundles.py` produces it, exactly the same runbook `PLAN.md` §8 already wrote out for 2号's own eventual launch. Don't publish 1.7号 without doing this -- otherwise 1.7号 would regress D174/D178's own already-shipped fix.
4. Full local verification (`pmtiles verify`, `check_pmtiles_integrity.py`, visual spot-checks at Shiripa Cape and Takeshima at minimum) before any `stars` publish -- this is a much bigger change than any prior generation's launch (new blur algorithm affecting all 4,133 land items nationwide, plus the z13-z16 fill), so don't shortcut verification relative to 1.6号's own launch discipline (D172/D173).
5. `stars` publish needs Hidenori's own separate explicit go-ahead, same as every prior generation -- do not publish without asking, even once local verification is clean.
6. Decide what to do with `bundle-store/mapterhorn-japan-bridge.z13fix.pmtiles` (D182's standalone 1.6号-based z13-z16 fix, 254GB, never swapped or published) -- almost certainly safe to delete once 1.7号's own build supersedes it, but don't delete pre-emptively.
7. Resolve the still-pending question about deleting `/Volumes/pmtiles-store/1.5go-bundle-store-archive-20260916` (478GB) if it wasn't answered before this handover was read.
8. Once 1.7号 ships, `PLAN.md`/`START_HERE.md`/`DECISIONS.md`'s generation summaries all need updating to reflect it, matching the pattern used for every prior generation's own launch.
9. Older open items, all still real, still not blocking: D172's 116-tile lineage orphan gap; D170's reuse-fingerprint producer-version gap (note: this session's own D180/D182 experience is a live example of the SAME underlying risk class -- a fingerprint that doesn't detect a relevant change -- worth reading D170 again with this in mind); `bundle.py`'s own non-atomic `create_archive()` (D171); cafebabe's still-unanswered D175 viewer check; reporting the shared Copernicus GLO-30 gap to Oliver Wipfli; GSI's next DEM1A update (live-checked 2026-09-24, still 2026-07-31 -- 2号 remains not triggered).

### Git state

`mapterhorn-japan-bridge` HEAD as of this snapshot: `07b1a20`. `hfu-mapterhorn` HEAD: `dcd2e75`. Both should be clean and pushed -- verify with `git status --short` / `git log origin/main..HEAD` in both before trusting this note, same caveat as every prior handover. `bundle-store/` on `slate` currently holds: `mapterhorn-japan-bridge.pmtiles` (1.6号, current, z8-z12-fixed only), `mapterhorn-japan-bridge.z13fix.pmtiles` (D182's standalone z13-z16 extension of 1.6号, built+verified, never swapped/published, likely to become obsolete once 1.7号 ships), `mapterhorn-japan-bridge-lineage.pmtiles` (1.6号 lineage, untouched), and the three small `wall-fix-*.pmtiles` provenance files. `aggregation-store/01M39W0T76QKN3GYJCPWX5MDHM/` now holds 1.7号's own covering+todos, actively being processed by the `agg_1_7go` screen session.

If you're resuming and `git status`/`git log origin/main..HEAD` show anything other than clean, or `screen -list` doesn't show `agg_1_7go` running, something changed after this snapshot was written — investigate before assuming this handover is still accurate.
### 0. D160 — the mission does NOT wind down just because upstream caught up

This is not optional background reading. A project-wide review (done
at Hidenori's request) found that upstream `mapterhorn/mapterhorn`'s
`jpdem1a` source is now fed by Oliver Wipfli's own
`wipfli/japan-download` (new 2026-08-21), which reads **this project's
own sibling product** `smartmaps/japan-geotiff-dem`'s
`latest_file_list.csv.gz`. Measured directly: our `jpnational1` file
list and that public list are **the same 291,779 files, identical MD5
of the sorted filename set**.

The agent doing that review proposed retiring the bridge without ever
running 2号, on the theory that the source-level gap this bridge exists
to close has already closed. **Hidenori explicitly rejected that
proposal.** His reasoning, verbatim from the session: being upstream's
Japan data supplier is now a standing obligation, and the only way to
keep `latest_file_list.csv.gz` trustworthy is to keep consuming it in
a real national build and catching what breaks. Stop building and
nobody is checking what gets published upstream.

**If you are a future session and you independently notice "hey,
upstream's data source is now the same as ours" — that discovery has
already been made and already been acted on. Do not re-propose
retirement. Read D160 in full before raising the question again.**
This is now baked into `CLAUDE.md`'s own Mission section too, so it
should be hard to miss, but it bears repeating here because it is the
kind of insight that feels newly-discovered and urgent to whoever
finds it next.

One thing this discovery *did* change: the framing of what 2号 is for.
It is not "close the gap before upstream does" (the gap is effectively
closed already) — it is "keep the supply chain honest by continuing to
exercise it," plus a hedge against upstream's own release timing
(Oliver's releases are demand-driven, per D42, so a materially-updated
source does not automatically mean materially-updated published
tiles).

### 1. D155/D154's regen finished and published clean

The elevation downsampling regen (rounding cap 32m→1m, Oliver's
follow-up commit) that was still running when the last handover was
written completed successfully — all 8,223 items, confirmed via
`check_downsampling_done_integrity.py` (0 stale). D154's lineage fix
(skip all-nodata parent tiles in `lineage_extend_low_zoom.py`) had
already been re-run in production (z7: 117→88 tiles).

From there: `bundle.py` → `merge_japan_bundles.py` (D144's automatic
`pmtiles cluster`) → `./pmtiles merge` (z0-7 global overview splice,
elevation only) → `./pmtiles verify` → publish to `stars`, for both
datatypes, following D148/D153's proven sequence. **This is now fully
done and verified.** The publish ran 02:05→08:17 JST (6h12m,
`screen publish_d155_d157`, script preserved at
`/tmp/publish_d155_d157.sh`), exit code 0, no errors.

**Post-publish spot check, all seven checks matched a prediction
written into the check script *before* running it** (script preserved
at `/tmp/spotcheck_d155.sh` — reusable template for the next publish):

| check | prediction | actual | why this pair matters |
|---|---|---|---|
| elevation z13/6894/3521 (Yonaguni, aggregation layer) | unchanged, 64,276 B | **64,276 B** | proves the regen did NOT touch the aggregation layer |
| elevation z8/219/101 (Tsushima/Goto, downsampling layer) | ~+65% (~102 KB) | **103,546 B** (+67.5% from D153's 61,812) | proves the new 1m cap DID take, in the z≤10 band it targets |
| lineage z8/219/101 | unchanged, 490 B | **490 B** | this is D154's *source* zoom, not a rewritten one |
| lineage TileJSON minzoom | 4 | **4** | D146's low-zoom extension survived the regen |

The z13-unchanged / z8-changed pair is the actual proof, not either
number alone — z13 alone could not rule out "the regen silently
touched aggregation too," and z8 alone could not rule out "the new cap
never took effect." Neither single observation distinguishes those
failure modes; only having both does. Keep this pairing technique for
future spot checks — it recurred twice more in this same session (see
§3 below) and seems to be a generally useful pattern for this
pipeline's verification work.

`stars`' own session independently re-fetched all three cited tile
byte counts and confirmed an exact match — see §5 below for the
cross-session collaboration this involved.

### 2. Three of four pre-2号 housekeeping items are done; one is deferred by design

`PLAN.md` §8 has the full checklist. Status:

- ✅ **`START_HERE.md`'s stale machine table** — `japan-geotiff-dem`
  was listed as living on `aalto`; it has been on `slate` since D12
  (weeks ago). Fixed. Also rewrote the "everything happens on slate
  over SSH" line into "check `hostname` first" — that flat assertion
  is literally what caused D156 (below).
- ✅ **`check_disk_headroom.py`'s thresholds and blind spot** — old
  defaults (warn 200GB / critical 80GB) were guesses, and were
  demonstrably too low: D157's ENOSPC crash happened with 228GiB free,
  which this script logged as "ok". New defaults (300/120GB) are
  derived from the actual measured requirement of the largest single
  stage (elevation merge, 237.4 GiB in → out). Also added: when either
  volume is under pressure, the script now also reports the size of
  the two scratch subtrees (`writer-scratch`, `go-cli-scratch`) — a
  volume-level free number alone cannot distinguish "genuinely full of
  real data" from "full of a week-old crash's garbage," which is
  exactly what caused D157. Committed as `hfu-mapterhorn` `216fb22`.
- ✅ **Stale upstream clone removed** — `github/mapterhorn` (a plain,
  unmodified clone of `mapterhorn/mapterhorn`, last fetched
  2026-06-10, 123MB) sat right next to the real working fork
  `github/hfu-mapterhorn` under a confusingly similar name. Verified
  it held no uncommitted work, no unpushed commits, no stashes, and
  that its remote was reachable (so re-cloning is always possible) —
  then Hidenori approved deletion and it's gone. **If you need
  upstream's content going forward, use `hfu-mapterhorn`'s own
  `upstream` remote** (`git fetch upstream`) — that is now the only
  path.
- ⬜ **Publish script's delete-then-transfer ordering** — deliberately
  NOT changed this session, because the D155 publish was already
  running on the old script when this became actionable. `stars`'
  free space grew from 201GB to 1.6TB during this session (D159,
  Hidenori's own infra work), which removes the reason the old
  ordering existed (there wasn't room to keep both old and new
  simultaneously). **Apply the new ordering
  (`.new` transfer → verify → delete old → atomic rename) when writing
  2号's own publish script** — it eliminates the window where the live
  archive is briefly absent, which is exactly what triggered the
  `stars`-session incident in §5.

**Unplanned bonus from the `check_disk_headroom.py` fix**: the very
first run under the new scratch-reporting code found **765GiB of
orphaned `go-cli-scratch` files** (seven temp files from `pmtiles
cluster`/`merge` runs dating back to 2026-09-06, largest 311GB, none
held open by any process — confirmed via `lsof`). Hidenori approved
deletion; `/Volumes/pmtiles-store` went from 569Gi free to 1.3Ti free.
The fix that was supposed to help *next time* helped *the same day it
was written*.

### 3. `stars` now writes its own name/description at generation time

`stars`' own Claude session asked (mid-session, over the cross-session
messaging channel — see §5) that the published archives' Martin
catalog `name`/`description` fields be set by the pipeline itself,
rather than patched after publish with `pmtiles edit` — which rewrites
the *entire file*, an unacceptable risk against a 258GB archive.
Implemented in `hfu-mapterhorn`'s `merge_japan_bundles.py`
(commit `010b558`):

- `name`/`description` are now written into `writer.finalize()`'s JSON
  metadata, for both datatypes. Confirmed (by reading `./pmtiles
  merge`'s own log line, "Copying center and JSON metadata from first
  input") that the later z0-7 splice step preserves whatever this
  script wrote, since this script's own z8plus output is always that
  splice's first input.
- **`name` deliberately does NOT equal the Martin source id.**
  `stars` pointed out that Martin's own source code
  (`martin-core/src/tiles/source.rs`) filters the name with
  `.filter(|v| *v != id)` — a name identical to the id silently
  disappears from the catalog. So: `Mapterhorn Japan Bridge:
  nationwide terrain` (elevation) / `Mapterhorn Japan Bridge: source
  lineage` (lineage) — the lineage string matches what `stars` had
  already set by hand, so the catalog entry does not churn between
  publishes.
- Also ported upstream's `ca98d40` (#313, "Add encoding terrarium in
  PMTiles metadata") — **elevation only**. Lineage tiles are a
  single-channel source-tier category, not Terrarium-packed heights,
  so adding `encoding: terrarium` there would misdescribe the data to
  any client reading that field.
- **Not yet exercised against a real publish** — this only takes
  effect starting with 2号's own bundle/merge run. Today's published
  archives (the ones just verified in §1) do not have these fields
  yet; `stars` is manually re-adding the lineage name by hand in the
  meantime (elevation is left as-is per their own risk call).

### 4. Two operational incidents this session, both harmless, both instructive

**D156 — the agent was running ON slate, not on some remote host
SSHing into it.** Wasted real time trying `ssh hfu@slate.local` and
hitting "Too many authentication failures" — a self-connection loop.
`CLAUDE.md`'s own "everything runs on slate over SSH" framing (now
softened, see §2 above) is what led to this. The decisive test that
resolved it: `diskutil info /Volumes/Migrate-2025-04 | grep Protocol`
returned `USB` — a USB-attached disk can only ever mount as `local` on
the machine it is physically plugged into, so `hostname` returning
`slate.local` plus this protocol check together prove the session
*is* slate. **Check `hostname` and this protocol trick before ever
reaching for SSH** — CLAUDE.md, START_HERE.md, and PLAN.md all now say
this explicitly.

**D158 — `/Volumes/Migrate-2025-04` briefly disconnected and
auto-recovered.** Right as the stars publish was about to start, the
volume unmounted (a USB re-enumeration — its `diskN` identifier
changed from `disk6` to `disk4`, and has since changed again to `disk6`
in a later check this same session; **always refer to volumes by
mount point, never by `diskN` identifier**, per D158/START_HERE.md).
Auto-remounted about 90 seconds later via a backgrounded `diskutil
mount`. No data loss — the two just-completed output archives were
confirmed byte-identical (size + mtime) before and after, and
`pmtiles verify` passed on both post-recovery. If this happens again
*during* an active write (as opposed to right after one, which is what
happened this time), expect the affected stage to crash and need a
rerun, same class of recovery as D157.

### 5. Ongoing live collaboration with the `stars` session

This session communicated directly with another live Claude session
named `stars` (the serving host) via the cross-session `SendMessage`
tool throughout this session — this is a real, working communication
channel, not a one-off. Topics covered: reassuring `stars` mid-transfer
that the archive wasn't lost (their own new daily-snapshot dashboard's
first run happened to catch the transfer's dead window and flagged
`mapterhorn-japan-bridge` as "removed"), the metadata request in §3,
and independent verification of the post-publish spot check.

Two structurally interesting findings came out of this exchange, both
worth remembering as a *pattern* rather than just a fact:

- `stars`' own catalog↔disk reconciliation could not detect this kind
  of transient disappearance, because a directory-auto-discovered
  source (like this one) vanishes from the catalog at the exact same
  moment its file vanishes from disk — so a reconciliation pass always
  sees "consistent," never "missing." Only a diff between successive
  daily snapshots (`dataset_removed`) could catch it. `stars` has
  since added a `staging` bucket that recognizes in-flight `.new`
  files by name, so a future publish reads as "transferring" rather
  than "gone."
- This is the same shape of problem `check_disk_headroom.py` had (§2):
  a single number (free space; or "is it in the catalog") cannot
  distinguish two situations that need different responses. The fix
  in both cases was the same: report a second, more specific number
  alongside the first (scratch-tree size; a staging bucket) so the
  two situations become distinguishable from the log/catalog alone.
  If you hit something similar elsewhere in this pipeline, this
  pattern — "what's the second number that would make this
  ambiguous state legible?" — is probably the right lens.

If `stars` messages this session again (a comment, a question, a
report from their own dashboard), that is a live peer conversation —
reply via `SendMessage` to the `stars` name, same as before.

### 6. Something raised but NOT resolved: SSH access from this environment

Near the end of the session Hidenori mentioned he'd made the disks
under `/Volumes` "accessible via SSH sessions" — intending, it turned
out, that a session running on `aalto` (or any other host) SSHing into
`slate` should now see `/Volumes/pmtiles-store` etc. This session
could not verify that claim, because this environment's own
`~/.ssh/authorized_keys` on `slate` contains exactly one key
(`aalto-to-slate-hfu@aalto`), and none of this environment's own
keys (`id_ed25519`, `id_rsa`, etc.) match it. Since this session
already runs directly on `slate` (see D156), it never needed to SSH
in anyway, so this was never actually blocking anything — but it
remains **unverified**, and adding this environment's own public key
to `authorized_keys` was explicitly not done (that's a security-config
change, out of scope for an agent to decide unilaterally without a
clear go-ahead). If a future session needs to confirm this, either:
(a) have Hidenori test `ssh hfu@slate.local` from `aalto` itself and
report back, or (b) get explicit, specific authorization to add a key
before touching `authorized_keys`.

### What's next, in likely order

1. **Nothing is currently blocking.** The D155/D154 cycle is fully
   published and verified; there is no running job to babysit.
2. Whenever 2号 actually starts (see D160 — it is a "when," not "if
   upstream hasn't caught up yet"): write its publish script using the
   transfer-then-delete ordering (§2), and confirm the new
   name/description/encoding metadata (§3) actually shows up correctly
   in the resulting archive before treating that as done.
3. The two original, still-untouched 2号-readiness items from
   `PLAN.md` §8: the untested 5m/10m corruption-bug-class question
   (`PLAN.md` §3) and the dirty-tracking design decision (`PLAN.md`
   §4/D57).
4. GSI's next DEM1A update — live-checked 2026-09-11, still
   **2026-07-31** (no new update). Cadence has been roughly quarterly;
   next expected around November–December 2026. This is what actually
   gates 2号's *launch timing*, independent of the D160 policy
   question of whether to launch it at all (settled: yes).
5. Someday, not urgent (Hidenori's own framing, D160): the coastal
   erosion-gate bug fix (`hfu-mapterhorn` commit `1b6e4e1`, D114(B)/
   D116) is a genuine, generic upstream-quality bug fix (not Japan-
   specific) with both a synthetic test suite and real-data no-
   regression evidence already in hand — a strong candidate for an
   eventual upstream PR, whenever contributing upstream becomes a
   priority.
6. Resume "1.6号" once `downsampling_covering.py`'s redesign is worked
   out — untouched this whole session, still blocked on the same
   design question as before (D151).

### Also wrapped up this session, unrelated to the pipeline itself

A full project-wide inventory (repos, machine roles, timeline,
upstream sync candidates, upstream contribution candidates) was
produced as an Artifact and shared with Hidenori — it has since been
updated in place to reflect D160's decision. If you need it, it is
this session's most recently published Artifact; ask Hidenori for the
link if it isn't otherwise available to you, since a fresh session
cannot always reach a prior session's own Artifact history directly.

### Git state

All three repos (`mapterhorn-japan-bridge`, `hfu-mapterhorn`,
`japan-bridge-lineage`) were fully committed and pushed as of this
snapshot. `mapterhorn-japan-bridge` HEAD is D161's own commit chain
(latest: "D161: publish D155/D154 to stars, spot check clean, clear 3
housekeeping items"). `hfu-mapterhorn` HEAD is `010b558` (the
name/description metadata work); it has some pre-existing untracked
scratch/rehearsal files unrelated to this session
(`pipelines-rehearsal*/`, a few `screen_results_*.csv`) — leave them
alone unless you know what they are. `japan-bridge-lineage` is
unchanged since the previous handover (issue #1 closed, nothing
pending there).

If you're resuming and `git status`/`git log origin/main..HEAD` show
anything other than clean, something changed after this snapshot was
written — investigate before assuming this handover is still accurate.
