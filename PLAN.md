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
| 1.5号 | `01M1MKD73P0KDT719H21NJV9VR` | **Mission complete (D145/D146), 2026-09-06.** Both goals achieved: D95 namespace separation validated at national scale, lineage feature implemented/published/extended to z4. elevation (314.66GB) + lineage (204.6MB) both live on stars, verified clean. Worker count fixed at **3, permanently, for both 1.5号 and 2号 (D130/D131)**. 1号 untouched throughout. See DECISIONS.md D124-D146 for the full runbook and PLAN.md §9 for lessons handed to 2号 |
| 1.6号 | `01M2EAPPYXT8RWNC6TXBRT36JE` (minted 2026-09-14) | **LAUNCHED 2026-09-17 (D173), then patched live 2026-09-19 (D174-D178, the "壁" wall fix).** Same source data as 1.5号, plus (a) D165's own fixes including the live nodata/alpha bug, (b) land-area maxzoom upsampling (D149-151 design, corrected and implemented as D166 after a design review caught the original plan's `resolve_layer()` fix would have broken ~half the national downsampling pyramid). D165's remaining 5 findings all fixed and tested (D167). ID minted 2026-09-14 into `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION`. Small real dress-rehearsal (D168), then the full national build (D169, zero errors across ~17 hours), then final assembly — `bundle.py` → `merge_japan_bundles.py` → `pmtiles cluster` → z0-7 splice → integrity verification (D172; elevation clean, lineage has a pre-existing 116-tile z8 orphan gap also present in 1.5号's own archive, tracked not fixed), then visual verification against 5 real-world locations (D172, all positive, including Fuji's summit elevation within 3.5m of the real 3776m), then the `stars` publish itself (D173): both `mapterhorn-japan-bridge.pmtiles` (272.9GB, elevation) and `mapterhorn-japan-bridge-lineage.pmtiles` (217MB) transferred, MD5-verified, atomically swapped live, confirmed via public TileJSON/tile URLs. Old 1.5号 files preserved as dated backups on `stars`, not deleted. **D174-D178, post-launch**: a visual spot-check of remote islands (Hateruma, Kuba-jima/Senkaku) found a real, nationwide "壁" artifact (13.2% of z9 land tiles nationwide affected) traced to a genuine upstream Copernicus GLO-30 inventory gap (not a curation bug, not fixable by re-downloading). Two independent Opus design reviews caught real blockers in the proposed fix (foreign-land contamination risk, an 85.9M-tile scope explosion, a genuine orphan-generating bug). Staged fix (z8-z12 only, GLO-30-inventory-masked, top-down parent-gated synthetic 0m fill) implemented as committed pipeline code (`hfu-mapterhorn/pipelines/build_wall_fix_archive.py`), run for real against `bundle-store/`, verified clean (`check_pmtiles_integrity.py`: zero orphans across 3,621,677 tiles), and published live to `stars` (D178) -- both originally-reported positions confirmed fixed via the public endpoint. z13+ extension explicitly deferred, not forgotten (no browser access this session to empirically confirm necessity). |
| 1.7号 | `01M39W0T76QKN3GYJCPWX5MDHM` (minted 2026-09-24) | **Same source data as 1.6号 again** (not a GSI data-update generation -- Hidenori's explicit naming decision, 2026-09-24: "2号はデータ更新を反映したときに使いたい", so this pipeline-only fix round gets its own label instead of overloading 2号, matching the 1.5号/1.6号 precedent of same-data-different-pipeline generations). Bundles two fixes, both verified before this ID was minted: (a) D180's coastal Gaussian-blur-seam split (`aggregation_merge.py`, two independent Opus design reviews converged on the design; verified bitwise-identical to D116's own non-regression case, both synthetic and real production data, plus a measured real improvement matching review predictions exactly -- see D180's own addenda), (b) D182's z13-z16 wall extension (already built and merged against 1.6号's own archive as a standalone proof of concept; the SAME synthetic-fill mechanism will be re-run against 1.7号's own fresh archive once built, per its own runbook). ID added to `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` (target z16, same as 1.6号) in the same commit as minting, per D166 finding #3's own discipline. **Full pipeline completed 2026-09-30 through 2026-10-01, both fixes (D180 coastal blur + D182 z13-z16 wall) verified real-data clean, both datatypes public on stars (lineage 2026-10-01 23:33 JST, elevation swapped live 2026-10-02 06:40 JST after MD5 match; D187)** — elevation 274.8GB (67,311,837 tiles, z0-16), lineage 207MB, live checks passed (Fuji/Shiripa real data, Takeshima wall fixed). Backups preserved on stars (`.pre-1.7go-20261001`) and local pmtiles-store. |
| 2号 | *(not started)* | Gated on GSI's next quarterly DEM1A update (section 1). **Live-checked 2026-11-01: still 2026-07-31, no new 1m/5m update yet** (runbook: section 8). Now launches after 1.6号 AND 1.7号, not before -- reserved exclusively for when a real GSI DEM1A data update actually lands (Hidenori's explicit 2026-09-24 decision, see 1.7号's row above). |

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

**Live check, 2026-09-06 (1.5号 mission-complete checkpoint)**: still
2026-07-31, no new update. Confirms 2号 has not been triggered yet;
the November 2026 working estimate below stands. Re-check this page
again closer to that window rather than assuming it hasn't moved.

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

**Item surfaced by that same check, investigated 2026-09-07, resolved
2026-09-09 (D147)**: the 2025-04 revision was not only an
elevation-value change — **the coordinate reference system itself
moved from JGD2011 to JGD2024** ("座標参照系が「JGD2011」から
「JGD2024」に変更"). Confirmed this is not hypothetical: real
2026-downloaded GML in `japan-geotiff-dem-repo/src/1/` already carries
`srsName="fguuid:jgd2024.bl"`. The GeoTIFF-writing tool
(`gmldem2tif.rb`, external, `unopengis/gmldem2tif`) never reads
`srsName` and always stamps `EPSG:6668` (JGD2011);
`aggregation_reproject.py` trusts whatever CRS is embedded without a
`-s_srs` override. **This turns out to be fine, permanently**: EPSG
Dataset v12.055 (2026-04, confirmed via `OSGeo/PROJ` commit `7f1fdb39`,
"rename JGD2011 to JGD2024... sigh") resolved JGD2024 by **renaming
EPSG:6668 in place**, not minting a new code — GSI's own page confirms
the horizontal values are numerically unchanged from JGD2011, so there
was never going to be a different number to switch to. (This machine's
own GDAL 3.13.3/PROJ install was still on EPSG v12.029/2025-10 as of
the 2026-09-07 check, which is why that check saw no EPSG code yet —
pure local staleness, not a gap in the registry.) **No code change
needed in `gmldem2tif.rb` or `aggregation_reproject.py`**, now or
later — `EPSG:6668` is and remains the correct code. Full writeup:
`DECISIONS.md` D147 (see its 2026-09-09 addendum).

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

**RESOLVED, 2026-08-25 (D35, this repo's own `DECISIONS0.md`) — this
section was stale until a 2026-09-12 re-check found the closure had
never been folded back in here.** D18's corruption investigation (in
`japan-geotiff-dem`) is what found the `gmldem2tif.rb` bug in the first
place; D35 is where it was fully closed out:

- The tool itself is fixed (`tif_valid?` now forces a real decode).
- **Full 109-mesh `4929`/`4930` sweep: done, 109/109**, not just the
  original 10 suspect meshes. Final tally 48 corrupted files (38+7+3),
  all fixed, re-verified twice, propagated into this repo's own
  `source-store`/manifest. Zero further corruption found.
- Broader-region calibration (Hokkaido `Z007`, 8 scattered mesh4 codes,
  Kyushu/Okinawa `Z007`, ~3,544 files total): zero mismatches outside
  `4929`/`4930`.
- **5m/10m corruption-bug-class question: answered, not deferred
  anymore.** `screen_source.py` (`hfu-mapterhorn/pipelines/`, built
  2026-08-22) ran against the full corpus of all three: `jpnational10`
  (4,981 files) and `jpnationalsea` (275 files) came back zero decode
  errors and zero 0%-valid files — fully clean. `jpnational5` (422,119
  files) also had zero decode errors, but 2,062 files at exactly 0%
  valid; investigated (not assumed) and found to be a categorically
  different signature from D18's bug — all exactly 506 bytes (ZSTD's
  minimal encoding of a genuinely all-nodata raster) vs. 18-23KB+ for
  real data, scattered nationwide rather than clustered in `4929`/
  `4930` — i.e. legitimately-empty small DEM5A/5B boundary sub-meshes,
  not corruption. **Re-verified live, 2026-09-12**: the raw
  `screen_results_jpnational{5,10,sea}.csv` outputs are still on disk
  (`hfu-mapterhorn/pipelines/`, untracked scratch, dated 2026-08-22 —
  don't delete, they're the evidence trail for this finding) and their
  row counts / zero-valid-pct counts match D35's own numbers exactly
  (2,062 / 0 / 0). **5m/10m/sea are confirmed not affected by D18's bug
  — no further test or risk-acceptance decision needed before 2号.**
- **Still worth considering as a standing practice, not a one-off**
  (unchanged from before): since the corruption bug was execution-
  environment-dependent (a fresh re-run of identical code on identical
  input didn't reproduce it), there's no guarantee 2号's own fresh GSI
  download-and-convert pass is immune. A lighter-weight repeat of
  `screen_source.py` run against a *sample* of newly-converted meshes
  each cycle, not just once retroactively, would catch a repeat before
  it reaches publication. Not committed to yet — a real design
  question for 2号, not assumed. This is the one genuinely open piece
  of this section; everything else above is closed.

## 4. Infrastructure prerequisites

- **[実装済み、2026-09-04 D124] D74-D76の名前空間衝突の構造的修正**:
  **2026-09-05 追記**: 下記の案A(推奨)のとおり、1.5号のpre-launch
  hardening(DECISIONS.md D124)で実装済み。`get_pmtiles_folder()`が
  `generation_id`必須引数を取るようになり、`pmtiles-store/{layer}/
  {datatype}/{generation_id}/...`という構造に分離された。2号は新しい
  generation_idを発行するだけでこのインフラをそのまま使える——追加の
  実装は不要。以下の設計案・影響範囲の記述は経緯として残す。§9(教訓)
  も参照。
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
  - **STALE AGAIN, resolved 2026-09-06**: 1.5号 reached mission
    complete (D145/D146) using disk5/pmtiles-store as its working
    volume throughout, exactly as this section anticipated. **Decision
    for 2号: do not detach.** Live-checked headroom this same day —
    `/Volumes/Migrate-2025-04` 384Gi free, `/Volumes/pmtiles-store`
    413Gi free, both comfortable. 1.5号's own data (elevation +
    lineage, both datatypes, ~315GB combined) can coexist on the same
    disk as 2号's own generation_id-scoped tree by construction (D95/
    D124's whole point) — no cleanup of 1.5号's footprint is required
    before 2号 starts, only worth doing later if headroom actually
    gets tight. Detaching disk5 between 1.5号 and 2号 would cost a
    detach+reattach cycle for no real benefit now that both
    generations are known to want it in quick succession.
- **D37's `downsampling_covering.py` preflight gap**: **fixed
  2026-08-29 (D56)** — now runs automatically as part of `publish_
  cycle.py`'s own preflight, idempotently, every cycle. No longer a
  2号-specific concern; carries forward automatically.
- **D57's dirty-tracking trade-off — RESOLVED 2026-09-12, see D163**:
  the safe redesign this section calls for below (verifying actual
  output existence, plus an added MD5-based content check the original
  question hadn't anticipated) is now implemented and small-scale
  tested — see PLAN.md §8 and DECISIONS1.md D163 for the current state.
  The narrative below is kept for the original problem statement's own
  reasoning, not as a still-open item.
  `aggregation_covering.py`'s own cross-generation "skip if
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
- **Worker configuration — SUPERSEDED, 2026-09-05 (D130/D131)**: 1号's
  original `AGGREGATION_WORKERS=4`/`DOWNSAMPLING_WORKERS=3` (D38/D39)
  no longer applies. 1.5号 ran 5 aggregation workers for ~12h, then hit
  a real kernel panic (D129, memory-compressor exhaustion under
  sustained 5-worker concurrency). A follow-up throughput comparison
  (D130) found 3 workers cost only 23% less throughput than 5 for zero
  crash risk. Hidenori's call (D131): **fix `AGGREGATION_WORKERS=3` as
  the permanent default for both 1.5号 and 2号** — already changed in
  code (`hfu-mapterhorn` commit `8b19b17`, `get_worker_count()`'s
  default), so 2号 needs no env var and no re-measurement to get this.
  Only revisit if 2号's hardware or scale changes meaningfully from
  1.5号's (which was already full national scale, so unlikely).

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

## 8. 2号 launch runbook (rewritten 2026-11-01, D188)

The previous §8 (a 2026-09-06 readiness checklist that grew through
2026-10-01) is archived verbatim in `PLAN-archive.md`. Everything in it
that was still open is carried into the pre-flight list below or was
closed by D163-D187. Read this section top to bottom on launch day.

### 8.1 What 2号 is

2号 is the first generation built from **new GSI source data**. Every
generation between 1号 and 1.7号 re-ran the same source data through a
changed pipeline (1.5号: structure + lineage, 1.6号: nodata fix + land
upsampling, 1.7号: coastal-blur fix + z13-z16 wall extension). 2号 is
the only one that changes the data (D183). The pipeline code is not
supposed to change for it: a fresh `generation_id`, the 1.7号 code, and
a fast run. 1.7号 (`01M39W0T76QKN3GYJCPWX5MDHM`) is the baseline that
2号's cross-generation reuse (D163) compares against.

The duty behind it (D160): `japan-geotiff-dem`'s `latest_file_list.csv.gz`
is also what upstream Mapterhorn's `jpdem1a` reads. Publishing the
refreshed list is the hand-off to Oliver Wipfli; building 2号 from the
same list is how we find out what breaks in it.

### 8.2 Trigger status (live check 2026-11-01)

GSI's update-info page: the latest 1m and 5m (laser) update is still
**2026-07-31**; the latest 5m (photogrammetry) update is 2026-02-27. Past
cadence: 2025-07-31, 2025-10-31, 2026-02-27, 2026-07-31 (3 to 5 months
apart), so the next one is plausible from late November onward.

One new notice since the last check: on **2026-10-07** GSI paused and
replaced the 1m DEM for four 2nd-order meshes (473173, 483101, 483102,
483103) because of a data defect, and replaced the Kyushu regional
package (confirmed 2026-10-08). **Hidenori's decision (2026-11-01): ignore
it for now.** It needs no separate action because 2号's fresh download
picks up the replaced files anyway. Until then, our `jpnational1` Kyushu
data predates the replacement. (Details above come from a WebFetch
summary of the page, not a reading of the original; confirm mesh codes
against the page before relying on them.) Plain `curl` against the page
returns 403; use WebFetch or a browser for the check.

### 8.3 Stages and owners

| # | Stage | Who | Notes |
|---|---|---|---|
| A | Detect the update | Hidenori / scheduled check | Not automated yet. |
| B | Download region packs from GSI | **Hidenori**, by hand | Browser, session-bound, no bulk API and no diff API: it is a full re-download per product. Serial, one pack at a time. |
| C | `japan-geotiff-dem`: extract, skip-published, convert, sync, verify | Claude, **on slate** | `scripts/process_pack.py <res> <zone> <pack>` per pack, as packs land (overlaps with B). Then `just filelists <res>`, changelog entry, `just docs`. Needs `colima start -f --mount /Volumes/Migrate-2025-04:w` and a fresh `source-coop login` by Hidenori (tokens last about 1 hour). |
| C2 | Refresh the bridge's own copy of the file list | Claude, slate | `hfu-mapterhorn/source-catalog/jpnational{1,5,10}/file_list.csv.gz` is a **git-tracked local copy**, not fetched from the bucket (jpnational1: 291,779 rows, last regenerated 2026-08-25 by hand, D18 commits). No generator script exists in `hfu-mapterhorn`; write one and commit the regenerated lists, otherwise `source_download.py` keeps downloading the old set. |
| D | `hfu-mapterhorn` pipeline | Claude, slate | Run the "Pipeline" block of `CLAUDE.md` in order; wall fix and splice per 8.6. |
| E | Publish to `stars` | Claude, after Hidenori's explicit go | 8.7. |

**Who may do what upstream (confirmed 2026-11-01).** `optgeo/japan-geotiff-dem`
is Hidenori's own repo (`origin` = `https://github.com/optgeo/japan-geotiff-dem.git`,
`main` in sync with `origin/main`), so Claude may edit its scripts, run
its `just` recipes and `scripts/*.py`, run `aws ... --profile source-coop`,
and commit/push, following that repo's own `CLAUDE.md`. Human-only steps:
`source-coop login` (tokens last about 1 hour), downloading packs from
GSI, and anything Hidenori reserves for himself. Never run
`source-coop creds` (prints secrets), never add `--delete` to `sync`
(D9), and ask before inventing a `quadrans` upload (D6). Bucket writes
(`sync`, `filelists`, `docs`) are public-facing: Hidenori gives the
go-ahead per batch at launch, not per file. State on 2026-11-01:
`source-coop` has **no cached credentials** (login needed first) and no
docker daemon is running (8.4).

**Is the Source Cooperative package guaranteed to be corrected?** Only
for meshes whose filename changes. The mechanism is: `convert` -> `sync`
-> `just filelists <res>` (rebuilds `latest_file_list.csv.gz` and
`obsolete_file_list.csv.gz` from the live bucket listing, so the lists
always equal what is in the bucket; `latest` = newest 8-digit date per
mesh key, a tie at the newest date aborts) -> changelog + `just docs`.
That chain is sound for a new-dated file. It silently misses a **same-name
replacement** (GSI re-issues a mesh under the same filename), because:
`skip_already_published.py` skips by filename alone, `sync` is
`--size-only`, and `process_pack.py` verifies sizes only, never content.
D18 already hit the size-only blind spot once (a corrected file with the
same byte size as its broken original). Hence the guard in 8.4.

Measured reference points: a full national recompute (aggregation plus
both downsampling datatypes) took about 17 hours (D169); the 1.7号
publish transfer took about 6.6 hours because both ends of the link
negotiate 100 Mbps (see 8.4).

### 8.4 Pre-flight (do before GSI ships)

Status as of 2026-11-01. Items marked "approval" delete or move data and
need Hidenori's explicit go at the time.

- ✅ **Network (done 2026-11-01).** Before: slate `en0` `100baseTX`, `stars`
  `eth0` 100 Mb/s (D188). Hidenori replaced the router the same day.
  After: slate `1000baseT`, `stars` `eth0` 1000 Mb/s, new subnet
  `192.168.50.0/24`, public `stars.optgeo.org` still serves (tile 200,
  TileJSON 200). Measured LAN throughput over ssh to `stars`
  (2 GB, discarded on arrival): 22.6 s, about 89 MB/s, versus about
  11 MB/s before, so a 275 GB archive should take roughly 50 minutes
  instead of 6.6 hours. Not yet measured: the write speed of `stars`'s own
  disk and the ssh cipher ceiling (the test was CPU-visible at 10.9 s
  user time). Judge by the first real transfer. **Internet side
  (measured 2026-11-01, the router swap does not change it)**: 19 ms
  latency, 0% loss; upload about 9.7 MB/s (77 Mbps) to a nearby CDN
  edge; download about 7.8 MB/s (62 Mbps) from a single stream to France
  and about 46-63 Mbps from the Source Cooperative bucket (overhead-
  limited probes, treat as rough). So stage C uploads are likely bound
  by the WAN line at roughly 60-80 Mbps, not by the LAN: about 100 GB of
  changed GeoTIFFs would take on the order of 3 hours. Hidenori's ISP
  plan speed is not recorded here. Note: any stored
  `192.168.11.x` address is now stale; `.local` names still resolve.
- ⬜ **Upstream staging on slate.** `process_pack.py` refuses to start
  unless `src/1z`, `src/1`, `src/1-skip`, `dst/1` are empty. Measured
  2026-11-01 in `japan-geotiff-dem-repo`: `src/1z` holds 25
  `kyushu_okinawa-DEM1-20260603` packs from 2026-08-11 (about 99 GB),
  `src/1` 613 mesh zips, `dst/1` 34,522 GeoTIFFs (37 GB). Check what is
  already published (`skip_already_published.py`, `latest_file_list.csv.gz`),
  then clear (approval). The Kyushu packs are the ones GSI replaced on
  2026-10-08, so they must not be reused.
- ⬜ **Where downloads land.** slate's internal disk has only about
  33 GiB free. Point the browser's download folder at a directory on
  `/Volumes/Migrate-2025-04` (packs are about 2 GB each, extracted
  output is much larger). The disks themselves are sufficient: slate
  already has two 2 TB external SSDs (`/Volumes/Migrate-2025-04`, HFS+,
  and `/Volumes/pmtiles-store`, APFS); no additional disk is required.
- ⬜ **Disk plan** (measured 2026-11-01). Free: Migrate-2025-04 610 GiB,
  pmtiles-store 384 GiB. One generation in pmtiles-store costs about
  252 GB (aggregation/elevation 185 GB + downsampling/elevation 67 GB;
  both lineage layers about 0.1 GB). 1.5号, 1.6号 and 1.7号 are all
  still there (about 750 GB). `source-store/jpnational1` is 308 GB
  (`5` 24 GB, `10` 4.3 GB, `sea` 5.9 GB). `bundle-store/` currently holds
  the live 1.7号 archive (275 GB) plus lineage. Proposed, each with
  approval: (1) delete the 1.5号 generation's aggregation and
  downsampling layers before 2号 starts; (2) before `bundle.py`, move the
  1.7号 local archive out of `bundle-store/` (it is live on `stars`);
  (3) never hold more than two full-size elevation archives at once
  (D186: three at once is what caused the ENOSPC).
- ⬜ **Same-name replacement guard (upstream code change, needs
  Hidenori's go).** Proposed: (1) after `convert`, compare each local
  `.tif`'s MD5 with the `md5` column of the current
  `latest_file_list.csv.gz`; a same-name file with a different MD5 is
  uploaded with an explicit overwrite (`aws s3 cp`, not `--size-only`
  sync), logged in `logs/*_pack_log.jsonl`, and the lists are rebuilt
  afterwards; (2) a `--no-skip` mode (or per-pack override) for packs
  GSI announces as replaced, since `skip-published` cannot see content;
  (3) `verify` compares MD5 (ETag), not only size. First prove that
  `gmldem2tif` output is byte-deterministic: reconvert a few already
  published meshes (the 613 zips in `src/1`) and compare against the
  published MD5s. **Determinism proven 2026-11-01**: re-converting 40
  packs (1,618 meshes, DEM1A 2025-04-23 and 2026-06-03 vintages) gave
  1,618/1,618 byte-identical GeoTIFFs versus both the existing `dst/1`
  files and the published MD5s in the bridge's `file_list.csv.gz`, so an
  MD5 comparison is a sound change detector. Speed reference: 1,618
  meshes in 3 min 47 s with 4 workers in a 6-CPU/8 GiB colima VM, about
  7 meshes/s, so converting all ~291k meshes without `skip-published`
  would take on the order of 11-12 hours there (scales with CPUs).
- ✅ **Docker/colima on slate (2026-11-01).** Started profile `default`
  with 6 CPU, 8 GiB and `--mount /Volumes/Migrate-2025-04:w`; the
  `gmldem2tif:latest` image is present and the mount works (a full
  convert run succeeded). Raise CPUs/memory for the real run if RAM
  allows (slate has 16 GB and other jobs run on it). Original note:
  no daemon was running. `colima list`
  shows profile `default` (2 CPU, 2 GiB, 100 GiB) and `odm` (8 CPU,
  12 GiB, 60 GiB, the current docker context). Pick or create a profile
  sized for national conversion, start it with
  `--mount /Volumes/Migrate-2025-04:w` (without the mount, bind mounts
  are silently empty), and confirm the `gmldem2tif:latest` image exists
  in that VM (rebuild from `unopengis/gmldem2tif` if not).
- ✅ **Source Cooperative login (2026-11-01).** Hidenori runs
  `source-coop login`; verify with
  `aws s3 ls s3://smartmaps/japan-geotiff-dem/ --profile source-coop`.
  Lesson: a login done inside a **Screen Sharing** session did not leave
  a credential cache that Claude's shell (or even a later check) could
  see; the same login over **ssh** wrote
  `~/Library/Caches/source-coop/credentials/_default.json` and worked.
  Do the login over ssh. Tokens last about 1 hour: expect to repeat it
  during a long upload.
- ⬜ **Toolchain fingerprint (D170).** Record `gdalinfo --version` and the
  PROJ version now and compare at launch. Cross-generation reuse
  fingerprints cover inputs, not the producer; reuse is only safe if
  GDAL/PROJ are unchanged since 1.7号.
- ⬜ **Commit a publish script.** The 1.7号 publish script and its log
  lived in `/tmp/d182/` and were gone after the restart. Commit a
  parameterized version of the 8.7 procedure to `hfu-mapterhorn` and keep
  its log somewhere durable.
- ⬜ **One-shot wall-fix chain.** 8.6 as a single script that verifies and
  deletes each intermediate immediately (D186).
- ⬜ **Optional: no-change rehearsal.** Mint a throwaway generation ID and
  run covering plus aggregation with reuse on, against unchanged sources.
  It exercises D163 at national scale (never done: 1.7号 ran with
  `DISABLE_AGGREGATION_REUSE=1`) and shows the expected reuse rate
  before real data arrives. Costs disk (see the plan above).
- ✅ Carried forward unchanged from earlier readiness work: namespace
  separation and `generation_id` store layer (D95/D124), lineage and its
  low-zoom extension (D93/D146), `AGGREGATION_WORKERS=3` default (D131),
  D165/D167 pipeline fixes, D180 coastal-blur fix, D182/D186 wall fix,
  JGD2011 -> JGD2024 needs no change (D147), publish procedure (D173/D178/D187).

### 8.5 Launch sequence

1. Hidenori confirms which products GSI actually updated (1m, 5m laser,
   5m photogrammetry); only those resolutions are redone.
2. Stages B and C overlap: as each pack lands, run `process_pack.py`.
   Do not run two machines on the same zone.
3. After the last pack: `just filelists <res>`, add the dated changelog
   entry to `source-coop/README.md`, `just docs`, and tell Oliver (the
   `mapterhorn/mapterhorn#142` thread) with the list URLs.
4. Regenerate and commit `hfu-mapterhorn/source-catalog/jpnational*/file_list.csv.gz`
   from the freshly published `latest_file_list.csv.gz` (stage C2),
   then in `hfu-mapterhorn/pipelines`: `source_download.py` for each refreshed
   source, `source_prune_obsolete.py` (D19), `source_bounds.py`,
   `source_polygonize.py`.
5. Mint the 2号 ULID **and add it to `LAND_UPSAMPLE_ZOOM_BY_GENERATION`
   in `utils.py` in the same commit** (D166 finding #3). Value 16, as for
   1.6号 and 1.7号.
6. `aggregation_covering.py`, then the K4 roster cross-check (D123/D127:
   CSV count, `.todo` count, orphans, inconsistencies, duplicate
   coordinates, two-way match against `source-store`). New source data is
   exactly when a partial roster/reality break (Tsushima/Goto, D113-D115)
   is most likely.
7. `EMIT_LINEAGE=1 uv run python aggregation_run.py` with reuse **on**
   (unset `DISABLE_AGGREGATION_REUSE`). Sanity-check the reuse rate: the
   expected churn is roughly one third of files (Oliver's measurement,
   D42). If the numbers look wrong, fall back to
   `DISABLE_AGGREGATION_REUSE=1` (about 17 h).
8. `downsampling_covering.py`, `downsampling_run.py` per datatype,
   `lineage_extend_low_zoom.py` (after lineage downsampling, before
   lineage bundle), `bundle.py 1` per datatype, `merge_japan_bundles.py`
   per datatype. Never trust a `.done` count alone: run
   `check_downsampling_done_integrity.py` and `check_pmtiles_integrity.py`.
9. Elevation only: z0-7 splice and the wall fix (8.6).
10. Visual and numeric spot checks against real data, including areas
    that changed in the new GSI release plus the fixed landmarks:
    Shiripa Cape (43.227414N, 140.772436E), the Takeshima wall
    (37.3953N, 132.1873E), Mt. Fuji summit (35.3606N, 138.7274E).
11. Publish (8.7) after Hidenori's explicit approval.

### 8.6 Wall fix and z0-7 splice (elevation only)

Order is fixed (D186). Paths are relative to `hfu-mapterhorn/pipelines`.
`G` = the 2号 final-merge name `bundle-store/mapterhorn-japan-bridge.pmtiles`.

1. Splice: `./pmtiles merge bundle-store/mapterhorn-japan-bridge.z8plus.pmtiles /Volumes/Migrate-2025-04/global-overview-backup.pmtiles G`.
   The overview's baseline MD5 is `e66ed06ad81f15d9309cc98d2c0f0b95`; if
   it still matches, the z0-7 fill `wall-fix-z0-7.pmtiles` can be reused.
2. `uv run python build_wall_fix_archive.py z8-z12 --elevation G --overview <overview> --z0-7-fill bundle-store/wall-fix-z0-7.pmtiles --out bundle-store/wall-fix-z8-z12.pmtiles`
3. Three-way merge **with the real archive first** (metadata is inherited
   from the first input, D174): `./pmtiles merge G wall-fix-z0-7 wall-fix-z8-z12 <z8z12fix>`.
   Verify (`./pmtiles verify`, `check_pmtiles_integrity.py` must be CLEAN),
   then delete the pre-fill splice archive.
4. `uv run python build_wall_fix_archive.py z13-z16 --elevation <z8z12fix> --out bundle-store/wall-fix-z13-z16.pmtiles`.
   The z13-z16 mode requires the z8-z12-filled archive as input.
5. Final merge `<z8z12fix>` + `wall-fix-z13-z16` -> `<final>`; verify both
   checks again; delete `<z8z12fix>`; swap `<final>` in. Peak disk:
   two archives (about 550 GB) plus the 3 GB overview.
   Counts differ per generation; the acceptance criterion is
   CLEAN plus `addressed_tiles_count` equal to the expected sum, not
   1.7号's numbers (final 1.7号 archive: 67,311,837 tiles).

### 8.7 Publish to `stars` (D173/D178/D187)

`publish_cycle.py` stays hard-disabled (D115); publishing is manual.
1. `scp` to `/home/stars/data/<name>.pmtiles.new` on `stars@stars.local`.
2. Compare local and remote `md5`; stop on any mismatch.
3. On `stars`, two atomic `mv`: live -> dated backup, `.new` -> live.
   `martin` fs-watches, no restart needed. Lineage archive likewise.
4. Live checks with `curl -L` (the endpoint 301-redirects extensionless
   URLs): TileJSON 200, real tiles at Fuji and Shiripa, flat 52-byte
   tiles at Takeshima.
5. Keep the dated backup until Hidenori approves deleting it. `stars`
   had 1.3 TB free on 2026-11-01.

### 8.8 Communication (do not forget; agreed 2026-11-01)

- **One coordination issue for this cycle**, to be posted when
  preparation is going well (not before; no date promised). It goes on
  `mapterhorn/mapterhorn` as a new issue that links back to #142 (the
  long-running Japan thread, 26 comments, last activity 2026-08-21).
  English body for Oliver Wipfli and other upstream readers, **plus a
  Japanese summary** so Japanese volunteers can follow and help.
- Content: what 2号 is, what we are waiting for (GSI's next DEM update),
  how the chain works (download -> `japan-geotiff-dem` -> Source
  Cooperative lists -> `jpdem1a`/the bridge), the same-name replacement
  question for Oliver (8.3/8.4: does `japan-download` re-fetch when the
  `md5` of an unchanged URL changes?), and how volunteers can help
  (local visual spot-checks of the tiles; stage B is the human-bound
  step). Link only the parts Oliver needs (8.2, 8.3); machine, network
  and disk details stay out of it.
- Milestone updates on that issue: GSI release seen; lists republished
  (give the list URLs); 2号 build done; published. Facts only, no
  dates promised.
- Hidenori approves each post; Claude posts it as `hfu` via `gh` only
  after seeing the final text. Reply to #350 (per-pixel provenance
  request) with a pointer to the lineage tiles is a separate, optional
  post.
- Trigger to draft: when 8.4 is mostly checked off (base station
  verified at 1000 Mb/s, same-name guard decided, logins working).
  Claude raises it then, and again at "GSI release seen".

### 8.9 Non-blocking items carried forward

- D172: 116 orphaned z8 lineage tiles (pre-existing, also in 1.5号).
- D170: reuse fingerprint does not cover the GDAL/PROJ producer version.
- D171: `bundle.py` creates archives non-atomically.
- Report the shared GLO-30 inventory gap to Oliver Wipfli.
- Dashboard (`mapterhorn-monitor`) generation-independence; see §9.
- Re-run the documentation staleness audit once at 2号 launch (§9).

## 9. 1.5号 runからの教訓(2026-09-05時点、2号への申し送り)

1.5号は着手前の設計・独立レビュー(DECISIONS.md D122-D127)、本番稼働
(D128-D131)を経て、2026-09-05時点でaggregationが98%超まで完走。
ここまでで得られた、2号に直接引き継ぐべき教訓を整理する。

**コードは既に2号仕様、変更不要**:
- §4のD74-D76名前空間分離(案A)はD124で実装済み。2号は新しい
  generation_idを発行するだけでこのインフラをそのまま使える——コード
  変更は不要(「2号ではコードを変更せず高速に流すだけ」という本
  プロジェクトの方針の裏付け)。
- `.done`マニフェスト(JSON形式、datatypeスコープ+入力フィンガー
  プリントによる鮮度判定)、`remove_dangling_pmtiles.py`の安全化
  (generation_id明示必須・1号拒否・dry-run既定)も同様に2号へそのまま
  継承される。
- ワーカー数は`get_worker_count()`のデフォルトが**5→3に変更済み**
  (D131、`hfu-mapterhorn`commit `8b19b17`)——2号は`AGGREGATION_WORKERS`
  を明示指定しなくても自動的に3ワーカーで動く。

**起動前に必ず繰り返すべき手順**:
- **名簿突き合わせ(K4パターン、D123/D127/D128)**: 総CSV数・`.todo`化
  数・孤児・不整合・座標重複ゼロ・source-store全体との双方向突き合わせ。
  1.5号はソースデータが1号と同一だったため無傷でクリーンだったが、
  **2号は新しいGSIデータを取り込むため、対馬・五島パターン(D113-D115、
  名簿と実体の部分的な断絶)がむしろ新規に発生しやすい局面**——この
  チェックの重要性は2号でこそ高まる。
- **TMPDIRは全ての書き込み経路をカバーする**(D125のF1指摘): Go CLI
  経由(`./pmtiles`ラッパー)とPython Writer経由(`utils.create_archive()`)
  は別経路。2号で新しいスクリプトを足す場合、同じ監査を通すこと。
- ロールバックコマンドの事前文書化(HANDOVER.md)は、D129の復旧判断を
  速くした。2号でも起動前に明記しておく。

**判断・プロセス面の教訓**:
- **「近道」に見えるアレンジには隠れた事故リスクがある**(D123):
  1号データへの直接再適用(「1.4号」)は一見安上がりだったが、旧
  フラット構造ゆえのD76型ファイル誤削除バグをFableの検証で寸前に発見。
  2号でも「今回は変更が少ないから」で慎重な検証(実装者以外による
  独立レビュー、chained rehearsal)を省略しないこと。
- **リソース設定の安全性は、短時間の試験運用では証明できない**
  (D129/D130): D129のクラッシュはメモリコンプレッサーのsegment使用量
  が12時間超かけて累積した結果で、数時間のソークテストでは再現しない
  種類の故障モードだった。2号で新しい並列度・リソース設定を試すなら、
  判断材料は長時間の実測に限定すること。
- **ドキュメントのstaleness監査は着手の節目ごとに価値がある**
  (D126、および2026-09-05のDECISIONS.md分割)。CLAUDE.md/HANDOVER.md/
  PLAN.mdは実装が先行すると簡単に化石化する。特に「まだ着手すべきで
  ない」という否定的な指示文は、着手完了後も残って新セッションを
  誤誘導しやすい——本ファイル§4の「[最優先, 未実装, 設計のみ]」という
  見出し自体がまさにその実例だったため、本更新(§4)で修正した。2号
  着手時にも同様の監査を一度実施する価値がある。

**監視・運用面の教訓**:
- **ダッシュボード(mapterhorn-monitor)は世代非依存にしておく必要が
  ある**: 1号のrepair-cycleスキーマ(`current_stage.done`/
  `baseline_done`等)に強く紐づいていたため、1.5号のfresh-build
  スキーマとの不一致でCurrent Stage計器のstat gridが長期間空のまま
  気づかれず、他3計器(status-map/mission-timeline/progress-trend)も
  同種の理由で無言のまま止まっていた。2026-09-05に
  `aggregation.done/total`直読み+`current_stage.started_at`ベースへ
  書き直して修正済みだが、**2号着手前に、残り3計器を復活させるか、
  世代非依存の設計に作り直すかを判断する価値がある**。
- ダッシュボード更新は現状エージェント直轄(15分おきの手動更新)で、
  Claude.appの再起動でMonitorタスクが失われる既知の脆弱性がある。
  2号(1.5号よりさらに長時間になりうる)に向けて、機械的な更新部分を
  slate側の自律スクリプトに切り出す方向性は既に承認済み(未実装)——
  2号着手前の実装を検討。

**機能面の申し送り**:
- **lineageの低ズーム拡張(D146)は2号でも標準手順として実行すること**:
  elevationの`downsampling_covering.py`が持つ`min_output_zoom=8`という
  下限は、Mapterhorn本家グローバルz0-7成果物を接合する設計上の都合で、
  lineageには本来当てはまらない(lineageには接合対象となる外部の
  グローバル成果物が存在しない、D96)。2号でも、lineageの
  downsampling_run.pyがz8まで完走した後、bundle.py
  (`BUNDLE_DATATYPE=lineage`)を実行する**前に**、
  `hfu-mapterhorn/pipelines/lineage_extend_low_zoom.py`を実行すること。
  既存の共有パイプラインコード(`downsampling_covering.py`/
  `downsampling_run.py`)は一切変更せず、既に構築済みのz8レイヤーを
  読み取り専用で使い、z7/z6/z5/z4(デフォルト、`LINEAGE_EXTEND_
  TARGET_ZOOM`で変更可)を追加構築する独立スクリプト——generation_id
  は`utils.get_aggregation_ids()[-1]`から自動取得するため、2号でも
  コード変更なしにそのまま動く設計。実行は数秒〜数十秒程度(1.5号
  実測、Japan-only低ズームのタイル数は極小)。内蔵のタイル数
  サニティチェック(`SANE_TILE_COUNT_CEILING`)が、開発中に実際に
  発生した「地球全体を誤って対象にする」バグの再発を自動検知する。
  2号のソースデータが1.5号と異なる場合(新GSIデータ取り込み、§3)、
  z8時点の実タイル数が変わりうる点に留意——閾値(5000)は余裕を
  持たせてあるが、極端に既存想定と異なる規模になった場合は要見直し。
  詳細はDECISIONS.md D146参照。

## Resume note

If picking this file up cold: check `DECISIONS.md`'s most recent
entries for 1号's actual completion status first (this document's own
"840/1,979... ETA late 2026-08-27" line goes stale fast), and check
whether the full-109-mesh ground-truth sweep (section 3) actually
finished clean or found something new before assuming section 3 is
settled.
