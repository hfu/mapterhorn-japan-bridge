# 2号計画 (Generation 2 planning)

Forward-looking plan for the next national build cycle, written ahead
of it actually starting. Not a decision log (that's `DECISIONS.md`) and
not a session narrative (that's `HANDOVER.md`) — this file is "what we
intend to do differently next time and why," kept current as a living
document until 2号 actually kicks off, at which point its outcomes
belong in `DECISIONS.md` as usual.

Started 2026-08-25, while 1号 (`01M0MWK852631SHCHPA66F21WQ`, the first
full national generation) was still finishing its own aggregation run.
**Update (2026-08-30)**: aggregation is now 100% complete (6,373/6,373,
D66) and the downsampling pyramid has fully converged (8,340/8,340
done, 0 not-ready, D69/D70 — see those entries for the stale-`.done`-
marker bug found and fixed along the way). The only remaining step for
1号's own mission-complete milestone is running one more full
`publish_cycle` (bundle→merge→rsync) against this now-converged
`pmtiles-store` and re-checking `check_pmtiles_integrity.py`'s orphan
count against D68's 183,847 baseline — see `DECISIONS.md`'s own recent
entries for the live status, don't trust this snapshot once it's
stale.

## 1. What triggers 2号

**Corrected understanding, from a direct exchange with Oliver Wipfli
(`DECISIONS.md` D42)**: our own refresh cadence should be anchored to
GSI actually shipping new DEM1A data (check
`https://service.gsi.go.jp/kiban/app/data_update_info/` periodically —
no fixed schedule is documented anywhere). **Update (2026-08-29,
checked live)**: the earlier note here claiming only a "thin,
~1-year-gap" data point was itself stale/wrong — a fresh check of the
update-info page found a real, materializing quarterly-ish cadence:
1mメッシュDEM(航空レーザ測量)updates on **2025-07-31, 2025-10-31,
2026-02-27, and 2026-07-31**. That's 3 real updates in the ~13 months
since the previous note was written, not the single ~1-year gap
assumed then. **The most recent one (2026-07-31) is now roughly a
month old and its trigger status against `japan-geotiff-dem`'s own
ingestion has not been checked from this session** — before treating
it as a live 2号 trigger, check whether `japan-geotiff-dem`'s own
pipeline (a separate repo, on `aalto`) already ingested it (memory
note from that repo mentions a "JCI 2026-09" 1m update cycle completing
across all 11 zones, which may or may not be the response to this
same 2026-07-31 GSI update — not verified here, check that repo's own
`DECISIONS.md`/`HANDOVER.md` directly rather than assuming). **Do not
wait passively for a signal from Mapterhorn's own release cycle** —
Oliver's own release trigger is demand-aggregated across 130+ terrain
sources and he only cuts a release when someone actively tells him
fresh data is ready. The correct posture is: refresh proactively when
GSI moves, then tell Oliver, and let his own release timing be
entirely his call.

**Practical implication**: given the cadence now looks like roughly
once per quarter rather than once per year, the periodic-check need is
more real than the original note assumed. Someone (Hidenori, or a
scheduled check) needs to periodically watch GSI's update-info page.
Still not automated as of this writing — worth making this a real
scheduled check (not just an ad hoc one, as this entry itself was)
given the now-confirmed quarterly cadence, independent of whether 2号
itself starts soon.

**Hidenori's own decision, 2026-08-29**: once 1号 reaches mission
complete (see section 4's disk5 detach procedure), 2号 will
deliberately wait for the *next* quarterly DEM1A update rather than
starting immediately — given the observed cadence, that's expected
around **end of October 2026**, not a fixed date yet. This also sets
the natural point to re-attach disk5 (currently planned to be detached
once 1号 is done — see section 4).

## 2. Scope: what actually needs refreshing

- `jpnational1`/`jpnational5`/`jpnational10`/`jpnationalsea` all need
  their `source_download.py` re-run against `japan-geotiff-dem`'s own
  freshly-regenerated manifest once GSI's next real update lands and
  that repo's own pipeline (`extract → convert → sync → filelists`)
  has processed it.
- **Expected scale, externally cross-checked (D42)**: Oliver's own
  independent diff against Mapterhorn's existing `jpdem1a` source found
  ~106,648 new files and ~20,996 stale-to-remove, against a total
  291,779-file manifest — i.e. roughly a third of the corpus churns
  per real update cycle. 2号 should expect a similar order of
  magnitude, not a small incremental patch.
- `jpnational1`'s own `bounds.csv`/`polygon-store` need regenerating
  after the source refresh (D35: confirmed *not* urgently blocking —
  `aggregation_covering.py` doesn't consume `polygon-store`, and
  `bounds.csv` is header-only — but still needs to happen before it
  goes stale enough to matter for something else).

## 3. Data-quality baseline for 2号

D18's corruption investigation (in `japan-geotiff-dem`) is what found
the `gmldem2tif.rb` bug in the first place. Status as of this writing:

- The tool itself is fixed (`tif_valid?` now forces a real decode).
- All 45 originally-confirmed-corrupted files in the 10
  originally-suspect `4929`/`4930` meshes are fixed and re-verified.
- A full ground-truth sweep of the entire 109-mesh `4929`/`4930` zone
  is in progress at time of writing (`scripts/ground_truth_check.py`
  against all 109 downloaded raw GML zips) — **check its outcome
  before starting 2号's own source refresh**. If it finds anything new,
  that gets fixed the same way (re-convert, re-upload, re-verify,
  regenerate both manifests, propagate to `slate`) before 2号 trusts
  `jpnational1` as clean.
- **Deliberately still deferred**: whether the same corruption-bug
  class exists in 5m/10m (same tool, same `-n $(nproc)` parallelism
  setting, never tested — D18's own "まずは1mに集中しよう" call). Worth
  a real decision before or during 2号: test it, or explicitly accept
  the residual risk again the way 1号 did for the 1m case.
- **Worth considering as a standing practice, not a one-off**: since
  the corruption bug was execution-environment-dependent (a fresh
  re-run of identical code on identical input didn't reproduce it),
  there's no guarantee 2号's own fresh GSI download-and-convert pass is
  immune. A lighter-weight version of `ground_truth_check.py` (or a
  cheap decode-forcing screen like `screen_source.py`, already built)
  run against a *sample* of newly-converted meshes each cycle, not just
  once retroactively, would catch a repeat before it reaches
  publication. Not committed to yet — a real design question for 2号,
  not assumed.

## 4. Infrastructure prerequisites

- **D41's storage-tiering split** (`source-store`/`bundle-store` →
  slow storage, `tmp-store` → fast internal disk): **Update
  (2026-08-29, D58/D59/D60)**: the same-model second disk went to this
  project, not `kaga0`. `pmtiles-store` itself (not `tmp-store`, which
  D41 originally targeted) has been fully migrated to it, formatted
  APFS, mounted at `/Volumes/pmtiles-store`, symlinked in from
  `pipelines/pmtiles-store` — done via a graceful two-phase migration
  (bulk copy while production kept running, then a short stop-and-
  swap: SIGINT to `aggregation_run_backfill`, final incremental
  rsync, symlink swap, relaunch). The old in-place copy
  (`pipelines/pmtiles-store.old-internal-disk`, ~284GB, on the old
  disk) is deliberately still present as a safety net as of this
  writing — **not yet deleted, don't forget it** — delete only after
  confirming the new disk has run stably for a while, reclaiming disk4
  headroom (397Gi free at time of writing) once done.
  - **`tmp-store` itself moved too, 2026-08-29 (D61)** — D41's
    original idea of sending it to the internal SSD was reconsidered
    and dropped: D60 measured real iostat access patterns after the
    pmtiles-store move and found the OLD disk (`disk4`/
    `Migrate-2025-04`, hosting `source-store`, `tmp-store`,
    `bundle-store`, `aggregation-store`, and the code itself) still
    sustaining 200-1,400 tps / 12-30MB/s continuously, while the NEW
    disk (`disk5`/`pmtiles-store`) sat essentially idle. The internal
    SSD's own headroom was only ~77Gi free (shared with macOS itself)
    — too thin. So `tmp-store` (5.6GB at move time, tiny and
    self-cleaning) was moved to `/Volumes/pmtiles-store/tmp-store`
    instead, same graceful pattern as the pmtiles-store move itself
    (SIGINT to `aggregation_run_backfill`, `mv`, symlink, relaunch).
    Verified with a fresh iostat sample right after: disk5 picked up
    real sustained I/O (23-57 tps / 6-7MB/s) that was previously
    landing on disk4. See D61 for the full record.
  - **Disk5's role, clarified 2026-08-29**: Hidenori intends 1号 to be
    the mission this disk finishes, then wants it physically
    detached — disk5 is a removable "auxiliary tank," attached only
    when actually needed, not permanent infrastructure. 2号 itself is
    now planned to wait for GSI's next quarterly DEM1A update (see
    section 1 — most recently 2026-07-31, next expected roughly
    end of October 2026), so there's a real dormant gap where nothing
    needs disk5 attached at all.
  - **Detach procedure (planned, not yet executed)**. Preconditions,
    updated 2026-08-30: aggregation backfill 6,373/6,373 — **done**
    (D66); downsampling pyramid fully converged, 8,340/8,340 done, 0
    not-ready — **done** (D69/D70, after finding and fixing 1,265
    stale `.done` markers created by today's backfill renaming
    pmtiles-store files out from under already-marked-done downsampling
    items — same bug class as D53, formalized tool reused, not a new
    one); a publish cycle succeeding end to end reading `pmtiles-store`
    via the new disk — **already demonstrated once** by `publish_cycle_11`
    (still mid-rsync as of this update, but its own bundle+merge stages
    already completed reading from `/Volumes/pmtiles-store` without
    errors, which is the actual thing this precondition cared about).
    **All preconditions now satisfied, 2026-08-30 update**: `publish_cycle_12`
    ran end to end (downsampling/bundle/merge/rsync) reading `pmtiles-store`
    via the new disk and completed successfully (D73); its local output
    was verified with `check_pmtiles_integrity.py` at **zero orphaned
    tiles (CLEAN)**, down from D68's 183,847 baseline (D72) — a much
    cleaner result than "substantially dropped," so the detach
    procedure below is fully unblocked. Mid-cycle, `pipelines/
    pmtiles-store.old-internal-disk` (284GB) was already deleted (D71,
    Hidenori's explicit approval) to relieve disk pressure during the
    cycle's larger-than-usual merge output (311.4GB) — so step 2 below
    is **already done**, not merely planned. `/Volumes/Migrate-2025-04`
    currently has 680Gi free.
    1. Confirm nothing is still writing to `pmtiles-store`/`tmp-store`
       (`aggregation_run.py` etc. all stopped/finished).
    2. ~~Delete `pipelines/pmtiles-store.old-internal-disk` first~~ —
       **done, D71** (284GB already freed on disk4).
    3. `rsync` `/Volumes/pmtiles-store`'s current full contents back
       onto disk4 as a real directory (projected final size ~400-450GB
       at 6,373/6,373 aggregation items, extrapolated from the 66MB/item
       average measured at 4,515/6,373 on 2026-08-29 — comfortably fits
       disk4's current 680Gi headroom).
    4. Swap `pipelines/pmtiles-store` from symlink back to the real,
       freshly-copied directory. `tmp-store` needs no data preserved
       (transient, should be empty by completion) — just remove its
       symlink and `mkdir` a fresh empty one on disk4.
    5. Re-run `check_pmtiles_integrity.py` once more against the
       disk4-hosted copy to confirm the copy-back didn't drop or
       corrupt anything (expect it to stay CLEAN, matching D72).
    6. Only then `diskutil eject disk5` and physically disconnect.

    **STALE — do not follow this procedure as written (added 2026-09-01,
    DECISIONS.md D90 full-log audit)**: the "all preconditions satisfied"
    note above was accurate as of `publish_cycle_12`'s success (D73), but
    within hours the D74-D76 incident hit -- 212GB of stale files were
    found and deleted, the cleanup itself over-deleted first the
    downsampling layer (D75) then 3,344 legitimate aggregation outputs
    (D76), and `aggregation_repair_3344` has been rebuilding those ever
    since (still running as of this note). `pmtiles-store` (the disk this
    section wants to detach) is the ACTIVE, currently-written-to volume
    for that repair -- step 1's "confirm nothing is still writing" is
    currently false, and running this procedure now would either race the
    repair or physically remove the disk it's writing to. **Do not detach
    disk5/pmtiles-store until aggregation_repair_3344 completes AND a
    fresh publish_cycle + `check_pmtiles_integrity.py` CLEAN result
    reproduces D72/D73's outcome post-repair.** Re-evaluate preconditions
    from scratch at that point rather than trusting this section's old
    "done" markers.
    Confirmed via `grep` that no pipeline script hardcodes
    `/Volumes/pmtiles-store` anywhere — everything goes through the
    relative `pmtiles-store`/`tmp-store` symlinks from the `pipelines/`
    working directory, so this swap is a pure filesystem operation,
    zero code changes needed either direction.
  - **Re-attach procedure for whenever disk5 is needed again** (2号's
    own start, most likely): exactly the mirror of D58-D61's own
    procedure this session — reformat if needed, graceful stop,
    symlink `pmtiles-store`/`tmp-store` back onto it, relaunch. Nothing
    new to design; this session's own D58-D61 entries are the
    reference implementation.
- **D37's `downsampling_covering.py` preflight gap**: **fixed
  2026-08-29 (D56)** — now runs automatically as part of `publish_
  cycle.py`'s own preflight, idempotently, every cycle. No longer a
  2号-specific concern; carries forward automatically.
- **D57's dirty-tracking trade-off, a real open design question for
  2号**: `aggregation_covering.py`'s own cross-generation "skip if
  unchanged from last generation" optimization was removed entirely
  (2026-08-29, D57) after being found to silently skip positions the
  *previous* generation itself never finished building — 2,343 native
  positions across 1号 were never built at all as a result, discovered
  and backfilled that same session. The fix that's live now makes
  every generation reprocess everything from zero, sacrificing the
  real efficiency D42's own estimate implies 2号 could have used
  (~2/3 of positions expected unchanged between real GSI update
  cycles). **Before 2号 starts**, decide whether to accept full
  reprocessing (simpler, safe, but potentially very slow at 2号's own
  scale) or design a safer version of dirty-tracking that also
  verifies the referenced `pmtiles-store` output actually exists
  before trusting "unchanged" as a skip signal — not decided yet.
  **New supporting evidence (2026-08-30, D69)**: found 1,265 real,
  live instances of exactly the failure mode this design question
  worries about — `aggregation_run.py` renaming a `pmtiles-store`
  file (maxzoom suffix changes on reprocessing) out from under a
  downsampling item that had already marked itself `.done` against
  the old filename, leaving a permanently-stale marker no future run
  would ever retry on its own. This wasn't hypothetical risk; it
  happened at real scale during 1号's own backfill. Any 2号 dirty-
  tracking redesign should treat this as the concrete failure case to
  design against, not just D57's own aggregation-level version of the
  same pattern.
- **D37/D44's `bundle.py` pmtiles-store race, now fixed** (`hfu-
  mapterhorn` `8b4a50c`): 1号 hit this 3 times out of 8 publish
  cycles (37.5% — see D44's full audit). `bundle.py` now catches the
  race's `FileNotFoundError` per source file and skips just that
  file's tiles for the current pass instead of crashing the whole
  cycle. Carries forward to 2号 automatically (same script, same repo)
  — no separate action needed at 2号's kickoff, but if a *new* crash
  signature ever appears there, don't assume it's the same already-
  fixed race without checking the traceback's actual missing filename
  first.
- **1号's own residue cleanup**: once 1号 fully completes, its
  `pmtiles-store`/`tmp-store`/`aggregation-store` footprint becomes the
  next generation's "old-generation" cleanup candidate, exactly like
  D40/D29's own Kyushu-generation precedent. Reuse that audit
  methodology (position-based cross-reference against the *new*
  generation's own covering, not naive filename/date matching — D29's
  own lesson) rather than re-deriving it. Don't start 2号's own build
  before deciding whether to clean 1号's leftovers first or let them
  coexist temporarily (D29's root-cause mechanism means old-generation
  `pmtiles-store` files at shared positions get silently overwritten in
  place as 2号 processes them anyway — only genuinely orphaned
  positions need an explicit sweep, same as this session's own finding).
- **Worker configuration**: 1号 settled on `AGGREGATION_WORKERS=4`,
  `DOWNSAMPLING_WORKERS=3` (D38/D39) after real measurement. Treat this
  as a starting point for 2号, not a permanent constant — re-measure if
  the hardware changes (see storage tiering above) or if 2号's own
  scale differs meaningfully from 1号's.

## 5. Open format question: LERC for the published source

Oliver asked whether the Source Cooperative-published GeoTIFFs
themselves (not this project's own internal aggregation intermediates)
could match Mapterhorn's own preferred input format — LERC compression,
internally tiled, no overview pyramid. Explicitly **not** the same
question D22 already answered (D22 tested LERC on short-lived,
repeatedly-re-read aggregation intermediates and correctly rejected it
there, 15-35x slower due to `aggregation_merge.py`'s own windowed
re-read pattern — a final, write-once/read-once published file has a
completely different cost profile, plausibly closer to Oliver's own
experience of "small difference switching to LERC").

**Real architecture lead worth investigating for 2号, not committed
to**: if `aggregation_merge.py` were ever redesigned around a
single-pass read per source file (matching Oliver's own pipeline's
access pattern) rather than the current repeated-windowed-read design,
LERC could become viable for *our own* aggregation intermediates too —
addressing D40's storage-trajectory concern from an architecture angle
distinct from D41's physical storage tiering. This is real engineering,
not attempted yet, and would need its own benchmark (same discipline as
D22) before adoption either way.

**Decision needed before or during 2号**: does `source_to_cog.py` (or
an equivalent) get un-skipped for `jpnational1` to produce a
Mapterhorn-ready LERC/tiled/no-overview variant, published alongside
(not instead of) the general-purpose COG this project currently
publishes? Tradeoff already flagged by Oliver himself: not ideal for
general GIS usage (no true COG without overviews, older software may
lack LERC support). Not decided yet.

## 6. Explicitly out of scope for this planning pass

- Actually starting 2号 — gated on GSI shipping real new data, not on
  this document being finished.
- The `mapterhorn/mapterhorn#186` LERC-for-storage-transfer discussion
  Oliver had with `lseelenbinder` — a separate, still-open question
  from everything above (marginal gain observed there: 412MB vs 425MB
  on one Canada tile), revisit only if `source_to_cog.py` work above
  actually starts.

## Resume note

If picking this file up cold: check `DECISIONS.md`'s most recent
entries for 1号's actual completion status first (this document's own
"840/1,979... ETA late 2026-08-27" line goes stale fast), and check
whether the full-109-mesh ground-truth sweep (section 3) actually
finished clean or found something new before assuming section 3 is
settled.
