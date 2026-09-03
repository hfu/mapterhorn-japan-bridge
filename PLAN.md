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

## 0. Generation ID <-> human-readable label (D109)

"1号"/"1.5号"/"2号" are conversational shorthand that, before this table,
lived only in DECISIONS.md prose -- no single place in the repo mapped
them to the actual `generation_id` ULIDs the code operates on. Kept here,
updated whenever a new generation starts:

| Label | generation_id | Status |
|---|---|---|
| 1号 | `01M0MWK852631SHCHPA66F21WQ` | Complete, published to stars (D106) |
| 1.5号 | *(not yet created)* | In prep -- see section 6 |
| 2号 | *(not started)* | Gated on GSI's next quarterly DEM1A update (section 1) |

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

**Live check, 2026-09-01**: GSI's update-info page still shows
2026-07-31 as the latest 1mメッシュDEM update — no new update since.
Consistent with the end-of-October expectation above; nothing to act
on yet.

**Timing refined, 2026-09-03**: Hidenori's own current expectation is
**end of November 2026**, not end of October as estimated above —
carrying the same "next quarterly DEM1A update" trigger, just a
slightly later point in that window. Treat November as the current
working estimate; the October note above is kept for its reasoning,
not as a still-authoritative date.

**Elevation-datum-revision status, verified 2026-09-03 (was an open
question in this file until now)**: GSI's own FAQ
(`https://www.gsi.go.jp/sokuchikijun/hyoko2024rev-QA.html`) plus a
follow-up search both confirm the 2025-04-01 revision (affecting
DEM1A/5A/5B/5C — not DEM10A/10B or the 50m mesh, which GSI explicitly
left unrevised "許容精度の観点から") was rolled out as a **complete bulk
update of all provided data and metadata, effective from
2025-07-31, including files whose underlying feature had no change**
("地物の更新がなかったファイルも含め、全ての提供データとメタデータが更新されました").
Practical implication: **any file pulled from GSI's live download
service at any point since 2025-07-31 — including every one of the
quarterly updates this section is tracking, and therefore whatever 2号
eventually ingests — is inherently already on the revised datum.**
This was previously tracked in this project as an open/uncertain item;
it can be considered resolved. (The `yyyymmdd` embedded in GSI's own
mesh filenames, e.g. `-DEM1A-20250507.tif`, is the underlying survey/
feature creation date, not a reprocessing timestamp — seeing an old
date there is not evidence of pre-revision values.)

**New item surfaced by that same check, not yet resolved**: the 2025-04
revision was not only an elevation-value change — **the coordinate
reference system itself moved from JGD2011 to JGD2024** ("座標参照系が
「JGD2011」から「JGD2024」に変更"). Neither this file, `DECISIONS.md`, nor
`japan-geotiff-dem`'s own docs mention this CRS change anywhere (checked
via grep, no hits). Since 2号 means a full fresh re-download from GSI,
every source file 2号 ingests will be JGD2024, not JGD2011 — worth
confirming before 2号 starts that `aggregation_reproject.py` and any
other place in the pipeline that assumes/declares a source CRS handles
this correctly rather than silently mislabeling JGD2024 data as
JGD2011. Not investigated further here; flagged for section 3 or 4's
own pre-2号 checklist.

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

