# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-13**: the 2026-09-11 (morning JST) "current state"
section (D156-D161, the D160 strategic decision, D155/D154 publish) has
been moved into `HANDOVER-archive.md`, unedited. This file keeps only
the current state and a short recent-context summary. Compact again the
same way once this file itself grows unwieldy — archive everything
above the current-state section, keep only a fresh snapshot.

**This handover is deliberately long.** The outgoing session expects
to be cleared and a fresh agent to pick up from here with zero memory
of what happened — read it in full before touching anything, especially
the strategic decision below and the exact next step in "What's next".

## Current state (2026-09-14): D162-D167 -- a live data-quality bug found and fixed, safe cross-generation reuse designed and implemented, 1.6号's upsampling feature implemented after a design review caught a catastrophic flaw in the original plan, and all of D165's deferred findings closed (one of them after ANOTHER Opus-caught near-miss)

**Read `DECISIONS.md` D162 through D166 for the full arc (all in
`DECISIONS1.md`, the detail file `DECISIONS.md`'s own table links
into) — this was one long session with five numbered decisions, two of
which (D165, D166) are substantial engineering work, not just records.**
Summary, most important first:

### 0. The single most important methodological result of this session: ask for review BEFORE writing code, not just after

This session validated, three times now, a workflow Hidenori explicitly
requested mid-session and that should become standing practice for any
nontrivial pipeline change from here on: **write a design as a text
document, have an independent reviewer (Opus, via a background Agent)
critique the DESIGN before any code exists, revise, THEN implement,
THEN have Opus code-review the implementation, THEN re-verify against
real data.**

The concrete payoff (see §4 below for the full story): the first
design for 1.6号's upsampling feature proposed a `resolve_layer()` fix
that — verified against real 1.5号 data — would have silently broken
**49.9% of all real child-layer references nationwide, completely
unrelated to upsampling**, the moment the code was merged. This was
caught by a design review BEFORE a single line of that fix was
written. A second Opus pass, this time reviewing the actual
implementation of the corrected design, then found 7 more real issues
(all fixed). A THIRD pass, the next day (§5, D167), reviewing what
looked like a small, mechanical cleanup fix for D165's #10, found that
its cleanup glob would delete the CURRENT item's own `.done`/`.todo`
sidecars on every re-covering pass — a bug the fix's own
author-written test could not have caught, since the test never gave
the current item real sidecars to lose. If you are about to implement
a nontrivial change to `aggregation_covering.py`,
`downsampling_covering.py`, `utils.py`'s shared machinery, or anything
else touching the generation/layer/datatype namespace, do the same:
write the design as a short text file (not a live conversation — the
reviewer needs a self-contained document), spawn an Opus-model Agent
to review it in the background, and don't trust a "looks correct, my
test passes" diff on its own — send it for code review too, even when
the change looks small.

### 1. D162: two "already resolved but nobody updated the tracker" staleness bugs, both fixed

Unrelated to each other, found while checking whether `PLAN.md` §8's
2号-readiness checklist was still accurate before touching it:

- `PLAN.md` §3/§8's "5m/10m corruption-bug-class question, never
  tested" line had been carried forward unchanged through at least
  three later edits (2026-09-06/09/11) despite `DECISIONS0.md` D35
  having actually closed it on **2026-08-25** — `screen_source.py`'s
  real output files (`hfu-mapterhorn/pipelines/screen_results_
  jpnational{5,10,sea}.csv`, still on disk, untracked, don't delete
  them) were re-read this session and their row counts/zero-valid-pct
  counts matched D35's own numbers exactly. Fixed the checklist; this
  is no longer an open 2号-readiness item.
- `japan-geotiff-dem-repo`'s local clone on `slate` was simply ~1 month
  behind its own `origin/main` (fast-forwarded, clean). Separately,
  even `origin/main` itself stopped recording D18's corruption-fix
  saga partway through ("partially fixed, investigation ongoing") —
  the actual closure (48/48 files fixed, full 109-mesh sweep done,
  5m/10m/sea confirmed unaffected) only ever got written into *this*
  repo's own `DECISIONS0.md` D35, never back into that repo's own
  `HANDOVER.md`/`DECISIONS.md`. Backfilled a closing addendum there so
  a future session reading that repo in isolation doesn't restart
  already-finished work.