- **[最優先, 未実装, 設計のみ] D74-D76の名前空間衝突の構造的修正 — 2号着手前に必ず実装すること**:
  1号最大のインシデント(D74→D75→D76の連鎖、3,344件のaggregation出力を誤削除)の根本原因は、aggregation層とdownsampling層が**同じファイル命名規則`{z}-{x}-{y}-{child_z}.pmtiles`を共有し、どちらのレイヤーが書いたファイルか名前だけでは区別できない**という構造的な欠陥だった(D76)。D80でも、この同じ弱点に起因する**未発火の潜在バグ**(`downsampling_run.py --fix`が、削除したファイルがaggregation層由来の場合に正しい`.done`マーカーを消せない)が見つかっており、「拙速に修正するとD74と同種の事故を再現しかねないので、号2の構造的な修正まで温存する」と明記して保留していた。**2号を安全に開始するには、この構造的分離を必ず実装しておく必要がある。**

  **設計案(未実装、2026-09-01時点でHidenoriと合意した方針検討)**:
  - **案A(推奨)**: `pmtiles-store`のディレクトリ構造そのものにレイヤー識別子を組み込む。例: `pmtiles-store/aggregation/...`と`pmtiles-store/downsampling/...`のようにトップレベルで分離し、既存の`utils.get_pmtiles_folder()`(z7祖先ベースのシャーディング)はその配下でレイヤーごとに独立して動く。横断的なクリーンアップ/監査スクリプトが、コード上「今どちらのレイヤーを見ているか」を型的に取り違えようがない構造になる。
  - **案B(非推奨、参考として記録)**: ファイル名にレイヤー識別子をサフィックスとして追加(例: `{z}-{x}-{y}-{child_z}-agg.pmtiles`/`...-ds.pmtiles`)。ディレクトリ移動は不要だが、コードベース全体に散らばる`filename.replace('.pmtiles', '').split('-')`という4フィールド前提のパース処理を全て洗い出して修正する必要があり、変更範囲が案Aより広く誤りやすい。
  - **影響範囲の洗い出し(未実施)**: `get_pmtiles_folder()`を呼ぶ全箇所(`aggregation_run.py`・`downsampling_run.py`・`bundle.py`・各種`check_*.py`監査ツール)を`grep`で棚卸しし、1つのコミットで一括変更する必要がある。片手落ちの部分適用は、まさにD74-D76と同じ「一部のツールだけが新しいレイヤー分離を認識し、別のツールが古い前提のまま動く」という事故を再現しかねない。
  - **D80の潜在バグとの関係**: この構造的修正が入れば、D80で見つかった「削除対象ファイルがどちらのレイヤー由来か判定できない」問題はそもそも起こりえなくなる(ファイルパス自体がレイヤーを一意に決めるため)。D80のバグ修正そのものは、この構造変更とセットで自然に解消される想定。

  **なぜ今は実装しないか**: `get_pmtiles_folder()`・ファイル命名規則は`aggregation_run.py`/`downsampling_run.py`/`bundle.py`という、今まさに`aggregation_repair_3344`が使っている本番コードの中核。1号が完全に完了する前にこれを変更すると、進行中の復旧作業を直接壊しかねない。**この設計は2号着手の直前、1号が完全にミッションコンプリートした後、かつ2号自身のビルドを開始する前のタイミングで実装すること**——1号の残作業(bundle→merge→rsync→整合性確認)には一切触れない。

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

    **STALE AGAIN (added 2026-09-01, DECISIONS.md D96, "1.5号" plan)**:
    even once 1号 itself is clean, do NOT detach disk5 -- Hidenori has
    decided to immediately follow 1号 with "1.5号" (section 6: same
    source data, new pipeline code, national-scale validation run before
    real 2号 starts), which needs this same disk as its own working
    volume. Keep disk5/pmtiles-store attached and in use straight through
    1.5号. Only re-evaluate detaching it after 1.5号 itself reaches a
    clean, verified state -- and even then, re-attaching for real 2号
    (section 1) is coming soon after anyway, so detaching in between may
    not be worth doing at all. Don't trust this section's "done" markers
    from the D73/D90 eras; re-derive current status from DECISIONS.md's
    latest entries each time this is revisited.
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

## 6. 「1.5号」: 1号完了後・2号(新GSIデータ)着手前のパイプライン検証ラン

**Hidenoriの決定、2026-09-01(DECISIONS.md D96)**: 1号が完成しstarsに公開された後、10月末のGSI更新までの空き時間を使って、**ソースデータは1号と同一のまま、パイプラインだけを2号向けに改修した「1.5号」を全国スケールで走らせる**。2号本番で「新しいコード」と「新しいデータ」という2つの未知数を同時に抱えないための変数分離が目的。ソースデータが同一なので、1号の既実証の結果(タイル抜けなし)とほぼ一致するはずの出力になり、パイプライン変更の副作用を検出する実質無料の回帰テストにもなる。

**1.5号のスコープ**:
1. **D74-D76レイヤー名前空間分離の構造的修正**(本ファイル§4、案A推奨)——1号最大のインシデントの再発防止策を、全国スケールで初めて検証する機会。
2. **lineageタイル機能**(D93/D94)——当初「2号本編とは独立した任意機能」としていたが、**Hidenoriの決定によりスコープに含めることに変更**。`aggregation_run.py`への`EMIT_LINEAGE`フラグ組み込み(D93で挿入位置は特定済み)、D94の多数決downsampling(`hfu-mapterhorn/pipelines/lineage_downsample.py`、既に自己テスト済み・production未接続)の実接続、タイル化・bundle・merge・stars配信までの一連を1.5号で実装する。
   - 時間コスト: D93の見積もりでは数時間〜半日規模。downsampling側の追加コストは実測でほぼ無視できる(D94: 全8,223件換算で合計3〜4分)。
   - ストレージコスト: 標高本体(307.9GB)の5〜15%、約15〜45GB(粗い概算、D93)。
3. ソースデータ(`jpnational1`/`5`/`10`/`sea`)は1号と同一のまま——新規GSIデータの取り込みは行わない(それは2号の役目)。
4. **「壁」アーティファクトの修正**(DECISIONS.md D113/D114、2026-09-02発見)——1号公開後の実機確認で発覚した、海岸線に沿った崖状の見た目異常。調査の結果、単一原因ではなく3系統の合成と判明:
   - (A) レンダラ×タイル欠損: MapLibreがHTTP 204を-32768m(標高RGB(0,0,0)相当)として扱うため、欠損ズームバンドの範囲で地形が不自然に潰れる。対馬・五島のz8-11欠損(経度129.375°が境界)はD114で診断済み・修復着手中(bundle再結合のみで直る見込み、生データ再生成は不要)。z13以降の既知の広域欠損バンドは1.5号本体のビルドで解消される想定。
   - (B) `aggregation_merge.py`の`boundary_tile`erosion処理が、まだ埋まっていない生の無効マスクに対して働くため、ごく普通の海岸線でも境界ピクセルが消え、ブラーが実質発火しない構造的バグ(upstream mapterhorn/mapterhorn本体にも存在)。長崎半島・江田島で見られるサブタイル解像度のジグザグ壁の原因。**未修正**——ゼロフィルをマスク再計算の前に移動する設計変更が必要、1.5号のスコープに含める。
   - (C) 配信衛生問題(RGB/RGBA世代混在、maxzoom誇大申告)。1.5号のクリーンな全国ビルドで自然に解消される見込みだが、要検証。
   - **対馬・五島のz8-11欠損は2026-09-03(D115)に根本原因を特定・修正済み**——stale .doneマーカーがdownsamplingチェーン全体をブロックしていた(bundle再結合の問題ではなかった)。詳細はDECISIONS.md D115参照。


**公開方針**:
- terrariumタイル: starsで1号を**上書き**(1.5号が新しい現行版になる)。
- lineageタイル: 新規公開(1号には存在しなかった)。
- どちらも2号(新GSIデータ投入後)完成時に、さらに上書きされる——1.5号はあくまで中間ステージング。

**未確認・実装着手前に詰めるべき点**:
- 1.5号のディスク容量: 1号の成果物(比較基準として保持)と1.5号自身の成果物を、一時的に並行して持てるだけの空き容量があるか事前確認が必要。
- 純粋な「クリーンな1回のフルビルド」の所要時間の実績が無い(1号の実績は調査・バグ修正込みの数字で参考にならない)——1.5号自体がこの実測データを初めて提供することになる。
- generation_idは1号と別にする(上書きせず、突き合わせの基準として1号を残す)。

## 7. Explicitly out of scope for this planning pass

- Actually starting 2号 — gated on GSI shipping real new data, not on
  this document being finished.
- The `mapterhorn/mapterhorn#186` LERC-for-storage-transfer discussion
  Oliver had with `lseelenbinder` — a separate, still-open question
  from everything above (marginal gain observed there: 412MB vs 425MB
  on one Canada tile), revisit only if `source_to_cog.py` work above
  actually starts.

## 8. Readiness checklist: 今すぐ準備してよいこと / 1号完了まで待つべきこと

2026-09-01、Hidenoriから「1号を完成させるまでは2号は投入しないが、2号を投入可能にしておくための準備はしておこう。1号に悪影響は及ぼさないように」との方針を受けて整理。

**今すぐ着手してよい(1号の本番コード・本番データパスに触れない)**:
- ✅ D94: 多数決downsamplingアルゴリズムの実装(完了、新規ファイルのみ、production未接続)
- GSI更新監視の定期チェック(読み取り専用、実施済み・継続可能)
- 本ファイル(PLAN.md)のような設計ドキュメントの作成・更新
- 案A/案Bのようなレイヤー分離設計の詳細化(ドキュメント上の検討のみ、コード変更なし)
- LERC再設計の検証も、`pipelines-rehearsal/`(このセッションで既に確立されている、本番`pipelines/`とは独立したシンボリックリンク環境、bundle.py/merge_japan_bundles.pyのスローアウェイ検証に過去使用)を使えば1号に触れずに試せる——ただし今回は着手していない

**1号完了まで待つべき(本番コード・本番データに触れる)——ただし完了後は2号ではなく先に1.5号(§6)のタイミングで着手する**:
- ❌ D74-D76レイヤー分離の実装(`get_pmtiles_folder()`・ファイル命名規則の変更) — `aggregation_run.py`/`downsampling_run.py`/`bundle.py`という、今`aggregation_repair_3344`が使っている本番コードそのもの。1号完了後、1.5号として実装・検証。
- ❌ disk5のデタッチ(D90/D96で二重にSTALE警告を追記済み)——1.5号も同じディスクを使うため、2号本番が近づくまでさらに待つ。
- ❌ lineageタイルの`EMIT_LINEAGE`フラグを本番`aggregation_run.py`に組み込むこと——D96でスコープを1.5号に変更(当初「2号一次リリース後」としていたのを訂正)。
- ❌ upstream同期での「マージしない」判断済みの変更(分散ワーカー化等、D82)を再検討して取り込むこと——2号の規模次第では検討価値があるかもしれないが、今取り込むと1号の動作が変わってしまう

## Resume note

If picking this file up cold: check `DECISIONS.md`'s most recent
entries for 1号's actual completion status first (this document's own
"840/1,979... ETA late 2026-08-27" line goes stale fast), and check
whether the full-109-mesh ground-truth sweep (section 3) actually
finished clean or found something new before assuming section 3 is
settled.