### 2. D163/D164: safe cross-generation reuse (dirty-tracking) redesigned, implemented, and self-reviewed

D57 (2026-08-29, see the archived handover) had ripped out
`aggregation_covering.py`'s original cross-generation "skip if
unchanged" optimization after it silently lost 2,343 native positions
across 1号. This session designed and implemented the safe replacement
Hidenori asked for, reusing D119/D120's existing `.done`-manifest
fingerprint machinery instead of reinventing dirty-tracking:

- `aggregation_covering.py`'s `try_reuse_from_previous_generation()`:
  an item is only reused from the immediately-previous generation when
  (a) that generation's own manifest is a real, non-legacy,
  fingerprint-bearing one, (b) today's fingerprint — the covering
  CSV's own content AND every referenced source file's own MD5 (new:
  `utils.md5_input_entries_for_aggregation_csv()`, closing the exact
  D18/D35 "same filename, same size, silently different content" gap a
  content-only fingerprint can't see) — exactly matches what that
  manifest recorded, and (c) the previous generation's own pmtiles-
  store output file actually exists on disk. On a match, the file is
  COPIED into the current generation's own folder and a fresh manifest
  written — never a bare cross-generation reference.
- A **self-review pass** (this session's own idea, before Hidenori
  asked for Opus) found and fixed 10 more issues in that same feature,
  most importantly: `done_is_current()`'s legacy-manifest bypass
  (`{}` → "always current") was reachable from the new reuse check,
  which would have silently reintroduced the exact D18/D35 gap the
  whole feature exists to close if a future generation's predecessor
  ever had a corrupt/legacy manifest. Also while re-checking D120's own
  old Fable-review tracking table: 5 of 6 previously-"unaddressed"
  items turned out to already be fixed (their own code comments cite
  D120 by name — the table just never got updated); the 6th
  (`aggregation_merge.py`'s non-atomic `merged-3857.tiff` write) was
  genuinely still open and is fixed now.
- 1.5号's own 6,373 `.done` manifests were backfilled (metadata-only,
  no binary files touched) with the MD5 fingerprint entries needed so
  a future generation can actually compare against it.

### 3. D165: an Opus review of the ENTIRE production pipeline (not just this session's own diff) found a live data-quality bug already affecting the published 1.5号 archive

Per Hidenori's own explicit sequencing ("Claude's own findings clear
first, then an independent Opus review, then a dress rehearsal only
once bug-squashing feels thorough"), a background Opus Agent reviewed
`source_download.py` through `bundle.py`/`merge_japan_bundles.py` — the
whole chain, not just the D163/D164 diff. Found 10 confirmed issues;
**4 fixed this session, 6 deferred with reasons recorded**:

**Fixed, most important first**:
- **`aggregation_merge.py` zero-filled every nodata pixel
  unconditionally** (both its single-group and multi-group code paths)
  before `aggregation_tile.py` ever saw the data — so the alpha-channel
  "preserve gaps as real nodata, not fake 0m" mechanism
  (`utils.save_terrarium_tile()`'s own docstring) was always fully
  opaque. **Verified live: 315/315 sampled 1.5号 elevation tiles decode
  with no alpha plane at all; a 519-tile sample found 5.59% of leaf
  pixels affected.** Root cause traced to `1b6e4e1` (D114(B)'s "hard
  cliff" fix, which correctly made the zero-fill unconditional to stop
  a worse bug, but never restored nodata semantics afterward). Fixed by
  snapshotting which pixels no group ever filled BEFORE the
  numerically-required zero-fill, then restoring `-9999` afterward only
  where the gaussian blur made zero contribution (preserving D114(B)'s
  coastal-transition smoothing exactly — verified byte-identical in a
  synthetic replay of that scenario). Re-verified against real
  1.5号 source-only items: one goes from 0% to 97.4% correctly-nodata
  instead of shipping as flat fake sea-level terrain. **This bug is
  still live in the currently-published 1.5号 archive on `stars`** —
  the fix is in `hfu-mapterhorn` but nothing has been republished yet.
- `lineage_provenance.py`'s `compute_provenance()` had the exact D48
  glob hazard `aggregation_merge.py`'s own glob was already narrowed to
  avoid (an unguarded `*-3857.tiff` also matches `merged-3857.tiff` on
  a crash-and-resume) — narrowed to match.
- `aggregation_covering.py`'s `write_aggregation_todos()` ignored the
  `AGGREGATION_ID` override `main()` had just honored — re-planning a
  specific non-latest generation was a silent no-op while an unrelated
  (actually-latest) generation got churned instead. Now takes an
  explicit `aggregation_id` parameter.
- `remove_dangling_pmtiles.py`'s D146 lineage-low-zoom exclusion (see
  §4 below — this got folded into the same fix as the upsampling
  feature's own version of the same problem).

**Deferred, with reasons** (see `DECISIONS1.md` D165 for full text):
`aggregation_run.py`'s/`downsampling_run.py`'s own `.done` checks don't
verify output existence or freshness the way `aggregation_covering.py`'s
reuse path does (#3/#5); `lineage_provenance.py`'s `compute_provenance()`
reads whole rasters unwindowed, up to ~10.7 GiB/worker on the largest
real items, the same memory axis D129's kernel panic came from (#6);
`downsampling_run.py`'s tmp folder isn't datatype-scoped, a risk only
if elevation/lineage passes are ever run concurrently (#8); stale
coverings from a re-plan aren't cleaned up, dormant today (#10,
PLAUSIBLE not CONFIRMED).

### 4. D166: 1.6号's land-area maxzoom upsampling — implemented, after a design review caught the original plan would have been catastrophic

Background: D149-151 (see archived handover, 2026-09-07) designed
"1.6号" — upsampling land-only aggregation items whose native source
resolution tops out at 5m/10m (51% of all land items, not just "a few
remote islands") up to z16 via `gdalwarp -r cubicspline`, so
tile-existence gaps stop rendering badly (HTTP 204 client-side
fallback isn't in any released MapLibre yet). Two fixes were proposed
but never implemented, blocked on: `downsampling_covering.py`'s
`get_extents_from_coverings()` can't see upsampled leaves (their
covering CSV filename keeps the native/planned child_z forever, by
design, since D163/D164's dirty-tracking needs that identity stable).

This session (a) asked Hidenori to confirm the scope decision, (b)
wrote the fix as a design document, (c) got it reviewed by an Opus
Agent BEFORE writing any code (see §0 above) — **which found the
originally-proposed `resolve_layer()` fix (match by (z,x,y) position
alone) would have flipped 49.9% of ALL real child-layer references in
1.5号, unrelated to upsampling entirely**, because a leaf position and
an overview recursively built from it legitimately coexist at the same
(z,x,y) with a *different* child_z (confirmed: 3,344/6,373 real
positions do this) — and also found the original design's reuse-safety
reasoning was backwards: D163/D164's reuse does NOT fail safe in the
actual 1.6号 direction (current generation upsamples, the immediately-
previous one didn't), and would have silently copied 1.5号's
non-upsampled output forward into 1.6号 for most of the very items
upsampling exists to fix (their covering CSV content, which the reuse
fingerprint depends on, doesn't change at all under upsampling).

**Corrected design, implemented** (`hfu-mapterhorn` `4d0b783`):
`utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` — a generation_id-keyed policy
table (same pattern as `FLAT_LEGACY_GENERATION_ID`), because whether a
leaf's effective child_z differs from its covering's own filename is a
per-GENERATION fact, not derivable from a covering's content alone.
`utils.leaf_child_z()` — one shared, memoized, pure function (covering
content + that policy table, deliberately NOT a pmtiles-store file
scan) computing each leaf's real child_z, used everywhere a covering
filename's child_z used to be trusted: `resolve_layer()`,
`get_extents_from_coverings()`, `remove_dangling_pmtiles.py`, the
D163/D164 reuse fingerprint, `check_stale_duplicates_v2.py`. A hard
`assert` in `aggregation_tile.py`/`lineage_tile.py` that the real,
raster-derived child_z always equals `leaf_child_z()`'s prediction is
the safety net for the whole scheme.

**A second Opus code-review pass** (reviewing the actual implementation
this time, `4d0b783`) independently re-verified both headline
regression-test claims (zero diffs across all 14,489 real `resolve_
layer()` references; identical `get_extents_from_coverings()` output
replayed old-vs-new) and found 7 more real issues, all fixed and
re-tested (`976884f`): `leaf_child_z()` lacked `reproject()`'s own
`target_zoom > native` guard; duplicate same-position coverings
(dormant today) would silently pick one instead of failing loudly;
**`aggregation_run.py`'s own same-generation `.done` skip didn't check
`leaf_child_z`, so adding a generation to the policy table AFTER some
of its items were already built natively would skip re-upsampling them
forever** (reproduced and fixed); the D146 lineage exclusion hardcoded
`< 8` where that script's own zoom range is env-var-tunable; the
backfill script trusted the policy table without checking a real file
exists; a backfill counter bug overstated success on write failure;
one more real (`--aggregation-id`-parameterized, not the 1号-hardcoded
`check_covering_gaps.py`) audit tool still parsed covering filenames
naively.

**Verified end-to-end against real data, not just unit-level**: an
actual land-only item (`11-1727-881-13`, Yonaguni-area, native z13, the
same item D150's own disposable rehearsal used) was upsampled to z16
through the real, permanent code path — 311.67m max elevation vs
D150's own rehearsal recording 312m. All three reuse scenarios
(no prior record → reject; prior recorded native, current wants
upsampled → reject, the actual fix; sea-only item → still reuses
normally) confirmed against real 1.5号 data in isolated test
generations, cleaned up after each check.

**Scope decision, Hidenori, 2026-09-13**: "1.7号" stays unassigned. The
next real launch is **1.6号** itself — same source data as 1.5号, plus
D165's fixes (including the live nodata/alpha bug) and this upsampling
feature — reached via "major rework → upsampling implementation →
dress rehearsal → 1.6号" rather than the earlier "major rework → dress
rehearsal → 1.7号" framing. `PLAN.md` §0's generation table has a new
1.6号 row.

### 5. D167: D165's remaining 5 findings (#3/#5/#6/#8/#10) all fixed and verified -- including a THIRD near-miss caught by Opus review this session

Picked up the next day (2026-09-14) as the explicit condition Hidenori
set before a dress rehearsal. All 5 fixed and verified against real
1.5号 data or synthetic scenarios built from real code paths, inside
isolated fake generation_ids as usual:

- **#3/#5**: `aggregation_run.py`/`downsampling_run.py`'s own-item
  `.done`-skip checks now require an inputs-fingerprint freshness
  match AND a real `os.path.isfile()` check on the actual output file
  — not just `done_covers()`/`done_is_current()` alone, which never
  verified the output was still on disk.
- **#6**: `lineage_provenance.py`'s `compute_provenance()` rewritten to
  read every per-group tiff in 512x512 windows instead of loading each
  fully into RAM (was ~10.7 GiB peak on the largest real items — the
  same `AGGREGATION_WORKERS=3` ceiling D129-D131 fixed elsewhere, and
  about to matter a lot more once 1.6号's own upsampling pushes some
  items to 32768x32768). Safe with no overlap margin — no cross-pixel
  operation exists in this function. Verified byte-identical on a real
  5-group, 33018x33018 item: 0 differing pixels out of ~1.09 billion.
- **#8**: `downsampling_run.py`'s tmp folder now scoped by datatype.
- **#10**: `aggregation_covering.py`'s `write_aggregation_items()` now
  cleans up a superseded covering CSV (plus `.todo`/`.done` stubs)
  when re-covering an EXISTING generation changes a position's
  `child_z`, or drops it to zero coverage. **A first version of this
  fix had a critical regression, caught by Opus code review BEFORE it
  ever ran**: the cleanup glob also matched the CURRENT item's own
  `.todo`/`.done` sidecars, so any re-covering pass into an existing
  generation — including the single most common real case, a
  same-composition no-op retry — would have silently deleted every
  already-built item's completion marker generation-wide, forcing a
  full national rebuild and destroying the D163/D164 fingerprint data
  a later generation's reuse depends on. The test written alongside
  the original fix could not have caught this (it never gave the
  CURRENT item its own `.done`/`.todo` before the no-op-rerun
  assertion) — rewritten to actually exercise it.

This is the **third** time this session an independent Opus review
caught something a locally-correct-looking diff (and its own
author-written test) both missed — after the `resolve_layer()`
position-only-match catastrophe and the reuse-direction reversal, both
D166. Full narrative: `DECISIONS1.md` D167.

**Unrelated lesson from this session's own verification work**: the #5
test script hung for **over 12 hours** before being diagnosed as a bug
in the ad hoc script itself, not the pipeline — it called
`downsampling_run.main()` (which spawns a `multiprocessing.Pool`) at
module level with no `if __name__ == '__main__':` guard, so macOS's
`spawn` start method re-ran the whole test file as `__main__` inside
each worker, recursively spawning more pools forever. Any future
one-off script that calls `aggregation_run.main()` / `downsampling_
run.main()` / `bundle.py` / `merge_japan_bundles.py` (the functions in
this codebase that create a `Pool`) needs this guard, even for a
"just call this once" throwaway.

### What's next, in likely order

1. **`utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` is still empty.** This is
   now the ONLY remaining precondition for 1.6号's dress rehearsal —
   D165's deferred findings are all closed as of D167. Before any
   aggregation work starts for 1.6号: mint its generation_id, record
   it in `PLAN.md` §0, and add it to that table **at the same time** —
   D166's own finding #3 (fixed, but the discipline still matters
   operationally) is exactly what goes wrong if the table entry is
   added after some items are already built natively.
2. Then: dress rehearsal → wet dress rehearsal → 1.6号 launch for real
   (per Hidenori's own stated sequencing this session).
3. The live nodata/alpha fix (D165) means 1.6号, once launched, will
   need its OWN publish to actually replace the currently-affected
   1.5号 archive on `stars` — this is presumably 1.6号's own launch,
   not a separate emergency republish, per the "major rework →
   upsampling → dress rehearsal → 1.6号" sequencing Hidenori chose.
4. GSI's next DEM1A update — live-checked 2026-09-11, still
   **2026-07-31** (no new update). This gates 2号 specifically, which
   now launches AFTER 1.6号, not before.
5. Someday, not urgent (D160's own framing, unchanged): the coastal
   erosion-gate bug fix (`hfu-mapterhorn` commit `1b6e4e1`) is a real
   upstream-PR candidate whenever contributing upstream becomes a
   priority.
6. Not yet triaged, below D165's own top-10 cutoff (see D165's own
   "also verified as real" list): a small batch of minor/dead-code
   items, worth a lighter pass before or during the dress rehearsal
   but not blocking it.

### Git state

Both repos should be fully committed and pushed as of this snapshot —
verify with `git status --short` (expect clean) and `git log
origin/main..HEAD` (expect empty) in both before trusting this note.
`mapterhorn-japan-bridge` HEAD is this session's own D167 documentation
commit. `hfu-mapterhorn` HEAD is `79397e7` (D167's FORK_NOTES.md
entry, on top of `ba6dbfd`'s actual fixes); the commit chain from
`bfef7cd` (D164's atomicity fix) through `79397e7` is entirely this
session's own work. `hfu-mapterhorn` still has the same pre-existing
untracked scratch files noted in the archived handover
(`pipelines-rehearsal*/`, `screen_results_
jpnational{5,10,sea}.csv` — the last three are now load-bearing
evidence for D162's own re-verification, don't delete them,
`stale_done_manifest.txt`) — leave them alone.

If you're resuming and `git status`/`git log origin/main..HEAD` show
anything other than clean, something changed after this snapshot was
written — investigate before assuming this handover is still accurate.

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
