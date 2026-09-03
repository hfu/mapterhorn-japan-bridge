# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `CLAUDE.md` first for
the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

## 2026-08-08: First session — pipeline validated, viewer left broken

Everything in this session happened as a continuation of a much longer
`japan-geotiff-dem` session (refreshing Hokkaido's 1m DEM) — see that
repo's own `HANDOVER.md` for the GSI-download side of the story. This
file picks up from "can we build Mapterhorn tiles ourselves, ahead of
upstream integration?"

- Investigated options: `hfu/fusi` (Hidenori's own from-scratch
  Terrarium/PMTiles tool, works on weak machines, but "rough" mixing —
  no real multi-resolution downsampling) vs. `hfu/mapterhorn` (a fork
  of upstream `mapterhorn/mapterhorn`, already used for a real
  Freetown orthophoto project, carries real bug fixes and a
  sophisticated priority-merge/blend system, but heavier hardware
  requirements). Decided on `hfu/mapterhorn` — this is meant to be a
  short-lived bridge, so reusing upstream's real pipeline (closest
  eventual output to what upstream will itself produce) beat investing
  in porting its mixing logic into `fusi`.
- Resource-checked this session's main machine (`aalto`: Apple M1,
  8GB RAM, external volume is a spinning USB HDD) against Mapterhorn's
  stated needs (SSD random access, ~4GB/aggregation-tile RAM spikes) —
  concluded it's workable but tight. Found `slate` (a Mac mini, M4,
  16GB RAM, genuine attached SSD, reachable via `ssh hfu@slate.local`)
  as a much better fit; installed `brew`/`uv`/`gdal`/`just`/`git`
  there (previously bare) and moved all pipeline execution there (D2).
- Cloned `hfu/mapterhorn` fresh onto `slate`'s SSD (not the existing,
  stale, upstream-only mapterhorn clone already there from an old
  April-2025 migration backup — left that one untouched).
- Built `jphakodatetrial1`: a small real source-catalog entry (Mt.
  Hakodate + Goryokaku, 43 files, 2 mesh blocks), fed from
  `smartmaps/japan-geotiff-dem` via `file_list.txt` (D3), deduplicated
  by mesh (D4), skipping `source_to_cog.py` (D5). Ran the full source →
  aggregation → downsampling → bundle sequence successfully — first
  real end-to-end validation of the whole approach.
- Published the first real output to a new Source Cooperative product,
  `smartmaps/mapterhorn-japan-bridge` (created by Hidenori via the
  source.coop web UI, per the established human-does-account-creation
  convention). Verified it renders as real hillshade terrain in the
  official `mapterhorn.com/viewer`.
- Hidenori asked directly whether the Mt. Hakodate summit's apparent
  1m coverage gap meant 5m/10m mixing was needed. Checked (not assumed
  "probably water"): computed the exact JIS mesh code for the summit,
  confirmed it's real land with only 13/100 possible 1m cells present
  in that block. Added `jphakodatetrial5m`/`jphakodatetrial10m` (D9),
  re-ran the full pipeline with all three sources present — 499
  aggregation items (up from 2), confirming the mixing genuinely
  engages.
- Hidenori then asked a sharper, specific question: could the
  *lowest*-resolution source (10m) actually be overwriting the higher
  ones instead of only filling gaps? Read `aggregation_merge.py` and
  `utils.py` line by line rather than trusting the docs' prose (D8) —
  confirmed the sort and the compositing logic are both correct
  ("first/highest priority" = base layer only, never gets painted over
  by later, lower-priority sources).
- Adopted `japan.pmtiles` (D7) as the publishing strategy per
  Hidenori's own proposal: merge everything produced so far into one
  file, same name every time, rather than a per-prefecture
  `hokkaido.pmtiles` (Hokkaido doesn't cleanly fit inside a single
  Mapterhorn z6 bundle tile anyway — confirmed directly, the 3-source
  run produced 2 separate z6 bundles). Wrote an ad hoc merge script
  (generalizing `hfu/mapterhorn`'s own `pipelines/merge_bundles.py`,
  which is hardcoded to Freetown's specific filenames) and published
  the result. Deleted the now-superseded single-purpose files from the
  product (`6-57-23.pmtiles`, `hakodate-trial-merged.pmtiles`) once
  `japan.pmtiles` existed.
- Built this repo (`hfu/mapterhorn-japan-bridge`) specifically because
  Hidenori didn't want viewer/docs code added to the `hfu/mapterhorn`
  fork itself (D1) — a GitHub Pages page reusing `hfu/kitavolca`'s
  basemap+hillshade+3D-terrain MapLibre pattern, meant to give a
  better fidelity check than the bare official viewer.
- **That viewer doesn't work yet** — see `DECISIONS.md` D10 for the
  full diagnostic writeup (style loads fine, but neither the bvmap
  basemap nor the hillshade layer renders, and zero network requests
  to the bvmap tile host were ever observed). Time-boxed the debugging
  to make room for this handover before a context `/clear`.

### Current state

- `smartmaps/mapterhorn-japan-bridge` is live: `README.md` (with a
  preview link to the *official* Mapterhorn viewer) + `japan.pmtiles`
  (~3MB, ~11,900 tiles, covering the Hakodate/Goryokaku trial area
  with 1m/5m/10m mixing).
- `hfu.github.io/mapterhorn-japan-bridge/` is deployed but **broken**
  (D10) — visually blank despite the style loading successfully.
- `hfu/mapterhorn` on `slate`
  (`/Volumes/Migrate-2025-04/github/hfu-mapterhorn/`) has 3 working
  trial source-catalog entries plus `jphokkaidodem1` (real target,
  file list built but not yet run — and now stale, since it was built
  before `japan-geotiff-dem` processed `Z013`–`Z018`; see that repo's
  `HANDOVER.md`).
- `japan-geotiff-dem` (the upstream data source for all of this) is
  mid-refresh — 18 of 46 Hokkaido parts downloaded as of this
  handover, last real `sync` only covers through `Z012`. This repo's
  `jphokkaidodem1` work should not proceed until that repo's own
  `HANDOVER.md` next-steps are further along (specifically: a fresh
  `sync`).

### Next steps (as of 2026-08-08, superseded by 2026-08-09 session below)

- [x] **Debug the viewer** (D10) — resolved, not reproducible; see
      2026-08-09 session.
- [ ] Once `japan-geotiff-dem` has synced its fuller Hokkaido progress
      (its own `HANDOVER.md` next-steps), regenerate `jphokkaidodem1`'s
      `file_list.txt` against the current bucket state (D3/D4) and its
      matching `jphokkaidodem15m`/`10m` fallback entries (D9), then run
      the full pipeline for real Hokkaido coverage (not just the
      Hakodate trial).
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-09: Viewer resolved (not reproducible); found and fixed 3 elevation-pipeline bugs in `hfu/mapterhorn`; japan-geotiff-dem synced through Z018

Picked up from the 2026-08-08 handover. Priority order per Hidenori:
(1) debug the viewer, (2) check `japan-geotiff-dem` sync progress and
regenerate `jphokkaidodem1` file lists if ready, (3) otherwise report
and wait.

- **D10 (viewer bug): resolved, not reproducible.** Re-tested live
  against `hfu.github.io/mapterhorn-japan-bridge/` in a real browser —
  bvmap and hillshade both render correctly, confirmed via
  `map.style.sourceCaches[id]._tiles` state (all `loaded`, real feature
  buckets) across two independent fresh page loads. No code changed
  since the original report (only docs landed in between); whatever
  caused it was external and cleared on its own. Full writeup in
  `DECISIONS.md` D10, including a methodology note: this session's
  network-request-log tooling is blind to however MapLibre issues these
  particular requests — don't trust "zero requests in that log" as
  proof of a stuck source again; inspect `sourceCaches` state directly.
- **`japan-geotiff-dem` progress**: Hidenori downloaded and processed
  Hokkaido `Z019`-`Z030`+ over the course of this session (ongoing at
  session end); `just sync 1` was run for real, publishing `Z001`-`Z018`
  to `s3://smartmaps/japan-geotiff-dem/1/` (6.0 GiB transferred).
  `source-coop/README.md`'s changelog got a new dated entry for this
  partial refresh, published via `just docs`. See that repo's own
  `HANDOVER.md` for the session's full download/convert/sync detail.
- **Found `japan.pmtiles` was badly broken, root-caused and fixed 3
  separate bugs in `hfu/mapterhorn`** (all from the same
  orthophoto-adaptation commit, `5eaa737`) — full technical writeup in
  `DECISIONS.md` D11:
  1. Base tiles encoded through a lossy RGB/photo WebP path instead of
     lossless Terrarium.
  2. Reprojection resampling set to `-r lanczos` (photo-appropriate)
     instead of upstream's `-r cubicspline` + `-dstnodata -9999`.
  3. Downsampling's overview pyramid (z16-z11) zero-filled missing
     child tiles, which decodes to a phantom elevation of -32768m and
     corrupts any average it's blended into — confirmed by direct pixel
     decode showing overview tiles with elevations spanning the entire
     -32768..+32767 range. Fixed with a real alpha channel (nodata-aware,
     weighted averaging) rather than a workaround.

  Fixed all three behind a `TILE_ENCODING` env var (`terrarium` default
  / `rgb`, matching the existing `CENTER_LAT`/`CENTER_LON`-style
  override convention in this fork) so the already-completed Freetown
  orthophoto pipeline stays reproducible if it's ever re-run. Also
  parallelized `bundle.py` (was sequential despite independent
  per-parent output files; added `BUNDLE_WORKERS`, same convention as
  `AGGREGATION_WORKERS`/`DOWNSAMPLING_WORKERS`) — slate's CPU was
  mostly idle during what should've been the busiest stage.

  Re-ran the full trial (reproject → merge → tile → downsample → bundle
  → merge, 501 aggregation items) under the fixes and verified via
  direct pixel decoding (not just visual inspection — see D11's
  methodology note on why screenshots alone were unreliable here) that
  elevations across z11-z17 are now sane (roughly -256m to +333m,
  matching Mt. Hakodate's real range) with no more out-of-range garbage.
  Visual check at both z17 (close) and z11 (wide) is clean.

  **Not yet done**: nothing has been committed to git on `slate`, and
  `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles` has **not**
  been republished — it still has the old broken encoding. Hidenori
  asked to hold off on republishing until the remaining open items below
  are also fixed, given they may affect the same file.

### 2026-08-09, continued — staircase artifact root-caused (macrotile_z), land data now verified clean

Hidenori redirected mid-session from symptom-based debugging to a
systematic upstream diff (`git remote add upstream
https://github.com/mapterhorn/mapterhorn.git && git fetch upstream` on
`slate` — no `upstream` remote existed before this, despite
`FORK_NOTES.md` implying one; add it fresh if it's gone again).
Full technical account in `DECISIONS.md` D11's final two updates: the
"staircase" turned out to be two things, both now fixed —

1. `downsampling_run.py`'s requantization rewritten to match upstream's
   exact decode-average-then-floor-digit-extract formula (was
   previously rounding averaged R/G/B channels independently, which
   works in exact arithmetic but isn't upstream's approach and risks
   digit-boundary overflow).
2. **`macrotile_z` was hardcoded to 17 fork-wide** (upstream: 12) —
   traced to Hidenori's own earlier commit `4bf6e535`, a real fix but
   for a completely different problem (a ~4cm/px, maxzoom~21 Freetown
   orthophoto source that needed the safety cap; our 1m elevation data,
   native maxzoom 16, didn't need it at all and was harmed by it two
   ways). Fixed as `macrotile_z = 12 if TILE_ENCODING == 'terrarium'
   else 17` in `utils.py` — restores upstream's value for elevation
   sources, leaves the Freetown/photo path untouched.

Consequence of fix #2 worth remembering: our 1m GSI data's **honest
native maxzoom is 16, not 17** — the z17 this whole investigation spent
hours treating as "the clean reference resolution" was itself an
artificial oversample forced by the old `macrotile_z=17` floor. The
archive's real maxzoom is 16 now. Re-ran the full pipeline
(`aggregation_covering.py` onward); the trial's 3-source coverage
collapsed from 501 aggregation items to **4**, downsampling from 149 to
31 — both expected given the coarser macrotile grid, not a regression.

**Verified via direct pixel-boundary comparison between adjacent tiles**
(mean diff 0.07m, max 1.0m — quantization noise, not a seam) **and
visually** — Hidenori confirmed by opening
`http://localhost:8971/index.html` in his own browser on `aalto`
(same machine as this session): "陸は綺麗だね。これで正しそうだ" (the
land looks clean, this looks correct).

**Land data is now considered verified correct — do not re-litigate the
encoding/resampling/nodata/quantization/macrotile_z findings without a
specific new reason.** What's left:

- [ ] **Sea/ocean.** Attempted this session with a cropped
      `jphakodatetrial­sea` source-catalog entry (2 Copernicus GLO-30
      tiles → cropped to a 0.3°×0.3° box), but under the *old*
      `macrotile_z=17` it exploded the aggregation item count to
      901 (then 773 even cropped tighter) — some individual items
      needed 4GB+ of intermediate raster, and disk usage on `slate`
      briefly hit 90%. Set aside specifically so the truncation/
      macrotile_z fixes could be verified in isolation first (now
      done, see above) — Hidenori expects the `macrotile_z=12` fix to
      make sea merging much more tractable next time, since it's the
      same mechanism that was inflating those tiles. The source is
      parked at `slate:.../pipelines/source-store-sea-setaside/`
      (renamed out of `source-store/`, not deleted — move it back to
      resume; `aggregation_covering.py` globs `source-store/*/bounds.csv`
      unconditionally with no way to exclude a source except physically
      moving it out). Also still true: study upstream's actual
      sea-handling implementation rather than guessing at one — not yet
      done this session.
- [ ] **5m/10m fallback fill reaching 1m's own (now known-correct z16)
      maxzoom** — flagged last session as needing a look, still not
      actually verified either way. Low priority relative to sea, but
      don't forget it.
- [ ] **Commit the `hfu/mapterhorn` changes on `slate`.** Nothing is
      committed yet — `git status --short` shows 5 modified pipeline
      files plus new `merge_japan_bundles.py` (a real, generalized
      version of `merge_bundles.py`, worth keeping),
      `source-catalog/jphakodatetrialsea/`, and some throwaway helper
      scripts (`full_rerun.py`, `retile_terrarium.py` — safe to delete,
      not needed anymore now that the pipeline runs clean end to end).
      Full diff summary in `DECISIONS.md` D11's last update. Do this
      before anything else risks the working tree.
- [ ] **Republish `japan.pmtiles`** (D7) once sea is resolved too —
      `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles` still has
      the *original broken* encoding from before this entire
      investigation. The current good build is local-only:
      `slate:.../pipelines/bundle-store/japan.pmtiles`, last verified
      via a session-scoped copy on `aalto`
      (`/private/tmp/claude-501/.../scratchpad/pmtiles-preview/`,
      served by a hand-written Node range-server on port 8971 — gone
      after this session; `python -m http.server` doesn't send real
      `206 Partial Content` and pmtiles-js needs that, so don't just
      reach for it again without remembering that gotcha).
- [ ] Once `japan-geotiff-dem` finishes syncing its fuller Hokkaido
      progress (**Hokkaido's download is now fully complete, 46/46
      parts** as of this session — see that repo's own `HANDOVER.md`),
      regenerate `jphokkaidodem1`'s `file_list.txt` (D3/D4) and matching
      `5m`/`10m` fallback entries (D9), then run the full pipeline for
      real Hokkaido coverage, not just the Hakodate trial. Kyushu/
      Okinawa 1m downloads also started this session (in parallel, per
      Hidenori's own "北日本・南日本を先行させる" plan — islands/coastline-
      heavy regions first, to stress-test sea handling, before the
      larger-landmass 東日本/西日本) — no bridge source-catalog entry
      for that region exists yet, will need one analogous to the
      Hokkaido trial when that becomes relevant.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-09 (new session): committed on `slate`, sea re-run succeeded, republished

Picked up exactly where the prior session's resume prompt (below, now
superseded) left off. Priority order per Hidenori: (1) commit, (2)
resume sea, (3) republish once sea looks right, (4) check
`japan-geotiff-dem` readiness for a real `jphokkaidodem1` run.

- **(1) Committed.** `git status` on `slate` matched the prior
  handover exactly (5 modified pipeline files + `merge_japan_bundles.py`
  + `source-catalog/jphakodatetrialsea/` + two throwaway helpers).
  Committed as `5609479`. Left `full_rerun.py`/`retile_terrarium.py`
  untracked rather than deleted — removing files over `ssh` was blocked
  by this session's own sandbox policy as a remote destructive action;
  harmless to leave behind, safe to delete by hand later. Added
  `tmp-store`/`source-store-sea-setaside` to `pipelines/.gitignore`
  while in there (they'd been showing as untracked only because,
  being renamed rather than the originals, they didn't match the
  existing `source-store`/`aggregation-store`/etc. patterns).
- **(2) Sea resumed and succeeded.** Moved
  `source-store-sea-setaside` back to `source-store/jphakodatetrialsea`
  and re-ran the full pipeline (covering → aggregation → downsampling
  → bundle → merge) with all 4 sources present. Hidenori's prediction
  was right: 19 aggregation items this time (vs. the old regime's 901
  then 773), no disk pressure, no errors. Verified via direct pixel
  decode of all 7,383 tiles across every zoom — no out-of-range
  elevations (the `-32768` signature that would indicate the old
  zero-fill bug is back would have been easy to spot). Sea itself
  decodes to roughly flat ~0m, consistent with Copernicus GLO-30 being
  a land DEM that reports sea level rather than real bathymetry.
  **Caveat, still open**: this confirms the sea data isn't corrupted,
  not that GLO-30's ~0m convention is actually the right approach —
  upstream `mapterhorn/mapterhorn`'s own sea-handling still hasn't been
  studied (see `DECISIONS.md` D11's latest update for the precise
  boundary of what was and wasn't checked this round).
- **(3) Republished.** `source-coop login` had expired on `aalto`;
  Hidenori refreshed it live. Uploaded the new 132MB `japan.pmtiles` to
  `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`, replacing the
  pre-investigation 3.26MB broken build. This is now the first real
  publication of the fully-fixed pipeline's output, sea included.
- **(4) `japan-geotiff-dem` readiness: not quite yet, but moving.**
  Hokkaido's 1m download is still 46/46 (unchanged), but the
  extract/convert backlog on `aalto` was idle (no process running)
  despite 54 unprocessed zips in `src/1z/` — restarted it
  (`just extract 1 && just convert 1`, backgrounded) and separately
  kicked off `just sync 1` to catch published state up to local (last
  real sync only covered through `Z018`; local `dst/1` was at 28,892
  tifs before this restart). Per `japan-geotiff-dem`'s own `HANDOVER.md`
  next-steps, `jphokkaidodem1`'s `file_list.txt` regeneration should
  wait until that sync reflects current state — didn't regenerate it
  this session, just got the prerequisite jobs moving again. Hidenori
  is also continuing Kyushu/Okinawa 1m downloads by hand in parallel
  (in progress as of this session, part-by-part through GSI's portal).

### Next steps (superseded by the same-day follow-up session below)

- [x] Study upstream `mapterhorn/mapterhorn`'s actual sea-elevation
      handling — done, see below and `DECISIONS.md` D11's latest
      update: confirmed GLO-30 is upstream's own universal fallback
      too, no separate bathymetry source exists.
- [x] 5m/10m fallback fill reaching 1m's own maxzoom (z16) — answered
      by reading `aggregation_reproject.py` directly (see `DECISIONS.md`
      D11): yes, within any macrotile containing 1m data, 5m/10m gets
      cubicspline-warped to z16 before merging. Not yet empirically
      pixel-checked against a specific real gap-filled tile, so treat
      as "verified by code reading" (D8-style), not "pixel-proven."
- [ ] Once `japan-geotiff-dem`'s `just sync 1` completes and Hokkaido's
      extract/convert backlog is fully drained, regenerate
      `jphokkaidodem1`'s `file_list.txt` (D3/D4) and matching `5m`/`10m`
      fallback entries (D9), then run the full pipeline for real
      Hokkaido coverage — not just the Hakodate trial. Still not done as
      of this session's end either — see "aalto processing speed" below.
- [ ] Once Kyushu/Okinawa 1m downloads finish and get synced, a
      corresponding bridge source-catalog entry will be needed
      (analogous to the Hokkaido one), per Hidenori's
      islands-and-coastline-first plan.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-09 (same day, follow-up): upstream sea handling confirmed, viewer artifact root-caused and fixed, aalto throughput measured

Hidenori looked at the just-republished `japan.pmtiles` live in
`mapterhorn.com/viewer` and flagged it as "少し奇妙といえば奇妙かな" —
prompting (1) actually studying upstream's sea handling (an item left
open all session), (2) investigating the visual artifact and whether
it points at the still-unverified 5m/10m→z16 fallback question, and
separately (3) a real-world processing-speed check on `aalto`.

- **Upstream sea handling: confirmed to match.** Read `upstream/main`'s
  `source-catalog/` directly on `slate` — found `glo30`, a real 24,674-
  tile global entry using the *same* Copernicus GLO-30 dataset this
  bridge's own sea trial uses. No separate bathymetry/ocean source
  exists upstream. This resolves the open item definitively: GLO-30's
  near-0m sea convention **is** upstream's actual approach, not a
  bridge-specific guess. Full detail in `DECISIONS.md` D11.
- **The viewer artifact was real, but smaller than first measured —
  caught and corrected my own error mid-session.** Screenshotted
  `mapterhorn.com/viewer` with the republished archive loaded (had to
  explicitly click "View" — the `#url=` hash still doesn't reliably
  auto-apply, same D10/D11 caveat) and saw a clear rectangular seam in
  the hillshade. First pass measured the original 0.3°×0.3° sea crop's
  south edge as ~12km short of the land trial's own southern extent —
  **wrong**, a hand-arithmetic error converting Web Mercator to lon/
  lat. Redone with an actual script (cross-checked against `gdalinfo`,
  exact match): the sea crop's south edge was already ~11km *past*
  the land trial's, no gap at all. The one real gap was the east edge,
  short by ~2km. See `DECISIONS.md` D11's correction note for the
  full account — the fix applied (a much larger, generous-margin crop)
  was still the right call, just for a smaller problem than reported.
- **5m/10m→z16 fallback: answered by reading `aggregation_reproject.py`
  directly** (D8-style verification). Every source group within a
  macrotile gets warped to the *same* target resolution — the
  macrotile's finest present source's maxzoom — before merging. So
  5m/10m fallback genuinely reaches z16 wherever 1m data exists at all
  in that macrotile. Not yet pixel-proven against a specific real
  example, but code-verified.
- **Fixed the sea crop.** Re-downloaded the raw N41/E140 GLO-30 tile
  (the old crop had discarded the source after cropping) and recropped
  to lon 140.40–140.95, lat 41.45–41.95 — generously exceeding the land
  trial's real extent on every side now, numerically checked. Updated
  `source-catalog/jphakodatetrialsea/Justfile`'s comment with the exact
  numbers and reasoning.
- **Clean rebuild, verified, republished** (with Hidenori's explicit
  per-publish go-ahead — see `DECISIONS.md`'s privacy/publish-
  confirmation convention, applies every time, not just once per
  session). New covering run found only 17 of 36 aggregation items
  needed reprocessing (`write_aggregation_todos()`'s incremental-diff
  design correctly left pure-land macrotiles alone) — cost some time to
  mis-diagnose as an interrupted/crashed run before re-reading the code
  and realizing it was working as intended. Final archive: 7,589 tiles,
  134,120,534 bytes, verified via direct pixel decode (no out-of-range
  elevations at any of 17 zoom levels; coarse-zoom coverage visibly
  grew as expected). Republished to
  `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`.
  **Hidenori has not yet personally re-checked this build in his own
  browser** (unlike the land-only verification earlier this session,
  which he did check directly) — worth doing before considering the
  sea artifact fully closed.
- **`aalto` processing speed, measured directly** (Hidenori asked
  specifically about pace, guessing "北海道分完全消化は12時間後くらい"):
  the extract/convert backlog restarted earlier this session includes
  55 zip files in `src/1z/`, but only 20 of them are genuinely
  unprocessed (Hokkaido `Z036`–`Z046`, 11 files/~21GB; Kyushu/Okinawa,
  9 files/~17GB) — the other 35 Hokkaido zips (`Z001`–`Z035`) were
  already extracted in earlier sessions, so `unzip -n` skips them
  almost instantly. Watched one real zip (`Z035`, 2.12GB) start-to-
  finish: **~44 minutes**, confirming the external-HDD bottleneck
  `HANDOVER.md` already flagged (~0.3–2MB/s effective, highly variable
  — a 13-second sample mid-run showed 0.43MB/s, a 148-second sample
  showed 1.85MB/s). At the observed real per-zip rate (~2.9GB/hour),
  the remaining ~21GB of Hokkaido alone is roughly **7–8 hours** of
  extract, and all ~38GB (Hokkaido + Kyushu/Okinawa) roughly **13
  hours** — broadly matching Hidenori's own 12-hour guess once the
  already-done 35 zips are correctly excluded from the estimate. This
  does **not** include `convert` (the Docker `gmldem2tif` step, which
  only starts after `extract` fully finishes per `just extract 1 &&
  just convert 1`) or the `sync`/`file_list.txt` regeneration after
  that — those add unknown additional time on top.

### Next steps (superseded by the same-day "city-scale" session below for the sea-fix follow-up items)

- [x] Ask Hidenori to personally re-check the republished
      `japan.pmtiles` — done, live in his own browser: "slate は、私も
      目視して、おそらく大丈夫だと思う。"
- [ ] **`jphokkaidodem1` real-run readiness is a waiting game, not a
      blocked task**: extract/convert is running in the background on
      `aalto`. Once Hokkaido's `Z036`–`Z046` finish extracting and
      converting, run `just sync 1` again, then regenerate
      `jphokkaidodem1`'s `file_list.txt` (D3/D4) and `5m`/`10m` fallback
      entries (D9) on `slate`, then run the full bridge pipeline for
      real Hokkaido coverage. Still not done — see below for why this
      session went with a smaller, already-published-data city-scale
      build instead of waiting for this.
- [ ] Once Kyushu/Okinawa 1m downloads finish and get synced, a
      corresponding bridge source-catalog entry will be needed.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-09 (same day, third session): city-scale japan.pmtiles built — all of Hakodate City, not just the peninsula trial — pending Hidenori's go-ahead to republish

Hidenori's own download progress moved to Kyushu/Okinawa part 10, then
11, then 12 (他ダウンロード継続, no action needed — separate from this
repo). He then asked for something bigger: a "next generation"
`japan.pmtiles` covering all of Hakodate City (函館市全域), as `slate`-
side work, and asked directly whether `jphokkaidodem1` (the full-
Hokkaido entry) needed updating first to make that possible.

**Answer given (and acted on): no.** `jphokkaidodem1` covers all of
Hokkaido — far more than needed, and much slower to build, for a
city-scoped goal. Instead built three new, appropriately-scoped
source-catalog entries — `jphakodatecity1`/`5m`/`10m` — fed from
whatever's *already published* on `smartmaps/japan-geotiff-dem` right
now (per Hidenori's own "とりあえず現状ベースで" framing), leaving
`jphokkaidodem1` for its own separate, later, full-Hokkaido session.

- **Scope**: no real administrative boundary for 函館市 was available
  in this environment, so the area is an approximation derived from
  mesh-block reconnaissance (checking which 1st/2nd-level JIS mesh
  blocks actually have published data, and their real corner
  coordinates via `gdalinfo`): lon 140.55°–141.20°E, lat 41.70°–42.00°N.
  This comfortably covers the original Hakodate/Goryokaku trial
  (confirmed lon 140.625–140.875, lat 41.750–41.833 — see `DECISIONS.md`
  D11's correction note about an earlier bad manual coordinate
  conversion this session) but is **not** a verified match to
  Hakodate's actual post-2004-merger municipal boundary (which likely
  extends further east toward Cape Esan/恵山). Worth refining with a
  real boundary source if this matters later.
- **File lists built from real bucket listings, not guesses**: with
  `source-coop login` briefly expired mid-session (Hidenori refreshed
  it live when he checked back in — "ちょっと戻ってきて、loginしたよ"),
  first built candidate lists from `aalto`'s local `dst/1` filenames
  (public HTTPS reads don't need the credentialed profile) and verified
  each via `curl`, then switched to authoritative `aws s3 ls` listings
  once login was back. Final counts: 1,114 files (1m), 1,403 files
  (5m), 20 files (10m) — all confirmed actually published.
- **Sea crop expanded again**, same lesson as the first expansion this
  session but sized for the city not the peninsula: re-downloaded all
  4 relevant GLO-30 degree tiles (N41/N42 × E140/E141 — the city bbox
  straddles the E140/E141 tile boundary), mosaicked with
  `gdalbuildvrt`, cropped to lon 140.35–141.35, lat 41.55–42.15 (a full
  degree of margin beyond the land area on every side this time, not a
  narrow fit).
- **Old `jphakodatetrial1`/`5m`/`10m` moved out of `source-store/`**
  (to `tmp-store/old-trial-setaside/`, not deleted) before running —
  they're a strict subset of `jphakodatecity1`'s coverage but with
  possibly-older vintage dates for the same physical meshes, which
  would've risked the same alphabetical-tie-break staleness problem
  D6 already warned about for `jpdem1a`. `source-catalog/
  jphakodatetrial1/5m/10m` themselves are untouched (still committed,
  still useful as a tiny smoke test) — only their downloaded copies in
  `pipelines/source-store/` were moved.
- **Pipeline ran clean**: 48 aggregation items (41 dirty, 7 reused
  incrementally per `write_aggregation_todos()`'s diff logic — see the
  land-only session's note on this same mechanism), no errors, disk
  stayed comfortable (216GiB → 195GiB free). 85 downsampling items, no
  errors. `bundle.py 1` → 15,320 total tiles after merge (up from
  7,589), 888MB.
- **Verified**: direct pixel decode across all 17 zoom levels (no
  out-of-range elevations; max ~1167m, plausible for southern
  Hokkaido terrain in this bigger area) plus a tile-boundary continuity
  check at two more locations (mean diff 0.25–0.32m, max 0.4–0.56m —
  quantization noise, consistent with the land-only session's
  0.07m/1.0m numbers).
- **Not yet republished.** The new build is currently only at
  `slate:.../pipelines/bundle-store/japan.pmtiles` and `scp`'d to
  `aalto`'s session-scratch `pmtiles-preview/japan.pmtiles`. Given the
  scale jump (peninsula trial → full city) is a much bigger public-
  facing change than the same-day sea-crop fix, held off on
  republishing without a fresh explicit go-ahead — matches this
  session's established per-publish-confirmation practice, not a one-
  time approval.
- **Not done this round**: no new commit on `slate` (the three new
  `source-catalog/jphakodatecity*` directories, `jphakodatetrialsea`'s
  updated Justfile/crop, and `pipelines/.gitignore` additions like
  `old-trial-setaside` handling are all uncommitted) — wasn't explicitly
  asked for this round, unlike the very first "commit the fixes"
  instruction earlier in the day.

### Next steps

- [x] **Republish the city-scale `japan.pmtiles`** — done, but not
      once: the first city build (15,320 tiles, 888MB) had a real bug
      (see D12) found by Hidenori looking at it live and sending a
      screenshot — a large rectangular hole exactly matching the
      original small trial's own footprint. Root cause: stale
      `pmtiles-store`/`tmp-store` files from this session's five-plus
      earlier pipeline runs, keyed only by tile coordinates (not run
      ID), silently reused by later runs and unconditionally globbed by
      `bundle.py`. Fixed by sweeping every prior run's cache out (moved,
      not deleted) and rebuilding from empty. Second build (13,303
      tiles, 1.42GB, 0 empty z16 tiles confirmed via direct pixel
      decode) is what's live now, as of 2026-08-09 19:45 UTC.
- [ ] Commit the new `jphakodatecity1`/`5m`/`10m` source-catalog
      entries, the sea crop update, and the `.gitignore` additions for
      `*-superseded` cache-sweep directories on `slate` — not done
      automatically this round.
- [ ] Consider whether the lon/lat bbox approximation for 函館市 needs
      refining against a real administrative boundary, especially if
      the eastern Kameda Peninsula/Esan area matters for this demo.
- [ ] Decide (with Hidenori, per D12's open question) whether the
      `pmtiles-store`/`tmp-store` staleness issue needs a real code fix
      in `hfu/mapterhorn`, or whether "sweep stale cache before every
      real rebuild" stays the accepted manual practice.
- [ ] **Sapporo + Mt. Moiwa (札幌＋藻岩山) planned as the next scoped
      build**, per Hidenori's own suggestion — a second, geographically
      different real-world test (inland/flat-plus-single-mountain,
      unlike Hakodate's peninsula/coastline character) before
      attempting all of Hokkaido. Its 1m data (mesh blocks `6440`/
      `6441`) turned out to already be extracted+converted locally on
      `aalto` (extract had already passed that Z-part earlier in the
      session) — corrected Hidenori's assumption that this needed to
      wait for `convert` to finish; ran `just sync 1` immediately
      instead and confirmed both mesh blocks are now actually published
      (4,510 + 3,515 files). Not yet scoped into a source-catalog entry
      or built — see Next steps.
- [ ] `jphokkaidodem1` (full Hokkaido) is still a separate, later task
      — not started, not blocked by anything done this session.
- [ ] Once Kyushu/Okinawa 1m downloads finish (Hidenori confirmed the
      total is 25 parts, in progress) and get synced, a corresponding
      bridge source-catalog entry will be needed.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-09 (same day, fourth session): Sapporo+Moiwa built (with a repeat of the same-filename incremental-diff bug), viewer maxPitch raised, Hokkaido/Kyushu-Okinawa sync kept deliberately separate

Hidenori confirmed the city-scale Hakodate fix looked good live in his
own browser ("函館は非常に良い感じだね！"), then asked for a second,
geographically different scoped build — Sapporo + Mt. Moiwa (札幌＋藻岩山)
— specifically to stress-test with different terrain (inland plain +
single isolated mountain, vs. Hakodate's peninsula/coastline), and
asked directly whether `jphokkaidodem1` needed updating first.

- **Answered no, and corrected a timing assumption.** `jphokkaidodem1`
  (whole Hokkaido) isn't needed for a city-scoped build — built
  `jpsapporo1`/`5m`/`10m` + `jpsapporosea` instead, same pattern as
  Hakodate. Hidenori assumed `convert` needed to finish before
  anything could sync; checked and found Sapporo's mesh blocks (`6440`/
  `6441`) were *already* extracted+converted locally (extract had
  passed that Z-part hours earlier) — ran `just sync 1` immediately
  and confirmed both blocks became actually published.
- **The Sapporo sea crop hit the exact same "crop too small" mistake
  as Hakodate's original D11 bug** (first crop's east edge ~2km short
  of `jpsapporo1`'s own real extent), expected at this point, fixed
  the same way (query the source's real bounds via its own
  `bounds.csv`, size the crop with real margin beyond that).
- **But the fix didn't take on the first try** — a *new*, more subtle
  instance of D12's root category: the replacement crop file kept the
  same filename (`sapporo_crop.tif`), and `get_aggregation_item_string()`
  diffs by CSV text only, never by the referenced raster's actual
  bytes, so the incremental system saw "no change" and silently reused
  stale output for the affected boundary. Full writeup and the general
  rule (`different filename or full wipe, always, for any in-place
  source replacement`) in `DECISIONS.md` D12's update.
- **Re-fixed via full wipe** (same technique as the original D12 fix):
  moved every prior aggregation-store run + all of `pmtiles-store`/
  `tmp-store`'s item folders aside (to newly-created `-superseded2`
  dirs, since the original `-superseded` dirs from the Hakodate fix
  were still occupying those names), forced all 94 aggregation items
  + 162 downsampling items to `.todo`, re-ran the full pipeline.
  *(Outcome — tile count, empty-tile re-verification, republish status
  — should be checked and recorded before trusting this paragraph is
  the end of the story; this entry was written while that rebuild was
  still running, at Hidenori's request ahead of a session `/clear`.)*
- **Hokkaido/Kyushu-Okinawa sync kept deliberately separate**, per
  Hidenori's explicit instruction: "北海道が終わったら上げる、九州沖縄は
  後に残す." `just extract 1 && just convert 1`'s single chained
  recipe can't be scoped to one region internally (extract processes
  every zip in `src/1z/` alphabetically — Hokkaido fully before any
  Kyushu/Okinawa — but `convert` runs as one Docker batch over
  whatever's in `src/1` when it starts, mixing both regions if
  Kyushu/Okinawa zips have already been extracted by then). Decided
  *not* to try to kill/time the extract process at the exact Hokkaido→
  Kyushu/Okinawa boundary (fragile, and extraction itself is harmless
  either way) — instead, **before running `convert`, move every
  Kyushu/Okinawa-prefixed mesh file out of `src/1` temporarily** (JIS
  mesh 1st-level codes: Hokkaido ~61xx-68xx, Kyushu/Okinawa ~36xx-51xx,
  cleanly non-overlapping — confirm this range empirically once real
  Kyushu/Okinawa mesh filenames exist locally, this was reasoned from
  the JIS mesh formula, not yet verified against a real extracted
  filename), run `convert`+`sync` for Hokkaido only, then move the
  Kyushu/Okinawa files back into `src/1` for later. **Not yet executed
  as of this entry** — Hokkaido's extract was still on `Z045`/`46` when
  this was written; see Next steps.
- **GitHub Pages viewer**: confirmed `style.json` points directly at
  `https://data.source.coop/smartmaps/mapterhorn-japan-bridge/japan.pmtiles`
  — the same key this whole session has been repeatedly republishing
  to — so the live site (`https://hfu.github.io/mapterhorn-japan-bridge/`)
  auto-reflects every republish with no separate deploy step needed.
  Raised `app.js`'s `maxPitch` from MapLibre's default (60) to 85 (its
  real internal cap) per Hidenori's request/memory — verified via a
  local static-file preview (`python -m http.server`, checked
  `map.getMaxPitch()`/`setPitch(85)` directly in-browser, both correct)
  before this session's `/clear`.
- **Disk hygiene, not yet done**: today's repeated rebuild-and-sweep
  cycle (this session's own established D12 remediation pattern) has
  accumulated roughly **91GB of superseded/backup directories**
  (`tmp-store-superseded` 49GB + `tmp-store-superseded2` 38GB +
  `pmtiles-store-superseded` 998MB + `pmtiles-store-superseded2` 1.7GB
  + `aggregation-store-superseded` 2.5MB) on top of real output, on a
  disk that started today at 217GiB free and is now around 130GiB
  free. Hidenori explicitly authorized deleting these if space gets
  tight — not yet acted on, should be swept once the Sapporo rebuild's
  outcome is confirmed good (don't delete a backup you might still
  need mid-investigation).
- **Apple hardware, if buying new** (Hidenori asked for a rough,
  reasoning-grounded spec ahead of `/clear` — not a purchase decision,
  just captured for later reference): today's actual bottlenecks were
  (1) `aalto`'s external spinning USB HDD during `extract` — by far the
  single biggest time cost of the day (single ~2GB zip: 20-44 minutes,
  wildly variable, confirmed via direct `iostat` reads of ~0.3-2MB/s
  effective throughput on `disk4`), entirely a storage-hardware problem,
  not something GSI's own throttling causes; (2) `slate`'s
  `AGGREGATION_WORKERS`/`DOWNSAMPLING_WORKERS`/`BUNDLE_WORKERS` capped
  at 4 ("half of typical 8-core hardware" per the code's own comment)
  despite `slate`'s M4 handling the actual GDAL work well — more cores
  would let this scale up directly; (3) today's modest 2-city scope
  already produced ~91GB of intermediate/backup cruft, and this
  project's real target (national-scale Japan coverage) would need
  proportionally much more headroom. Rough recommendation: **one
  machine replacing both `aalto` and `slate`'s roles** — Mac Studio
  (sustained multi-hour thermal headroom, unlike mini/laptop under
  hours of continuous GDAL batch work) with M4 Max, 64GB+ unified
  memory (lets worker counts scale well past today's 4-worker cap),
  and 4TB+ **internal** SSD (eliminates the HDD bottleneck entirely —
  this single change likely would have cut today's `aalto`-side wall-
  clock time by more than half). GSI's own download-side throttling
  (session/account-bound, confirmed server-side, not connection-count-
  bound) is **not** solvable by better hardware at all — no spec bump
  fixes that half of the pipeline.

### Next steps

- [ ] **Check the Sapporo rebuild's actual outcome** (aggregation →
      downsampling → bundle → merge → direct-pixel-decode verify,
      specifically re-checking the same x58546-58559/y24048-24111 z16
      range for emptiness) before doing anything else with
      `japan.pmtiles` — this entry was written mid-rebuild.
- [ ] Get Hidenori's go-ahead and republish the Sapporo+Hakodate
      combined build once verified clean.
- [ ] Execute the Hokkaido-only convert+sync plan above: once
      Hokkaido's extract (`Z046`) finishes, move Kyushu/Okinawa-
      prefixed mesh files (confirm the exact 1st-level mesh code range
      empirically first) out of `src/1`, run `just convert 1` +
      `just sync 1` for Hokkaido only, then move Kyushu/Okinawa's files
      back for later.
- [ ] Sweep the ~91GB of `*-superseded*` directories on `slate` once
      the Sapporo rebuild is confirmed good (Hidenori has already
      authorized this).
- [ ] Commit the new `jphakodatecity1`/`5m`/`10m`/`jpsapporo1`/`5m`/
      `10m`/`jpsapporosea` source-catalog entries and pipeline changes
      on `slate` — still not done automatically.
- [ ] Once Kyushu/Okinawa 1m downloads finish (25 parts total,
      Hidenori was around part 17 when this was written) and get
      synced, a corresponding bridge source-catalog entry will be
      needed.
- [ ] `jphokkaidodem1` (full Hokkaido) is still a separate, later task.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-10: Storage crisis resolved (1.3TB freed on `slate`), D12's tmp-store/pmtiles-store regressions fixed at the code level, Shakotan+Kamui+Otaru build validates the fix live

The Sapporo-inclusive `japan.pmtiles` from the previous entry **did
publish successfully** (a first `aws s3 cp` attempt failed at
1.8/1.9GiB with a transient Cloudflare 520 on `UploadPart`; a retry
completed clean). It is now live at
`s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`.

- **Disk space**: `slate` was down to 71GiB free (started the day at
  217GiB). Swept the ~91GB of `*-superseded*` dirs (pre-authorized,
  §previous entry) → 161GiB. Then found and deleted two large stale
  checkouts unrelated to this project but sitting on the same disk:
  `github/japan-geotiff-dem` (366GB, a ~2.5-month-old clone, `git
  status` clean, spot-checked 6 random `dst/1` files byte-identical to
  `s3://smartmaps/japan-geotiff-dem` — fully redundant) and
  `github/IMAGERY` (854GB: `pmtiles/seamlessphoto512.pmtiles`, 715GB,
  confirmed byte-size-identical to the published copy at
  `s3://smartmaps/japan-seamlessphoto/pmtiles/`; `z18-east.mbtiles`,
  139GB, confirmed **broken** — a `.aria2` partial-download control
  file proves it never finished, and a completed `z18.pmtiles`,
  392GB, already exists on SC). Both deletions confirmed with Hidenori
  first. Net result: **71GiB → 1.3TiB free**. `terrain2021`,
  `bvmap-overdrive`, `amx-26`, `hfu/kanto` flagged as *unverified*
  future candidates if space is ever tight again — do **not** touch
  `fusi` or `shin-freetown`, both plausibly still relevant to this
  effort's own dependency chain.

- **D12's "open question" — actually fixed, not just root-caused.**
  Traced the global, uncleaned `tmp-store/{item}` layout to upstream
  commit `6cdf66b` (PR #277, "Add Manager/Worker") — a single commit
  that simultaneously (a) moved `tmp_folder` off its previous
  per-`aggregation_id` scoping onto a flat `tmp-store/{item}` path,
  and (b) commented out `shutil.rmtree(tmp_folder)`. Both are
  regressions, not deliberate design (confirmed by reading the diff:
  the old code was already correctly scoped+cleaned). Fixed in
  `aggregation_run.py` on `slate`: `tmp_folder` is now
  `tmp-store/{aggregation_id}/{item}` (derived from `filepath`) and
  `rmtree` runs after all three stages succeed. `downsampling_run.py`
  was never affected (FORK_NOTES.md: this fork deliberately kept its
  own version, already scoped+cleaned).

  Separately fixed the actual downstream mechanism D12 called "the
  real corruption vector" — `bundle.py`'s unconditional
  `glob('pmtiles-store/*.pmtiles' + '*/*.pmtiles')` picking up stale
  same-position files from earlier runs under a different `child_z`.
  Rather than touch `bundle.py` (its folder-per-z7-parent bucketing
  means a folder legitimately holds many unrelated macrotiles — a
  folder-wide clean would be wrong), fixed it at the source in
  `aggregation_tile.py`: before writing `{z}-{x}-{y}-{child_z}.pmtiles`,
  delete any other `{z}-{x}-{y}-*.pmtiles` in that same output folder
  (exact z-x-y match, so sibling macrotiles sharing the folder are
  untouched). Also deleted `full_rerun.py`/`retile_terrarium.py`,
  today's untracked ad-hoc D12-remediation scripts — both assumed the
  old flat `tmp-store/{item}` path and would misbehave against the new
  scoped layout; today's incident they were written for is resolved.

  **Live validation**: mid-run on the Shakotan build below, the new
  `tmp-store/{aggregation_id}/` folder held exactly 4 subfolders
  (matching `AGGREGATION_WORKERS=4`) while 12 of 26 items had already
  completed — confirming completed items really do get cleaned up
  immediately, not just "eventually." The 90-folder/~59GB of orphaned
  pre-fix tmp-store cruft from today's earlier runs is untouched (it's
  static, not growing) — sweep once this run's outcome is confirmed
  good, same caution as always about not deleting a live investigation.

- **Built `jpshakotan1`/`5m`/`10m`** (Otaru + Cape Kamui + Cape
  Shakotan, 小樽市＋神威岬＋積丹岬) as a **deliberate code-validation
  test**, explicitly *not* waiting for the fresh Hokkaido
  DEM1A-20260616 data to land on Source Cooperative first — Hidenori's
  call: use whatever's on SC right now, same as `jpsapporo1` did, since
  the point is exercising the new aggregation code path, not producing
  final-quality coverage. Scope: lon 140.45-141.05, lat 43.15-43.45,
  spanning 1st-level mesh blocks 6440 (R5-7/C3-7), 6441 (R5-7/C0,
  disjoint from `jpsapporo1`'s own R3-5/C2-4 in the same 1st-mesh),
  6540 (R0-1/C3-7, mostly sea — expect a sea-crop follow-up like
  Hakodate/Sapporo needed), 6541 (R0-1/C0). R/C computed from real
  lat/lon via the JIS mesh formula, not guessed.

  **Found a new, general-purpose issue while building the file list**:
  SC's `japan-geotiff-dem` bucket has files at the *same* mesh position
  published under *multiple* survey dates (additive-only `sync` never
  removes old ones) — 813 duplicate positions in the raw 4-mesh
  listing, 257 of them inside Shakotan's actual R/C-filtered scope.
  Deduplicated by keeping only the newest date per position, then
  **spot-verified this is safe**: downloaded 3 duplicate pairs,
  compared via `gdalinfo -stats` — both old and new were 100% valid
  (no nodata), identical bounds/size, elevation values differing by
  <1m (normal resurvey variance, not missing data or corruption). The
  "newest wins" rule is confirmed safe for this dataset. **Open,
  unverified**: `jpsapporo1`'s and `jphakodatecity1`'s own
  `file_list.txt`s predate this dedup logic and may have the same
  latent issue — never checked.

- **Kyushu/Okinawa on `aalto`**: all 25 parts finished downloading.
  The already-running `just extract 1 && just convert 1` chain
  snapshotted its file list before all 25 zips existed in `src/1z` —
  it only covers `Z001`-`Z009`; `Z010`-`Z025` will need a **separate**
  future `just extract 1` invocation. A background sweeper
  (`/tmp/kyushu_sweep.sh`) continuously moves Kyushu/Okinawa-prefixed
  mesh files (confirmed empirically: `FG-GML-39xx`-`51xx`, vs.
  Hokkaido's `FG-GML-67xx`/`68xx`) out of `src/1` into
  `src/1-kyushu-okinawa-holding/` so the auto-triggered `just convert 1`
  only ever sees Hokkaido. As of this writing: extraction is still
  working through the original 9-zip queue, currently on `Z002`,
  exceptionally slow (6+ hours on this single zip — likely disk
  contention from Hidenori's own concurrent file-move operations, not
  a new problem). No `convert`/`dst/1` output yet. A monitor script had
  a self-matching `pgrep -f` bug (its own source text matched its own
  search pattern, firing false "convert started/finished" pairs) —
  fixed by switching to `docker ps`-based detection and `pgrep -x
  unzip`, both immune to self-matching.

- **Session handoff**: Hidenori is now in a ~10-hour fully autonomous
  window (his explicit instruction). Established boundary for that
  window: routine pipeline work (aggregation/downsampling/bundle,
  building source-catalog entries, `japan-geotiff-dem`'s own routine
  `sync` to its SC bucket) proceeds without asking. The **final**
  bridge `japan.pmtiles` publish to
  `s3://smartmaps/mapterhorn-japan-bridge` and any `git push` still
  require his explicit go-ahead on return — this session's established
  practice, not relaxed by the autonomous window. Also: he's at ~40%
  of his weekly Claude credit allowance (resets Friday morning) and
  asked for efficient, not paranoid, usage through Thursday — this is
  an "operations" phase, not heavy development, so credit exhaustion
  isn't a real worry, just don't be wasteful (e.g. the background-poll
  vs. Monitor-notification distinction matters here).

- **Update, same autonomous window — Shakotan build finished and
  verified; the tmp-store comparison is in; found and fixed a second
  instance of the duplicate-survey-date bug.** Aggregation finished
  26/26 clean; the new `tmp-store/{aggregation_id}/` folder ended at
  **0 bytes** once all items completed — vs. the ~59GB left behind by
  today's earlier pre-fix runs for a comparable scope. That's the
  quantified answer to Hidenori's "how much does storage churn
  improve" question: net tmp-store growth went from unbounded to
  zero. `bundle.py 1` + a new ad-hoc `merge_japan_bundles.py` (not
  checked in, same convention as `merge_bundles.py` — glob
  `bundle-store/*.pmtiles` **excluding** the existing `japan.pmtiles`
  itself, which is a bundle-store output, not an input; merging it
  into itself would self-reference) produced a fresh `japan.pmtiles`,
  33,861 tiles. Verified: no out-of-range elevations (-15.9 to
  1323.5m); 3,509 of 24,576 z16 tiles empty. Investigated the empty
  ones specifically — a naive check against the old build's z16
  bounding *rectangle* found 335 "inside" it, which looked alarming
  (a regression into previously-clean Hakodate/Sapporo territory) —
  but converting those tile coordinates to lat/lon showed they're all
  in **Otaru** (43.07-43.20°N, ~141.04°E), which was never actually
  covered by Sapporo's real polygon (only within Sapporo's
  *bounding-box* by coincidence). All 3,509 empty tiles trace a
  coastline from Cape Shakotan through Cape Kamui to Otaru — consistent
  with mesh 6540's already-known sparse land coverage (5 files at 1m),
  not a regression. Acceptable for this build's stated purpose
  (code validation); a real sea-crop entry (`jpshakotansea`, same
  pattern as `jphakodatetrialsea`/`jpsapporosea`) would be needed for
  production quality, deferred to the eventual full rebuild.

  Also checked `jpsapporo*`/`jphakodatecity*` for the same
  multi-survey-date duplication found in Shakotan's raw listing:
  `jpsapporo1`/`5m`/`10m` were **clean** (0 duplicates). `jphakodatecity1`
  had **27 duplicate positions** (older date `20250507` vs. newer
  `20260603` — note this newer date is *not* part of today's
  Hokkaido-wide `20260616` refresh, it's a separate, earlier,
  Hakodate-specific update that was apparently never fully reflected).
  Fixed `jphakodatecity1/file_list.txt` in place (1,114 → 1,087,
  newest-date-wins, same logic as Shakotan's). This doesn't retroactively
  fix `source-store/jphakodatecity1`'s already-downloaded files or the
  currently-live `japan.pmtiles` — it just means the *next* full rebuild
  will get it right. `jphakodatecity5m`/`10m` were clean.

  Swept the 90-folder/~59GB of pre-fix `tmp-store` cruft (plain
  z-x-y-maxzoom-named orphaned item folders, unambiguous). Left four
  small (~270MB total) explicitly-named folders alone
  (`old-trial-setaside`, `sapporo-sea-raw-tiles`,
  `sea-crop-v1-superseded`, `sea-crop-v2-superseded`) — negligible size,
  possibly still useful for the deferred Hakodate/Sapporo sea-crop
  investigation, not worth the small risk given space is no longer
  tight.

### Next steps (superseded — see the same-day follow-up entry below)

## 2026-08-10 (same day, follow-up): `aalto`'s HDD crisis forced a migration to `slate` for GeoTIFF conversion; headless Source Cooperative login solved via SSH tunnel; end-to-end pipeline speed validated

**This entry is mostly about `japan-geotiff-dem`, not this repo's own
pipeline** — full diagnostic detail lives in that repo's own
`HANDOVER.md`/`DECISIONS.md` (D11) 2026-08-10 entries; this is a
summary plus what it means for the bridge effort specifically. Don't
duplicate the full diagnostic narrative here if resuming — read it
there.

- **`aalto`'s external HDD degraded badly enough today to block work
  outright** (a plain `ls` timing out at 120s, a `docker run` sitting
  at 0% CPU for minutes). Root-caused via single-file-stat-vs-glob
  testing and a controlled single-process re-test (~1.3 files/sec even
  fully alone) — the drive's raw read bandwidth is the ceiling, not
  fixable by this project's own code. A plausible optimization (fewer,
  larger transferred files) was tested and made no measurable
  difference — don't assume, measure.
- **Moved GeoTIFF conversion to `slate`**, using **colima** (not
  Docker Desktop — `slate` is headless/SSH-only, colima is CLI-only
  end to end, Apple Virtualization.framework backend). Two real
  gotchas hit and fixed: colima doesn't mount volumes outside its
  default scope unless told to (`--mount /Volumes/Migrate-2025-04:w`,
  otherwise bind-mounts silently resolve to empty directories, no
  error); a stray leftover `credsStore: "desktop"` in
  `~/.docker/config.json` (from a prior incomplete Docker.app install)
  broke `docker pull` until removed. Once fixed: a 5-file smoke test
  converted in **26 seconds** (vs. indefinite stall on `aalto`).
- **A genuinely fast data path was found, not engineered**: 10
  Kyushu/Okinawa region-pack zips (`Z010`-`Z019`, ~20.7GB) were still
  sitting in `/Users/hfu/Downloads` on `aalto`'s **internal** boot SSD
  — never moved to the slow external volume. Transferring these
  directly to `slate` averaged 6.57MB/s (vs. 0.5-2MB/s from the
  external HDD) — a real, measured win, because it changed the actual
  bottleneck (source disk), unlike the file-count experiment above.
  Verified byte-identical before deleting the `Downloads` copies.
  **Lesson for this project generally**: check whether a fast-storage
  copy of needed data already exists before assuming everything must
  flow through wherever it originally landed.
- **`slate` now has its own working `source-coop`/`aws` credentials**,
  set up despite being headless and despite `brew install
  source-coop` failing there (outdated Command Line Tools, full OS
  update not attempted — too disruptive). Worked around by copying
  `aalto`'s already-built binary directly (same architecture, no
  toolchain needed) and completing `source-coop login`'s OAuth
  loopback flow via **SSH local port forwarding**
  (`ssh -L 8484:localhost:8484 slate.local`) plus opening the auth URL
  in a browser on `aalto` — no remote desktop/VNC needed. **Claude set
  up the tunnel and opened the URL; Hidenori completed the actual
  login himself**, consistent with this project's standing
  human-only-authentication rule. This means `slate` can now publish
  to Source Cooperative directly for `japan-geotiff-dem`'s own bucket,
  no longer strictly dependent on routing through `aalto` for that —
  worth revisiting the four-way-split table in `CLAUDE.md` once the
  dust settles on whether this is permanent.
- **Near-miss**: re-running `source-coop login` with `-v` to see the
  auth URL also logged the live temporary AWS credentials in
  plaintext. Deleted the log immediately (short-lived token, low
  impact) — but this generalizes the existing `source-coop creds`
  warning to *any* verbose/debug flag on credential-handling CLIs, not
  just the obviously-named subcommand. Worth remembering next time
  `-v` gets reached for on any auth-adjacent tool.
- **Built a throwaway end-to-end speed-validation source-catalog
  entry, `jpkyushutest1`**, on `slate` — whatever Kyushu/Okinawa 1m
  output happened to be converted+synced at the time (not
  geographically scoped, not meant to produce real coverage), purely
  to exercise `source_download.py` → `source_bounds.py` →
  `source_polygonize.py` → aggregation → downsampling → bundle on
  `slate`'s new setup before trusting it for real work.
  `source_download.py` (1,871 files) completed; **aggregation/
  downsampling/bundle/verify for this entry were not reached before
  this entry was written** — pick up there if resuming, or just delete
  `jpkyushutest1` from `source-catalog`/`source-store` if the
  real Hokkaido/Shakotan-rebuild work has since made it irrelevant (it
  was never meant to produce lasting coverage).

### Current state (updated 2026-08-10, this entry)

- `japan.pmtiles` on S3: still the verified Sapporo-inclusive
  20,418-tile build from earlier today — unchanged by anything in this
  entry.
- `hfu-mapterhorn` on `slate`: committed locally (`27815e5`, includes
  the tmp-store/pmtiles-store fixes, all real source-catalog entries
  through `jpshakotan*`) — **not pushed**. `jpkyushutest1` (throwaway,
  see above) was added *after* that commit, still uncommitted — fine
  to leave uncommitted or discard, it's not meant to last.
- `japan-geotiff-dem` now effectively runs on **two machines** —
  `aalto` (original, HDD-bottlenecked, still has an in-flight
  `src/1`→`slate` rsync for Hokkaido's remaining backlog) and `slate`
  (new, fast, handling Kyushu/Okinawa `Z010`-`Z019` incrementally plus
  ready to take on more). Kyushu/Okinawa `Z020`-`Z025`'s location
  (fast `Downloads` shortcut vs. slow external-HDD path) was **not
  checked** before this entry was written — check `/Users/hfu/Downloads`
  for `FG-GML-kyushu*Z02*` first before assuming the slow path.
  `Z001`-`Z009` are confirmed only on the slow path (already moved off
  `Downloads` before today).
- Disk cleanup / D12 fixes / Shakotan build / `jphakodatecity1` dedup
  fix: all still as described in the entry above this one — unchanged.

### Next steps

- [ ] Check Kyushu/Okinawa `Z020`-`Z025`'s actual location before
      choosing a transfer path (see above).
- [ ] Let the `aalto`→`slate` Hokkaido `src/1` transfer keep running
      (slow, HDD-bound, no further optimization available — just
      time). Once it lands, `slate` can run `convert`+`sync` for
      Hokkaido directly (already proven fast).
- [ ] Decide (or finish) `jpkyushutest1`'s fate — either carry it
      through to a bundled+verified test `pmtiles` to fully validate
      `slate`'s pipeline end to end, or delete it once real work
      (Hokkaido/Kyushu source-catalog entries, the Hakodate/Sapporo/
      Shakotan rebuild) makes it redundant.
- [ ] Once Hokkaido's fresh `dst/1` is synced (to either machine's
      `japan-geotiff-dem` publish target — same bucket either way),
      check empirically whether Hakodate's/Sapporo's own mesh
      positions actually changed vs. their current builds; if so,
      rebuild Hakodate+Sapporo+Shakotan **together** from a full wipe,
      per Hidenori's explicit instruction (wants confidence the
      uploaded 1m DEM is definitely the data in use).
- [ ] Commit+push `slate`'s `27815e5` and any later real (non-test)
      changes; push the bridge viewer's `maxPitch` change. Still
      requires Hidenori's go-ahead for the push step specifically
      (git push wasn't blanket-approved even during the autonomous
      window).
- [ ] `jphokkaidodem1` (full Hokkaido) — disk space is no longer the
      blocker on `slate` (1.3TB+ free), but the *real* blocker now is
      just getting Hokkaido's raw data off `aalto`'s slow drive at
      all. Revisit once that transfer finishes.
- [ ] Standing decision point, not resolved: is `slate` now the
      permanent home for `japan-geotiff-dem`'s pipeline, or a one-time
      rescue for today's backlog? See that repo's own DECISIONS.md D11.
      Affects whether `aalto`'s HDD needs replacing or the whole
      machine's role should be reconsidered.
- [ ] Task #8 from this session's own tracking (not yet started):
      set up a persistent `scheduled-tasks` (not `CronCreate` — that's
      session-only and dies with `/clear`) for Hidenori's week away
      starting Friday. Revisit around Wednesday per his own timeline.

## 2026-08-10 (same day, second follow-up): 1z-level transfer tally; new goal — retire `aalto`'s HDD entirely by Thursday; Kyushu/Okinawa sync automated

Quick addendum, written as context filled up — see the follow-up entry
above for full detail on the `slate` migration itself.

- **1z (region-pack) level transfer tally, exact counts**: Hokkaido
  46 total, **0 confirmed landed on `slate`** (Z001 is byte-complete
  in a temp file — `.FG-GML-hokkaido-DEM1-20260616-Z001.zip.<rand>`,
  exact size match with `aalto`'s source — but sat un-renamed for
  20+ min, i.e. still mid-rsync-finalization, not yet a real file).
  Kyushu/Okinawa 25 total, **10 landed** (`Z010`-`Z019`, via the fast
  `Downloads` path). **Combined: 10/71 ≈ 14%** — matches Hidenori's
  own ~10% guess closely enough to act on his stated plan: proceed
  with extract/convert/sync/aggregation on what's landed, let the rest
  keep transferring in the background.
- **New explicit goal from Hidenori**: retire `aalto`'s external HDD
  entirely by Thursday — physically disconnect it, with `slate` doing
  100% of `japan-geotiff-dem`'s work by then. This reframes "finish
  the migration" from a nice-to-have into the actual target. Honest
  assessment given today's measured rates (~0.5-1MB/s average,
  fluctuating, occasionally stalling to ~0): remaining ~120GB (46
  Hokkaido + 15 Kyushu/Okinawa region packs `aalto` still uniquely
  holds) extrapolates to roughly 33-65+ hours of pure transfer time.
  **No further speedup lever is known to exist** — contention removal,
  file-count reduction, and the fast-storage shortcut have all already
  been tried/exhausted (see the DECISIONS.md D11 / HANDOVER.md
  diagnostic trail). The only remaining action is to keep the
  `aalto`→`slate` rsync running continuously and check back — this is
  now a "wait it out" situation, not a solvable-by-more-engineering
  one, unless a hardware swap for `aalto`'s drive happens first.
- **Kyushu/Okinawa's incremental loop on `slate` now includes `sync`**
  (previously just `extract`+`convert`) — re-armed as monitor task
  (background, 3-min cadence, runs `just extract 1 && just convert 1
  && just sync 1` in `japan-geotiff-dem-kyushu`, all idempotent/safe
  to overlap). A one-off manual `extract`+`convert` pass over all 10
  currently-landed Kyushu region packs was also kicked off directly
  (background) to catch up faster than waiting for the next 3-min
  tick — **this may run concurrently with the loop's own next
  iteration**; harmless (idempotent skip-checks on both sides,
  `docker run --rm` containers don't share state), just don't be
  confused if two `convert` containers appear briefly at once.
- As of the last check before this entry: Kyushu/Okinawa `dst/1` on
  `slate` had 5,007 tifs across 215 extracted mesh zips (all 10 region
  packs extracted, conversion still catching up) and was actively
  syncing to `s3://smartmaps/japan-geotiff-dem/1/`.
- **Still not done**: building a real (non-throwaway) bridge
  source-catalog entry for this growing Kyushu/Okinawa coverage and
  carrying it through aggregation→downsampling→bundle→verify. Either
  repurpose `jpkyushutest1` (built earlier today, was meant as
  throwaway but there's no strong reason not to let it become the real
  entry — its `file_list.txt` just needs refreshing against
  whatever's newly synced) or start a fresh, properly-named entry.
  **Not yet decided or started** — pick this up next.

### Next steps (current, supersedes earlier lists in this file)

- [ ] Keep the `aalto`→`slate` Hokkaido region-pack rsync running;
      check back periodically (hours-scale, not minutes) rather than
      polling — there is no known way to speed it up further.
- [ ] Once more Hokkaido/Kyushu region packs land, keep letting the
      incremental `slate` loop (extract+convert+sync) absorb them —
      it's already running unattended.
- [ ] Decide `jpkyushutest1`'s fate (repurpose as the real Kyushu
      entry vs. delete and start fresh) and carry it through
      aggregation→downsampling→bundle→verify — this is the actual
      "build real PMTiles from what's landed" work Hidenori asked for
      and it has not been started yet.
- [ ] Once Hokkaido's `dst/1` is far enough along and synced, revisit
      the Hakodate/Sapporo/Shakotan full-rebuild decision (see prior
      entries).
- [ ] Commit+push `slate`'s `27815e5` and later real changes; push the
      `maxPitch` viewer change — go-ahead needed for the push itself.
- [ ] Task #8: persistent `scheduled-tasks` setup for Hidenori's week
      away — revisit around Wednesday, not urgent yet.
- [ ] Once `aalto`'s HDD is fully drained and detached (the Thursday
      goal), update `japan-geotiff-dem/CLAUDE.md` and this repo's own
      `CLAUDE.md` four-way-split table to describe `slate` as
      `japan-geotiff-dem`'s primary/sole machine — currently still
      describes `aalto` that way, now stale.

## 2026-08-11: `aalto`'s external HDD failed outright; Hokkaido frozen, Kyushu/Okinawa-only going forward; `slate` becomes this repo's sole machine too

Picked up from the previous entry's resume prompt (now superseded —
see below). The Thursday "retire `aalto`'s HDD" goal was overtaken by
events: the drive didn't get gracefully retired, it failed outright.

### The drive failure

Full diagnostic trail lives in `japan-geotiff-dem`'s own `HANDOVER.md`
2026-08-11 entry — this is the summary relevant to this repo. What
started this session as "restart the stalled `aalto`→`slate` rsync"
(per the prior resume prompt) escalated through: the Hokkaido rsync
found genuinely hung (~50 minutes, zero byte progress, byte-complete
temp file never finalized) → restarted with `--partial` → real
progress resumed → `diskutil unmount`/`unmountDisk force` both
hung/timed out when checking drive health → a physical USB
unplug/replug (at Hidenori's own suggestion) recovered metadata
operations (`ls`/`stat`) but not bulk reads → `fsck_hfs -nl` (after
working through a `sudo`/Full-Disk-Access permission chain) came back
clean, "The volume github appears to be OK" → bulk reads still hung
even so → a full system restart of `aalto` → still hung → a full power
cycle of the drive itself (at Hidenori's suggestion, since the drive
turned out to have its own power supply, not bus-powered) → **still
hung**. A 61-file rescue-copy script (per-file timeout, skip-on-stuck,
targeting the 46 missing Hokkaido zips + 15 missing Kyushu/Okinawa
zips) recovered **0 of 61 files** — the first several attempts got
real `Input/output error` responses, and every file after that failed
even a `stat()` call, indicating the drive degraded further simply
from being under access load during the rescue attempt.

Hidenori's own framing, worth keeping as this project's canonical
account of the incident: a ~2019-vintage backup HDD, spun up for
sustained real load for the first time in ~7 years, failing under
exactly that load — "古びたHDDは、このように壊れる" (this is how an
aged HDD fails) — treated as a useful case study, not a mystery worth
further forensic effort.

Also explored, separately, whether `slate` could log into GSI's own
基盤地図情報 download portal directly (to bypass `aalto` for future
downloads entirely) — found it uses a popup-window-based login
(`service-login.gsi.go.jp`, plain ID/password form, not an OAuth
loopback like Source Cooperative's), blocked by this session's browser
tooling's popup restriction. Abandoned as not worth pursuing further
after Hidenori's own recovery-scope decision below made it moot —
Kyushu/Okinawa's remaining downloads aren't being pursued this round
either.

**Consequence: the 46 Hokkaido region-pack zips and the 15
not-yet-transferred Kyushu/Okinawa region-pack zips (`Z001`-`Z009`,
`Z020`-`Z025`) are lost.** Only the 10 Kyushu/Okinawa parts
(`Z010`-`Z019`) that had already reached `slate` via the
2026-08-09/10 `Downloads`-folder fast path survive.

### Recovery decision (Hidenori)

- **Hokkaido is frozen**, deliberately, not abandoned — Hidenori's own
  analogy: "足利尊氏の九州行きのようなもの" (a deliberate strategic
  narrowing, implying a later return). `jphokkaidodem1` in
  `source-catalog/` stays exactly as-is (stale `file_list.txt`, never
  aggregated) until a fresh decision to resume it.
- **Kyushu/Okinawa is the sole focus**, best-effort, no hard deadline
  — proceed as far as available time allows using the 10 already-
  landed region packs.
- **`slate` becomes the sole machine for both `japan-geotiff-dem` and
  this repo's own pipeline going forward** — no longer "primary among
  two," `aalto`'s copies of both repos are being retired. See
  `japan-geotiff-dem`'s own `HANDOVER.md`/`DECISIONS.md` D12 for that
  repo's side of this same decision.

### This repo's own git-history gap, and its recovery

Same exposure as `japan-geotiff-dem`: this repo's git history on
GitHub stopped at `54fec23a` (2026-08-08, "Add CLAUDE.md, DECISIONS.md,
HANDOVER.md"). `aalto`'s local working copy had gone one commit further
(`75146aa`, "Document session: viewer resolved, elevation pipeline
fully root-caused") plus uncommitted working-tree changes to
`DECISIONS.md`/`HANDOVER.md`/`app.js` (the `maxPitch` viewer change) —
none of it ever pushed, all of it now unreachable from the failed
drive.

**Unlike `japan-geotiff-dem`, this repo's 2026-08-09/2026-08-10 session
history is a faithful, complete recovery, not a reconstruction** — the
full `HANDOVER.md` (all four 2026-08-09 entries and the two 2026-08-10
entries) and `DECISIONS.md` (D11, D12) were read in full earlier in
*this same session*, before `aalto`'s drive failed, and are reproduced
verbatim above/below rather than summarized from cross-references.
`app.js`'s `maxPitch: 85` change (previously verified working via a
local static-file preview, per the 2026-08-09 fourth-session entry
above) has also been reapplied.

- **Re-cloned fresh from GitHub onto `slate`**
  (`/Volumes/Migrate-2025-04/github/mapterhorn-japan-bridge`) using
  `gh repo clone` after re-authenticating `gh` there (device-code flow
  — `gh auth login --hostname github.com --git-protocol https --web`,
  no SSH-tunnel/loopback needed, unlike `source-coop login`'s OAuth
  flow; Hidenori completed the authorization himself, same
  human-only-auth convention as always). `gh auth setup-git` was
  needed afterward to actually make `git push` work (a bare
  `gh auth login` alone left `git push` failing with `could not read
  Username` / a stale macOS keychain credential-helper error).
- This file and `DECISIONS.md` were then brought back up to date (this
  entry, plus D11/D12 below) and pushed.

### Next steps

- [ ] `jphokkaidodem1` stays frozen — do not resume without an
      explicit fresh decision (see `japan-geotiff-dem`'s parallel
      note).
- [ ] Kyushu/Okinawa: continue building real bridge coverage from the
      10 surviving region packs (`Z010`-`Z019`) — see
      `japan-geotiff-dem`'s own `HANDOVER.md`/`CLAUDE.md` for that
      pipeline's current download/convert/sync state and ETA.
      `jpkyushutest1` (this repo depends on `hfu/mapterhorn`'s
      source-catalog, a separate repo — not covered by this file)
      is the relevant source-catalog entry, repurposed from throwaway
      to real per the 2026-08-10 second-follow-up entry's own framing.
- [ ] Republish `japan.pmtiles` only with Hidenori's explicit go-ahead,
      as always — nothing has changed about that standing rule.
- [ ] Push the `maxPitch: 85` `app.js` change (done as part of this
      same recovery commit) and confirm it's live on
      `hfu.github.io/mapterhorn-japan-bridge/`.
- [ ] Once Kyushu/Okinawa work concludes (or stalls out for lack of
      remaining region packs), revisit whether Hokkaido should be
      resumed — starts from zero on raw data either way (see
      `japan-geotiff-dem`'s own next steps).
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## 2026-08-12: overnight Kyushu/Okinawa sample-PMTiles pipeline launched unattended; Hokkaido-region source-store entries parked (to become permanent); slate hygiene incidents (stray grep, low free memory)

Kicked off, unattended, once `jpkyushutest1`/`jpkyushutest5m`
downloads (in progress since the prior session) finished: a single
`nohup`+`disown`'d shell script on `slate`
(`/tmp/kyushu_pmtiles_pipeline.sh`, log at
`/tmp/kyushu-pmtiles-pipeline.log`) chains `source_bounds.py` →
`source_polygonize.py` (4 processes) → `aggregation_covering.py` →
`AGGREGATION_WORKERS=4 aggregation_run.py` →
`downsampling_covering.py` → `DOWNSAMPLING_WORKERS=4
downsampling_run.py` → `bundle.py 1`, for `jpkyushutest1`/`5m`/`10m`
only. **Deliberately stops after `bundle.py`** — does not merge into
`japan.pmtiles` or upload, per this repo's standing "never publish
without Hidenori's explicit go-ahead" rule. The `aggregation_covering.py`
item-count checkpoint that would normally warrant a human look (this
is unprecedented scale for this project) was knowingly skipped since
the run is unattended overnight — Hidenori explicitly authorized
proceeding best-effort rather than blocking on that checkpoint.

**Found and worked around a real scoping bug before it could
contaminate tonight's output**: `aggregation_covering.py` globs *every*
`source-store/*/bounds.csv` unconditionally (no source-selection flag
exists — confirmed by reading the code). `source-store/` still held
`bounds.csv` for the old Hokkaido-city entries
(`jphakodatecity1`/`5m`/`10m`, `jphakodatetrialsea`,
`jpsapporo1`/`5m`/`10m`/`sea`, `jpshakotan1`/`5m`/`10m`) from earlier
work — left in as-is, tonight's "Kyushu/Okinawa only" build would have
silently merged in stale Hokkaido-city data. **Parked all 11 entries**
(moved to `source-store-hokkaido-parked/`) before the pipeline reached
`aggregation_covering.py`; the script's own tail restores them to
`source-store/` after `bundle.py` completes.

**Decided (Hidenori) not to interrupt the in-flight run to change this
parking logic, but to make the parking permanent going forward**: once
tonight's script finishes and restores the 11 entries, re-park them
(this time for good, not temporarily) — Hokkaido's `hfu-mapterhorn`
source-catalog entries have no near-term use anyway, since Hokkaido's
GeoTIFF redo (46 region-packs, re-extract, re-convert, re-sync — see
`japan-geotiff-dem`'s own `HANDOVER.md`, started today) needs to reach
Source Cooperative before a fresh Hokkaido `source_download.py` run
would even have new data to fetch. This removes the need for
park/restore bookkeeping on every future Kyushu/Okinawa-only run.

**Progress checkpoint, ~06:00 JST**: `source_bounds.py` finished for
all three sources in ~7 minutes (01:25-01:32). `source_polygonize.py
jpkyushutest1 4` (71,564 files) has been running since 01:32 —
per-file footprint generation looks complete (`polygon-store/
jpkyushutest1/` file count matches `bounds.csv`'s 71,564 lines) and it
appears to now be inside `merge_source()`'s sequential `ogr2ogr`
append loop, which prints no per-file output (`silent=True`), hence no
visible log movement. `jpkyushutest5m` (91,595 files, ~1.3x `1m`'s
count) and `jpkyushutest10m` (1,363 files) haven't started yet — pure
linear extrapolation from `1m`'s ~4h17m suggests `5m`'s polygonize
alone could take **~5.5 more hours**; `aggregation_run`/
`downsampling_run`/`bundle.py`'s durations are genuinely unknown at
this scale (no prior run this large). Realistic expectation communicated
to Hidenori: a local sample bundle is unlikely before this afternoon,
not "by morning."

**Two `slate` hygiene issues found and fixed, unrelated to this
pipeline's own correctness but real contributors to tonight's reported
heat/load**:
1. A stray `grep` from earlier ad hoc doc research recursed
   uncontrolled into `japan-geotiff-dem-repo/dst/1/`'s tens of
   thousands of binary `.tif` files (missing `--include` filter) and
   sat at ~100% CPU for 9+ hours before being noticed via `ps aux` and
   killed. Not part of any real pipeline.
2. `slate` was found running as a de facto desktop session (Brave
   Browser + Slack, both with multiple helper processes) despite being
   meant to run headless/SSH-only — physical memory was down to
   269MB free out of 16GB before these were quit gracefully via
   `osascript ... quit`, recovering to ~1.1GB free. Root cause per
   Hidenori: the physical keyboard needed for local login ended up at
   his workplace, leaving `slate` headless "by accident" rather than
   by design — worth remembering that `slate` isn't guaranteed to be
   running lean just because it's meant to be headless.

**Storage/time strategy for a future full-Japan PMTiles build —
captured as a TODO, deliberately not started** (Hidenori's own
framing, given limited session budget): (1) once a pack/zip/GeoTIFF is
durably published to Source Cooperative, track that fact in a
lightweight metadata store (CSV or simple KVP) so the local
intermediate copy can be deleted aggressively instead of kept
indefinitely (see `japan-geotiff-dem`'s own `HANDOVER.md` for the
upstream half of this same idea); (2) treat each metatile package as
immutable once built — a "done, never rebuild" label — and avoid
merging into `japan.pmtiles` just to sanity-check one metatile, since
that merge is the expensive step and should happen on a deliberate
schedule, not per-metatile; (3) before attempting full-Japan scale,
need a concrete estimate of how many metatile packages the whole
country would produce and whether `slate`'s storage actually covers
that — not yet estimated. Revisit with a full budget, not mid-session.

### Next steps

- [ ] Check on the overnight pipeline (`/tmp/kyushu-pmtiles-pipeline.log`
      on `slate`) — confirm `jpkyushutest1`'s merge finished, watch
      `jpkyushutest5m`/`10m` polygonize, and eventually
      `aggregation_run`/`downsampling_run`/`bundle.py`.
- [ ] Once the script finishes and restores the 11 Hokkaido-city
      `source-store` entries, re-park them permanently (not
      temporarily) per the decision above.
- [ ] Never merge into `japan.pmtiles` or upload without Hidenori's
      explicit go-ahead, as always — the overnight script deliberately
      stops at `bundle.py`.
- [ ] Work out the metatile-count/storage estimate above before
      attempting anything at full-Japan or full-Hokkaido+Kyushu/
      Okinawa scale.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — still this whole
      effort's eventual retirement condition.

## 2026-08-13/14: aggregation_run in progress 24+ hours, stable; two real slate-hygiene incidents found and fixed; 10-day unattended gap starting

**`aggregation_run.py` (1,119 items, `AGGREGATION_WORKERS=4`) has been
running continuously since 2026-08-13 04:23 JST** — as of this entry,
over 24 hours later, all 4 worker processes are still the same PIDs
(no crashes, no restarts), each with 1000+ CPU-minutes accumulated.
Confirmed real forward progress by watching `tmp-store/` item
subdirectories change and shrink after each completion (idempotent
cleanup is working correctly, contrary to a stale `FORK_NOTES.md`-era
worry that `rmtree` might be commented out): a zoom-10 macrotile over
the Kumamoto/Nagasaki border (Shimabara Peninsula/Amakusa area,
computed from the `{z}-{x}-{y}-{child_z}` tmp-store naming via the
standard Web Mercator tile formula) completed first, then a batch of 4
zoom-11 tiles, now onto a batch of 4 zoom-12 tiles. **At least 5
metatiles confirmed complete out of 1,119** — true throughput is still
genuinely uncertain (early items are a poor sample: the first alone
took ~15 hours, apparently unusually heavy), ranging from tens to 100+
days if the slower observed rate holds. Hidenori is explicitly fine
with slowness as long as it stays stable, which it has.

**Diagnosed the machine's actual bottleneck, at Hidenori's request**:
`iostat` showed `disk4` (the external USB SSD holding the whole
working tree) sustaining ~300MB/s at ~985 transfers/sec during heavy
pipeline stages — consistent with USB 3.0/3.2 Gen1 (5Gbps) class
performance, roughly 17-25x slower than a modern internal NVMe PCIe4
SSD (5,000-7,500MB/s). Meanwhile `vm_stat`'s `Swapins`/`Swapouts`
counters barely moved over several hours despite very low free memory
throughout — meaning memory has been living dangerously close to the
edge but was *not* actively thrashing; **storage I/O bandwidth, not
memory, was the more binding constraint**. Worth remembering for the
"ideal hardware" line of discussion — a NUC/mini-PC's internal NVMe
would likely help more here than RAM alone would.

**Two real slate-hygiene incidents found and fixed this session**,
neither caused by this pipeline's own code but both real contributors
to load/instability risk:

1. **A stray `grep`** from earlier ad hoc doc research (missing
   `--include` filter, recursed into `japan-geotiff-dem`'s `dst/1/`
   binary `.tif` files) sat pinned at ~100% CPU for 9+ hours before
   being noticed via `ps aux` and killed.
2. **`Activity Monitor.app` itself had been running since 2026-06-19**
   (~2 months), pinned at ~100% CPU, having accumulated over 2,580
   CPU-*hours*. A graceful `quit` AppleEvent timed out (the app was too
   busy spinning to respond); a plain `SIGTERM` (`kill <pid>`, not
   `-9`) succeeded where the AppleEvent didn't. Effect was immediate
   and large: free physical memory jumped from 406MB to **4.2GB**, and
   the memory compressor's footprint dropped by ~3.5GB. This was the
   single biggest hygiene win of the whole session — a monitoring tool
   had quietly become the thing most worth monitoring.

Both incidents reinforce the same lesson as `japan-geotiff-dem`'s own
extract/convert/sync-loop shutdown (see that repo's own `HANDOVER.md`
2026-08-13/14 entry): on a machine this memory-constrained, checking
`ps aux`/`top` for *unexpected* long-lived high-CPU processes is cheap
and can free more headroom than any single code change.

**10-day unattended gap starting**: Hidenori is stepping away from the
console for about 10 days, starting a few hours after this entry —
coinciding with `aalto`'s own ~10-day network disconnection from
`slate` (see `japan-geotiff-dem`'s own `HANDOVER.md` for that side).
**Decision: let `aggregation_run`/`downsampling_run`/`bundle.py` keep
running completely unattended for the duration — do not interrupt or
restart it during the gap**, since it's been stable for 24+ hours and
any interruption risks losing real progress with no one available to
supervise a restart. The planned `hfu/mapterhorn` upstream merge (2
commits — `fdd6adc` tar-store support, `57f8481` the worker/downloader
memory-reduction rewrite that changes `aggregation_run.py`'s own
behavior, requiring a companion `downloader.py` process not yet set
up) is **explicitly deferred until after this run completes** — merging
code that changes the very script currently mid-run, with no one
around to catch a resulting hang, would be reckless. Hokkaido relay
stays deferred too (see `japan-geotiff-dem`'s own entry).

### Next steps

- [ ] On resume, first check whether `aggregation_run.py`'s 1,119
      items have actually finished (`ps aux | grep aggregation_run`,
      check `/tmp/kyushu-pmtiles-pipeline.log` for `downsampling`/
      `bundle` stage markers) before assuming anything — 10 real days
      is a long time for this to have silently finished, stalled, or
      (if `slate` rebooted for any reason) stopped entirely.
- [ ] Only after confirming the run is done: merge upstream's 2
      commits into `hfu/mapterhorn`, adapting or deliberately skipping
      the new `downloader.py`/queue-based worker model (same selective
      pattern `FORK_NOTES.md` already used for `downsampling_run.py`)
      — verify by actually running it on `slate`, not just merging and
      trusting it, per Hidenori's own explicit instruction.
- [ ] Only after that: relay Hokkaido's (by-then long-complete) 46
      region-packs from `aalto` to `slate` and let
      `japan-geotiff-dem`'s pipeline process them.
- [ ] Only after that: revisit the "aggressively delete intermediate
      files" national-scale storage strategy (metadata-tracked
      publish state, immutable-once-built metatile packages, deferred
      `japan.pmtiles` merges) that Hidenori sketched but deliberately
      deferred implementing mid-session.
- [ ] Never merge into or publish `japan.pmtiles` without Hidenori's
      explicit go-ahead, as always.

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming the `mapterhorn-japan-bridge` effort. Read, in order:
> `/Volumes/Migrate-2025-04/github/mapterhorn-japan-bridge/CLAUDE.md`
> (runs entirely on `slate`), this file's 2026-08-13/14 entry
> (`aggregation_run` stable 24+ hours in, two slate-hygiene incidents
> fixed — a stray `grep` and, notably, `Activity Monitor.app` itself
> pinned at 100% CPU since June — and the 10-day unattended gap
> starting), and `DECISIONS.md` D12.
>
> **First thing on resume**: check whether `aggregation_run.py` (1,119
> items) actually finished during the gap — don't assume either way.
> `ps aux | grep aggregation_run` and check
> `/tmp/kyushu-pmtiles-pipeline.log` on `slate` for `downsampling`/
> `bundle` stage markers past `aggregation_run`.
>
> **Sequencing, unchanged, all still gated on the above finishing**:
> (1) merge upstream `hfu/mapterhorn`'s 2 pending commits (verify by
> actually running on `slate`, not just merging), (2) relay Hokkaido's
> 46 region-packs from `aalto` to `slate` and let `japan-geotiff-dem`
> process them, (3) revisit the national-scale storage-efficiency
> strategy. Do not skip ahead in this order even if the gap has made
> it tempting.
>
> Standing constraint, unchanged: never merge into or publish
> `japan.pmtiles` (or any bundled `pmtiles`) without Hidenori's explicit
> go-ahead.

## 2026-08-11 (same day, follow-up): download progress checkpoint; `japan-geotiff-dem` republished with real Kyushu/Okinawa data; remaining-15 region-pack recovery underway

Quick same-day addendum — most of today's real activity is on the
`japan-geotiff-dem` side; see that repo's own `HANDOVER.md` same-day
follow-up entry for the full account (repo-consolidation health check,
`aalto`'s HDD formally declared a disposal case, Kyushu/Okinawa
`Z010`-`Z019` integrity re-verified clean, recovery of the missing 15
region-packs started via the `Downloads`-folder relay). This entry is
just what it means for this repo's own PMTiles-build side.

- **`jpkyushutest1`/`5m`/`10m` downloads (in `hfu/mapterhorn`, a third
  repo) continuing steadily on `slate`**, unaffected by anything on
  the `japan-geotiff-dem` side (different bottleneck — Source
  Cooperative's own per-file HTTPS fetch rate, not local storage).
  Checkpoint as of 2026-08-11 11:08 JST: 1m at 37,269/71,577 (52%,
  ~0.75 files/s), 5m at 34,680/91,595 (38%, ~1.29 files/s), 10m
  complete (1,363 files). Both rates have stayed steady all day —
  projected completion for both **around 23:30-00:00 JST tonight**,
  consistent with earlier same-day estimates. Once download completes:
  `source_bounds.py` → `source_polygonize.py` → check the resulting
  `aggregation_covering.py` item count before committing to a full
  aggregation run, since this scale (71K+91K positions, all of
  Kyushu/Okinawa) is larger than any prior trial in this project.
- **`japan-geotiff-dem`'s own bucket got its first real
  post-recovery publish**: `s3://smartmaps/japan-geotiff-dem/1/` now
  carries `Z010`-`Z019`'s 14,116 GeoTIFFs (1,829 with newer 2026
  survey dates), spot-verified against S3 directly. This means
  `jpkyushutest1`'s `file_list.txt` (built earlier from whatever was
  published *before* today's re-sync) may already be slightly stale
  for the newest-dated meshes in that range — not yet refreshed this
  round; worth a `file_list.txt` regen pass once the current download
  finishes, following the same dedup-by-newest-date logic used when
  it was first built (see `CLAUDE.md`'s source-catalog section).
- **Recovery of the missing 15 Kyushu/Okinawa region-packs is
  underway** (Hidenori downloading from GSI into `aalto`'s
  `~/Downloads`, Claude relaying to `slate`) — see
  `japan-geotiff-dem`'s own entry for the exact Z-number tracking
  table. As these land and get extracted/converted/synced, more of
  `jpkyushutest1`'s current 71,577-position footprint will carry
  fresher survey dates (the footprint itself won't grow much, since it
  already covers all of Kyushu/Okinawa's currently-published extent —
  see that same source-catalog note).

### Next steps

- [ ] Once `jpkyushutest1`/`5m`/`10m` downloads finish (~tonight),
      run `source_bounds.py` → `source_polygonize.py`, then check
      `aggregation_covering.py`'s item count before running the full
      aggregation — this is unprecedented scale for this project.
- [ ] Consider refreshing `jpkyushutest1`'s `file_list.txt` against
      `japan-geotiff-dem`'s newly-synced state (1,829 newer-dated
      meshes) before or after the current download completes — either
      works, but don't forget it's now somewhat stale.
- [ ] Never publish `japan.pmtiles` without Hidenori's explicit
      go-ahead, as always.
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — still this whole
      effort's eventual retirement condition.

## 2026-08-14 07:22 JST — quick addendum before the 10-day gap: `aggregation_run` finished, `downsampling_run` now running

`aggregation_run.py` (all 1,119 items) **completed** sometime between
2026-08-14 ~04:19 and ~05:45 JST — no crash, the pipeline script
automatically advanced to the next stage on its own.
`downsampling_run.py` started 05:45 JST; as of this entry it has
processed 233/2,697 downsampling items in ~97 minutes (~2.4
items/min) — much faster than the aggregation stage. At that rate the
remaining ~2,464 items would take roughly **17 more hours**, well
within the 10-day unattended window. After this stage: `bundle.py 1`
(the final step this run is scoped to — still deliberately not
merging into `japan.pmtiles` or uploading). Memory remains very tight
(74MB free) but stable, disk 1.1TB free, no other anomalies. This
entry supersedes this files main 2026-08-13/14 entrys "aggregation_run
in progress" framing — check current stage on resume rather than
assuming either entry is still accurate after 10 real days.

## 2026-08-19 06:xx JST — remote connectivity restored (SSH jump-host route); confirming the 2026-08-14 trial's actual outcome after the 10-day gap

`slate` has been unreachable directly since 2026-08-14 (see the prior
entry's own note). This session, Hidenori set up a new SSH jump-host
route from `aalto` to `slate` (configured locally in `aalto`'s own
`~/.ssh/config` — exact topology deliberately not detailed in this
public repo; ask Hidenori if you need it), reusing the existing
`id_ed25519_slate` key that was already authorized on `slate` from
December — no new keys or `authorized_keys` changes needed anywhere,
since the route just relays TCP and the actual SSH authentication
happens end-to-end between `aalto` and `slate`. This restored Claude's
ability to inspect `slate` directly, for the first time since the
outage began, without needing Hidenori to relay findings manually.

**The trial's actual outcome, confirmed from disk state (not from
`check_progress.py` — see the bug below)**: the last entry (2026-08-14
07:22 JST) left `downsampling_run.py` at 233/2,697 items (8.6%), with
`bundle.py 1` as the next and final scoped step (deliberately not
merging into `japan.pmtiles` or uploading). Checking
`aggregation-store/01KZVPVTAM9V0QP8SRR42XRYKW/` directly:

- Aggregation: **1,119/1,119 items done (100%)** — matches "no crash,
  advanced automatically" from the prior entry.
- Downsampling: **2,697/2,697 items done (100%)** — finished, and
  much faster than the ~17-hour estimate implied. File mtimes across
  `bundle-store/*.pmtiles` cluster tightly between **12:38 and 12:54
  JST on 2026-08-14** — i.e. downsampling actually finished sometime
  between 07:22 and ~12:38, roughly 5.3 hours, not the ~17 hours a
  linear extrapolation from the 07:22 rate (~2.4 items/min) would have
  predicted. Worth remembering: this pipeline's throughput is not
  constant across a run (later items may be smaller/cheaper, or
  contention eases as other things finish) — don't treat an early-run
  rate as a reliable full-run ETA without margin.
- `bundle.py 1`: **completed as scoped** — 11 regional z6 bundle files
  in `bundle-store/` (`6-54-25.pmtiles` through `6-57-27.pmtiles`,
  ~74GB total, largest single file 51.9GB), all finished writing by
  12:54 JST. This is exactly the stopping point the prior entry
  specified ("still deliberately not merging into `japan.pmtiles` or
  uploading") — the absence of a freshly-dated `japan.pmtiles` is
  **not a failure**, it's the plan working as designed.  The existing
  `bundle-store/japan.pmtiles` (3.3GB, dated 2026-08-10 07:28) predates
  this trial entirely and was never touched by it.

**Conclusion: the full-scope trial (aggregation → downsampling →
bundle) completed successfully and unattended**, most likely finishing
its work within an hour or so of the last checkpoint we have, well
before whatever made `slate` unreachable actually happened. No data
was lost, nothing needs to be re-run. `bundle-store`/`pmtiles-store`
together hold ~145GB of real, valid output on
`/Volumes/Migrate-2025-04` (1.1TB free, unaffected).

**Real bug found in `check_progress.py`**, worth fixing whenever this
script is next touched: `check_aggregation_status()` globs
`aggregation-store/{agg_id}/*-aggregation.done`, but the actual file
this pipeline writes is named `*-aggregation.csv.done` (confirmed
directly: `ls aggregation-store/01KZVPVTAM9V0QP8SRR42XRYKW | sed -E
's/^[0-9-]+//' | sort -u` shows `aggregation.csv`,
`aggregation.csv.done`, `downsampling.csv`, `downsampling.csv.todo`,
`downsampling.done` — no bare `aggregation.done` exists). Because of
this, `check_progress.py` will **always report 0% aggregation
progress**, regardless of true state — confirmed by running it live
just now: it printed "Items completed: 0/1,119 (0.0%)" against a run
that was actually 100% done. Anyone trusting this script's aggregation
percentage during a live run would be misled into thinking it's stuck
at 0% forever. Downsampling's own status check in the same script
reads `downsampling.log` (a file that doesn't currently exist in this
directory, possibly cleaned up or never created this run) rather than
glob-counting `*-downsampling.done`, so it likely has the same
class of staleness risk, not independently verified this session.

**Disk space check on `slate`, ahead of the `polygon-store`
fast-storage discussion**: the internal boot SSD (`/`, backed by
`/System/Volumes/Data`) has **only 54GB free** (228GB container, 141GB
used). This matters directly for Hidenori's proposal (this same
session) to relocate `polygon-store/` onto `slate`'s native SSD via a
symlink, to speed up `source_polygonize.py`'s `merge_source()` step
(repeated `ogr2ogr -update -append` into a single growing `.gpkg`,
identified this session as the likely "積み上げが遅い" boundary-
accumulation slowness) — a working set anywhere near the ~60GB figure
floated earlier would **not comfortably fit** in the current 54GB
free. Worth re-checking free space at the time this is actually
attempted, and possibly clearing headroom first (or scoping the
fast-storage relocation to a single source's `merge_source()` run at a
time, given each source's own working `merged.gpkg` is presumably far
smaller than 60GB — not yet measured directly, since `polygon-store/`
on disk right now only holds the small finished union `.gpkg` outputs,
not any in-flight `merged.gpkg`).

### Lessons

1. **A `check_progress.py`-reported 0% doesn't mean 0% real progress**
   — always cross-check against actual `aggregation-store/` file
   counts (or fix the glob pattern) before concluding a run is stuck.
2. **Don't extrapolate an unattended pipeline's ETA linearly from an
   early checkpoint** — this run finished roughly 3x faster than the
   07:22 rate implied. Pad estimates, or just check back rather than
   trusting the number.
3. **A pipeline stopping exactly where it was scoped to stop is
   success, not failure** — "no fresh `japan.pmtiles`" looked
   suspicious in isolation; reading the prior entry's own explicit
   scope note ("deliberately not merging... this run") resolved it
   immediately. Always check what a run was actually scoped to do
   before treating an absent downstream artifact as evidence of
   failure.
4. **SSH access to `slate` from `aalto` restored via a jump-host
   route** (configured locally in `aalto`'s own `~/.ssh/config`,
   topology not detailed here — public repo), reusing the
   already-existing `id_ed25519_slate` key — no new keys were needed
   anywhere, since the route is a pure relay. This restores remote
   inspectability of `slate` going forward, independent of whatever
   made direct `slate.local` resolution stop working from `aalto`'s
   network.

### Next steps

- [ ] Decide whether to actually pursue the `polygon-store` →
      native-SSD relocation given the 54GB free-space constraint —
      still an open, deliberately unhurried investigation per
      Hidenori's own framing ("あくまで、将来に向けた入念な調査").
- [ ] If pursued: measure a single source's actual peak `merge_source()`
      working-set size before assuming the ~60GB figure applies
      uniformly.
- [ ] Consider fixing `check_progress.py`'s aggregation-done glob
      pattern next time this script is touched, so it stops
      permanently under-reporting.
- [ ] `japan-geotiff-dem`'s own JCI 2026-09 push continues to take
      priority, unchanged — this entry is investigation only, nothing
      here blocks or is blocked by that effort.

## 2026-08-19 06:xx JST (same session, continued): `polygon-store` fast-storage relocation investigated — disk speed turns out NOT to be the bottleneck; found a real GDAL-upgrade regression in `source_polygonize.py` instead

Continuing directly from the trial-confirmation entry above. Hidenori's
original framing ("将来に向けた入念な調査" — careful investigation for
the future, not urgent) for relocating `polygon-store/` onto `slate`'s
native SSD via a symlink, to speed up `source_polygonize.py`'s
`merge_source()` step.

### Raw storage benchmarks (internal SSD `/` vs. external USB SSD `/Volumes/Migrate-2025-04`)

- **Sequential write** (1GB, `dd bs=1m`): internal **2.80GB/s**,
  external **424MB/s** — internal ~6.6x faster.
- **Small write+fsync** (2000× 4KB writes to the same file, `dd
  conv=fsync`): internal **920 ops/s** (~1.09ms/op), external **650
  ops/s** (~1.54ms/op) — internal only ~1.4x faster. Much smaller gap
  than the sequential number suggests, once fsync (the real cost for
  transactional writes) dominates.

### The decisive test: the actual `ogr2ogr -update -append` command, repeated

Raw `dd` benchmarks don't tell you whether `merge_source()`'s real
bottleneck is disk I/O at all — the workload is thousands of separate
subprocess invocations, each opening/writing/closing a SQLite-backed
GPKG. Built a synthetic single-polygon source GPKG (98KB, matching the
real per-mesh footprint output size) and ran the exact production
command 500 times in a loop, appending into a growing target, on each
volume:

| | internal SSD | external USB SSD |
|---|---|---|
| 500 appends, total time | 46.0s | 50.6s |
| per-append average | ~92ms | ~101ms |
| difference | **~10%** | |

**Per-append time stayed essentially constant across the whole run**
(9.1s → 9.2s → 9.3s → 9.3s per 100-append block) even as the target
file grew — no sign of the "gets slower as the file grows" pattern
that motivated this investigation in the first place, at least at this
scale (500 appends, final file 200KB — real sources may run into the
tens of thousands of appends, not independently tested at that scale
this session).

**Conclusion: storage speed is very likely not the dominant cost
here.** ~90-100ms per invocation, nearly flat regardless of which
disk, points at fixed per-process overhead — Python subprocess launch
+ GDAL driver/SQLite initialization + open/close — as the real
bottleneck, not disk throughput. **Moving `polygon-store/` to the
native SSD would likely deliver only a modest (~10%) improvement, not
the meaningful speedup originally hoped for.** If `merge_source()`
needs to actually get faster, the more promising direction is
reducing the *number of subprocess invocations* — e.g. batching many
inputs into fewer `ogr2ogr`/`ogrmerge.py` calls, or using GDAL's
Python bindings (`osgeo.ogr`) directly in-process instead of shelling
out per file — not a storage-tier change. Not attempted this session
(out of scope for "investigation only"); flagging as the real lever
for whoever picks this up next.

### Real bug found: GDAL 3.13.3 (released 2026-08-13, one day before the
outage) rejects a duplicate `-append` flag that `source_polygonize.py`
passes

```python
command = f'ogr2ogr -f GPKG -update -append {merged_filepath} polygon-store/{source}/{filename}.gpkg -nln out -append -addfields'
```

`-append` appears twice. Reproduced directly: this exact command
form fails immediately with `ERROR 1: Duplicate argument -append` on
the GDAL currently installed (`3.13.3 "Iowa City"`, released
2026/08/13 — installed via Homebrew, auto-upgraded independent of this
project). Every existing `polygon-store/*.gpkg` union output was
written **before** 2026-08-13 (Aug 8-13 timestamps) — consistent with
an older, more permissive GDAL silently tolerating the duplicate flag.
**This means `merge_source()` is currently broken for any new source**
— it would fail on the very first `-update -append` call. Confirmed
the fix is trivial (drop the second `-append`, `-addfields` alone is
sufficient with `-update` already set); **not yet applied to the
actual file** — this session was investigation-only, deliberately not
touching pipeline code.

### Recommendation on sequencing (Hidenori asked directly)

Between (a) actually completing the `japan.pmtiles` merge from the
already-finished 2026-08-14 trial bundles, and (b) relocating
`polygon-store` + resuming conversion of more Kyushu/Okinawa regions:
**(a) first.** All the upstream work (aggregation, downsampling,
bundle.py) is already done and sitting in `bundle-store/`
(~74GB) — running `merge_japan_bundles.py` costs nothing new and
would validate the whole trial end-to-end before investing further.
(b) is explicitly framed as unhurried future work, still has an
unresolved disk-headroom question (54GB free on the internal SSD) and
now, per the benchmark above, a much smaller expected payoff than
originally hoped — worth reconsidering the whole approach (batching
over storage-tier) before actually implementing anything. Per the
existing standing rule, `merge_japan_bundles.py` producing a local
`japan.pmtiles` is not the same as publishing it — that still needs
Hidenori's explicit go-ahead separately.

### Also this session: SSH access to `slate` restored via a jump-host route

`aalto` now has a working SSH host alias that reaches `slate` directly
and non-interactively, reusing the pre-existing `id_ed25519_slate` key
(no new `authorized_keys` entries anywhere). **Exact jump-host
topology deliberately not written here** — this is a public repo;
ask Hidenori or check `aalto`'s own `~/.ssh/config` if you need the
details. This is how the investigation above was actually carried
out. Next logical extension, not yet attempted: redo the
`source-coop login` OAuth loopback flow (needed for this project's own
Source Cooperative publishing) through this same route instead of the
old direct-LAN tunnel it used to require — the actual OAuth approval
remains Hidenori's own step in a browser, as always.

### Next steps

- [ ] Run `merge_japan_bundles.py` on `slate` to actually produce a
      fresh local `japan.pmtiles` from the 2026-08-14 trial's bundles
      — recommended next action, cheap and validates the trial.
      **Not yet run this session.**
- [ ] Fix the duplicate `-append` in `source_polygonize.py` before
      the next time a new source needs `merge_source()` — currently
      broken.
- [ ] Before pursuing `polygon-store` relocation further: reconsider
      whether batching (fewer subprocess calls) is a better lever than
      storage tier, given the ~10% benchmark result.
- [ ] If `source-coop login` is needed on `slate` again, try the new
      ProxyJump route for the port-forward instead of the old
      direct-LAN tunnel.

## 2026-08-19 10:01 JST (same session, continued): `japan.pmtiles` merge finally succeeds -- root cause was `tempfile`'s default directory, not memory/swap

Continuing directly from the two entries above. Root cause of the
repeated ENOSPC crashes, found by reading the actual `pmtiles` Python
library source
(`pipelines/.venv/lib/python3.13/site-packages/pmtiles/writer.py`):

```python
class Writer:
    def __init__(self, f):
        ...
        self.tile_f = tempfile.TemporaryFile()
```

`Writer.write_tile()` streams every tile's bytes into this
`tempfile.TemporaryFile()` as it goes, only assembling the real header
and directory at `finalize()` time (then it concatenates
header+directory+the whole temp file into the final output). Python's
`tempfile.TemporaryFile()` defaults to `TMPDIR` (or `/tmp` if unset)
-- on this machine that's the small internal boot volume, **not**
wherever the script's own output path happens to live. For this
merge, that meant the *entire* ~70GB of tile data got written twice in
effect: once into an anonymous (unlinked) file on the tight internal
SSD, and again at `finalize()` when copied into the real
`bundle-store/japan.pmtiles` on the external volume.

This resolves the "memory vs storage speed" question from the
Consequences of the second entry above: **it was neither.** The
process's climbing RSS was largely page-cache pages backing that
temp file (real, but not the constraint that mattered), and the
repeated ENOSPC was disk space on `/`, not swap. My earlier working
theory ("swap growth under memory pressure") was directionally right
about *what* was filling `/` but wrong about *why* -- it's an
unlinked regular file from `tempfile`, not swap. Confirmed by watching
`df -h /` and `df -h /Volumes/Migrate-2025-04` live during a 4th
attempt: `/` sat rock-stable at 85GB free the entire run while
`/Volumes/Migrate-2025-04` absorbed all ~70GB of growth, exactly as
predicted once the fix was in place.

**Fix**: no code change needed anywhere. Just point `TMPDIR` at the
external volume before running the script:

```sh
mkdir -p /Volumes/Migrate-2025-04/tmp
TMPDIR=/Volumes/Migrate-2025-04/tmp python3 merge_japan_bundles.py
```

Python's `tempfile` module respects `TMPDIR` automatically -- this
generalizes to *any* script on this machine that uses `tempfile`
internally (GDAL/OGR tools sometimes do too) and produces
large-relative-to-`/` intermediate files.

**Result, verified**: `bundle-store/japan.pmtiles` -- **789,984
addressed tiles** (512,255 tile entries, 484,827 distinct tile
contents after content-dedup), zoom 0-16, ~70.7GB
(75,939,452,941 bytes). Verified non-corrupt by reading the header
with `pmtiles.reader.Reader` and confirming `tile_data_offset +
tile_data_length` exactly equals the file's actual size on disk
(earlier failed attempts showed a large mismatch here -- that
comparison is the right sanity check for any future PMTiles output
before trusting it). This is a genuinely complete regeneration of
`japan.pmtiles` reflecting the full 2026-08-14 trial (Hokkaido +
Kyushu/Okinawa-region coverage via `jpkyushutest1`, plus `planet.pmtiles`
as the global base layer) -- **not yet published/uploaded anywhere**,
per the standing rule that requires Hidenori's explicit go-ahead for
that step separately.

### Also this session (same continued block)

- Killed 3 long-orphaned `colima start -f` zombie processes dated
  2026-08-10 (0% CPU, harmless but unexplained clutter -- part of the
  general "60-day uptime accumulates cruft" pattern flagged earlier).
- Confirmed `hfu/mapterhorn`'s `jpkyushutest5m`/`jpkyushutest10m`
  source-catalog entries use the *same* mesh-code-range scope as
  `jpkyushutest1` (3900-5199, i.e. Kyushu/Okinawa **plus** all of
  Shikoku and western Chugoku -- confirmed by direct JIS-mesh-code
  computation for representative prefecture capitals, not just
  boundary-adjacent spot-checks like the earlier Kinki check). This
  is **intentional per Hidenori** ("日本を一つの広域ソースとして扱い、
  6-x-y.pmtiles には全ての地方のソースが入っている" -- Japan is being
  treated as one broad-area source on purpose, not per-prefecture) --
  not a bug, no fix needed. Left `jpkyushutest5m`/`10m` **uncommitted**
  in `hfu/mapterhorn` per Hidenori's own call: since they're
  Kyushu-scoped (not national) they're inherently test/throwaway
  artifacts, same spirit as the `jpkyushutest*` naming itself.
- Internal SSD capacity check (Hidenori asked directly): 228GB total,
  110GB used, 85GB free as of this entry. Already reclaimed 31GB this
  session (see the polygon-store investigation entry above). Further
  low-risk headroom is limited (~10-15GB at most, mostly GUI-app
  container data with real usability tradeoffs -- Slack/Teams
  containers, Application Support). **Conclusion: buying a faster
  external SSD is not the actionable lever here** -- the existing
  external volume's *capacity* (1.1TB free) already solves the real
  constraint, and its *speed* has not been a bottleneck for anything
  actually run this session (the D14-era storage-speed benchmark
  already showed only a ~10% gap for the real GDAL workload pattern,
  and this merge itself ran to completion on the existing external
  drive without issue once TMPDIR was pointed there). The generalizable
  lesson is routing (send big intermediates to the roomy volume via
  `TMPDIR`/equivalent), not hardware spend.
- Verified `6-x-y.pmtiles` regional bundle count while investigating:
  **11** currently in `bundle-store/` (unchanged by this merge, which
  only reads them). Whether Hidenori's planned re-run of `jpkyushutest1`'s
  aggregation (after `source_bounds.py`/`source_polygonize.py`/
  `aggregation_covering.py` finish, still in progress at end of this
  entry) adds new ones or just densifies the existing 11 is not yet
  known -- the geographic extent (mesh-code range 3900-5199) doesn't
  change, only mesh density within it, so 11 staying constant is the
  working expectation, not yet confirmed.

### Next steps

- [ ] `jpkyushutest1` pipeline (download → `source_bounds.py` →
      `source_polygonize.py`) still in progress as of this entry --
      once done, check `aggregation_covering.py`'s item count before
      running the real `aggregation_run.py`, per the project's own
      standing practice for any coverage-scale change.
- [ ] Once a fresh aggregation/downsampling/bundle cycle lands new or
      updated `6-x-y.pmtiles` files, re-run `merge_japan_bundles.py`
      (with `TMPDIR` pointed externally, now proven) to fold them into
      an updated `japan.pmtiles`.
- [ ] `japan.pmtiles` is regenerated locally but **not published** --
      needs Hidenori's explicit go-ahead before any upload/publish
      step, as always.
- [ ] Consider documenting the `TMPDIR` external-volume pattern
      somewhere more prominent (e.g. this repo's own README or
      CLAUDE.md-equivalent) so it isn't rediscovered from scratch next
      time a large intermediate-file script runs low on root space --
      not done yet, this HANDOVER entry is the only record so far.

## 2026-08-19 (same session, closing): session pause for `/clear` — resume prompt

Closing out a long session (full detail in the three entries above:
trial confirmation, `polygon-store`/GDAL investigation, `japan.pmtiles`
fix) at Hidenori's request, ahead of `/clear`.

### Current state

- `japan.pmtiles` rebuilt successfully in `bundle-store/`: 789,984
  tiles, ~70.7GB, verified non-corrupt. **Local only, not published.**
  **This is the queued next action** — Hidenori wants to verify it and
  upload to Source Cooperative once this session resumes.
- `jpkyushutest1` download+bounds+polygonize pipeline (this session's
  refreshed 75,724-position `file_list.txt`, up from 71,577) still
  running: ~71,867/75,724 downloaded (~95%) as of this entry, `source_
  bounds.py`/`source_polygonize.py` not yet reached. Log:
  `/tmp/jpkyushutest1_pipeline.log`. Check `ps aux` for `source_
  download.py`/`source_bounds.py`/`source_polygonize.py`/`ogr2ogr` to
  see which stage it's actually in on resume.
- `jpkyushutest5m`/`jpkyushutest10m` exist locally (downloaded, same
  3900-5199 scope) but are **deliberately left uncommitted** in `hfu/
  mapterhorn` per Hidenori's own call — Kyushu-scoped test artifacts,
  not national, not worth formalizing into git.
- `slate` internal SSD: 228GB total, 85GB free (up from 55GB at
  session start — reclaimed ~31GB of safe cache/orphaned-app data).
  FileVault confirmed **on** — no reboot without physical/GUI access
  (expected ~2026-08-23 night). Pending macOS Tahoe 26.6.2 update
  stays deferred until then.
- 3 orphaned `colima start` processes from 2026-08-10 killed.
- GDAL 3.13.3 duplicate-`-append` regression fixed and pushed to
  `hfu/mapterhorn` (commit `69d4288`).
- `jpkyushutest1/file_list.txt` regenerated and pushed (commit
  `a0b9b16`).

### Next steps, in order

- [ ] **First**: verify `bundle-store/japan.pmtiles` is genuinely good
      (re-check header vs. file size if any doubt — see the fix entry
      above for the exact check) and upload to Source Cooperative.
      This needs Hidenori's explicit go-ahead for the actual publish
      step, per the standing rule — don't just run `upload.py` or
      equivalent without confirming first.
- [ ] Check on the `jpkyushutest1` pipeline — if download finished,
      let `source_bounds.py`/`source_polygonize.py` run (or kick them
      off manually if the `just` chain didn't auto-continue); once
      `source_polygonize.py` completes, run `aggregation_covering.py`
      and report its item count before deciding whether/how to run a
      full `aggregation_run.py` for this expanded coverage.
- [ ] If a fresh aggregation/downsampling/bundle cycle produces new or
      changed `6-x-y.pmtiles` files (11 exist now; expected to stay 11
      since the geographic extent doesn't change, only density within
      it — not yet confirmed), re-run `merge_japan_bundles.py` with
      `TMPDIR=/Volumes/Migrate-2025-04/tmp` to fold them in.
- [ ] `japan-geotiff-dem`'s own JCI 2026-09 push continues in parallel
      on `aalto`, unrelated to this thread — see that repo's own
      HANDOVER.md for its current state (Hokuriku in progress as of
      this session).

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming `mapterhorn-japan-bridge` / `hfu/mapterhorn` work on
> `slate`. Read this file's most recent entries (trial confirmation,
> `polygon-store`/GDAL investigation, `japan.pmtiles` fix, this closing
> entry) for full context. `slate` is reachable from `aalto` via an
> SSH jump-host route (topology in `aalto`'s own `~/.ssh/config`,
> deliberately not written here since this repo is public) — use that
> to inspect/drive `slate` directly rather than asking Hidenori to
> relay anything.
>
> **First priority**: verify the freshly-rebuilt `bundle-store/
> japan.pmtiles` (789,984 tiles, ~70.7GB — built by fixing a
> `tempfile`-directory bug, see the fix entry above for the exact
> verification method: header's `tile_data_offset + tile_data_length`
> must equal the actual file size) and **upload it to Source
> Cooperative** — this is the explicit next action Hidenori queued
> before this `/clear`. Get his explicit go-ahead before the actual
> publish/upload step, per the standing rule.
>
> **Second**: check on the `jpkyushutest1` download+bounds+polygonize
> pipeline (was ~95% through downloading as of this entry) and
> continue it toward `aggregation_covering.py`, reporting its item
> count before committing to a full `aggregation_run.py`.
>
> **Remember**: FileVault is on, so no reboot without physical/GUI
> access (not available until ~2026-08-23 night) — don't attempt one
> even if disk/memory pressure suggests it would help. If a script
> needs a large intermediate file and disk space on `/` gets tight,
> point `TMPDIR` (or equivalent) at `/Volumes/Migrate-2025-04` first —
> proven pattern from this session, likely to recur.

## 2026-08-19 (continued): `japan.pmtiles` hosted on `stars` instead of Source Cooperative (D13)

Two SC upload attempts for the freshly-rebuilt `japan.pmtiles` (789,984
tiles, ~70.7GB) both failed mid-transfer with HTTP 520 on `UploadPart`
(see D13 for full detail and the operational gotcha about `martin` being
a hot-reloading `systemctl --user` service — don't `pkill` it). Pivoted to
hosting on `stars` instead: `rsync`'d directly from `slate` over LAN,
served at `https://depot.optgeo.org/japan.pmtiles` (raw, range-capable —
the URL to use with the official Mapterhorn viewer) and
`https://stars.optgeo.org/japan` (via `martin`, XYZ/TileJSON). Verified
both endpoints return the file with matching `Content-Length` and
`Accept-Ranges: bytes`. Direction going forward, per Hidenori: SC stays
the low-frequency durable archive, `stars`/`martin` is the daily-use host;
run both, not one instead of the other.

`jpkyushutest1`'s `source_download.py` (Kyushu/Okinawa-range, 3900-5199)
was left running throughout, unaffected — it reads its own
`source-store/`, not `bundle-store/`, so nothing about the `japan.pmtiles`
work touched it.

### Next steps

- [ ] **Deliberately deferred until `japan-geotiff-dem` finishes
      publishing full national 1m coverage** (see that repo's own
      `HANDOVER.md` for progress — Hokuriku just completed, Kanto-1/2/3
      and Chubu remain as of this entry): expand `jpkyushutest1`'s scope
      from the 3900-5199 mesh range to all of Japan, **in place** (same
      entry/name — chosen specifically to avoid re-downloading the
      ~75k files already fetched under this name), by regenerating
      `file_list.txt` from `s3://smartmaps/japan-geotiff-dem/1/
      latest_file_list.txt.gz` **unfiltered** (279,005 entries as of
      2026-08-19, vs. current ~75,724) instead of range-filtered. Update
      `metadata.json`'s description away from "九州沖縄 1m（速度検証用・
      部分）" to reflect national scope once this happens.
- [ ] Hidenori floated renaming `jpkyushutest1` to a clearer name once a
      good opportunity comes up (not mid-pipeline-run) — bundle this with
      the scope-expansion work above rather than doing it separately.
- [ ] SC upload of `japan.pmtiles` not reattempted this session (see D13)
      — the 2026-08-09 (~2GB) object there is now stale. Revisit with a
      more resilient upload tool, or make an explicit decision to stop
      tracking `japan.pmtiles` on SC at all.

## 2026-08-19 (continued): `jpkyushutest*` renamed to `jpnational*`, test entries cleaned up

Renamed `jpkyushutest1`/`jpkyushutest5m`/`jpkyushutest10m` →
`jpnational1`/`jpnational5`/`jpnational10` (note: dropped the "m" suffix
on the 5/10 variants, a deliberate one-off deviation from the
`jp<place><res>m` convention every other regional entry uses — see
below for why). Done at a natural pause point (download paused, renamed,
resumed) rather than mid-run, per Hidenori's own preference about
timing. Covered every location: `source-catalog/`, `pipelines/
source-store/`, `pipelines/polygon-store/*.gpkg`, each entry's own
`Justfile`, and `jpnational1/metadata.json`'s description (dropped the
stale "速度検証用" framing). `jpnational1` is git-tracked (`git mv`);
`jpnational5`/`jpnational10` stay untracked, same as before.

Same session: deleted `jphakodatecity1/5m/10m`, `jphakodatetrial1/5m/
10m/sea`, `jpsapporo1/5m/10m/sea`, `jpshakotan1/5m/10m` — superseded
pipeline-validation/test entries, per Hidenori's explicit call once
`jpnational*` existed to replace them. Reclaimed ~3.5GB of `source-store`
data plus a stray `sapporo-sea-raw-tiles` `tmp-store` leftover (63MB).
This is *why* dropping the "m" suffix for `jpnational5`/`jpnational10`
was safe to do without creating inconsistency: the sibling entries that
established the old `...5m`/`...10m` convention no longer exist.
`jphokkaidodem1` deliberately left untouched — frozen per D12, a real
(if paused) entry, not a test one, not part of this cleanup.

Download resumed cleanly under `jpnational1` after the rename, continuing
from where it left off (no re-fetch — `wget --continue` plus preserved
directory contents on the renamed `source-store/jpnational1`).

### Next steps

- [ ] Continue `jpnational1`'s Kyushu-scope download to completion, then
      `source_bounds.py` → `source_polygonize.py`.
- [ ] Once that's done: expand `jpnational10` first, then `jpnational5`,
      to full national scope (drop the mesh-range filter, use
      `latest_file_list.txt.gz` unfiltered) — **not** `jpnational1` yet,
      which stays gated on `japan-geotiff-dem` finishing national 1m
      publishing (see that repo's own `HANDOVER.md`). This ordering is
      explicitly low priority per Hidenori — don't force it or take
      risks with it; the core aalto DEM upload work takes precedence
      over anything here.
- [ ] When `jpnational1` does eventually expand to national scope, make
      sure `jpnational5`/`jpnational10` (by then hopefully already
      unfiltered) actually cover the gaps `jpnational1` can't reach —
      concretely verified this session: Yonaguni/Hateruma (mesh
      ~3622-3624) has no 1m DEM1A data published anywhere in the
      national listing at all (1m's national floor is mesh 3927; 5m's
      is 3624; 10m's is 3622) — almost certainly an upstream GSI survey
      gap, not a pipeline bug, but it means the D8 priority-merge
      fallback only fills that area in if `jpnational5`/`jpnational10`
      are unfiltered by the time aggregation runs there.

## 2026-08-19 (continued): `jpnationalsea` created — national-scope GLO-30 sea fallback (prepared, not downloaded)

Following up on the max_zoom investigation above (confirmed via a real
1m sample GeoTIFF that z16 is the *correct* dynamically-computed value
for GSI 1m data, not an arbitrary cap — see `get_smallest_overzoom` in
`aggregation_covering.py`) and Hidenori's observation that the current
Kyushu-scope `japan.pmtiles` has no sea/ocean fill at all: created
`source-catalog/jpnationalsea`, 275 of `glo30`'s 24,674 global GLO-30
tiles filtered to a rectangular bounding box (lat 20-46N, lon 122-154E).

Chose a simple rectangle over a precise EEZ polygon because `glo30`'s
own tile inventory (24,674 of a possible 64,800 global 1°×1° cells,
~38%) already appears to exclude pure-open-ocean tiles with no land —
consistent with the standard COP30 distribution convention — so a
polygon filter would likely produce nearly the same result for any
genuinely deep-ocean gap, not worth the added complexity.

Verified real tile presence (not just "the bounding box theoretically
contains this point") across the full extent of the box, including its
northeasternmost, easternmost, southernmost, and southwesternmost
corners — outlying islands well away from the main population centers
aren't silently dropped by the filter.

Confirmed the maxzoom-efficiency concern Hidenori raised (building
GLO-30-only areas up to 1m's z16 would be wasteful) is already handled
by the existing architecture, no new code needed: `downsampling_covering.py`
reads each aggregation item's own already-computed maxzoom from its
filename (`{z}-{x}-{y}-{maxzoom}-*.csv`) and only ever builds *downward*
overviews from there — GLO-30's ~30m resolution computes to roughly
z9-13 per `aggregation_covering.py`'s own code comments (S79→9, N66→10,
N50→11, N49→12), always well below 1m's z16, so it can never get built
up to match neighboring high-res land tiles.

Committed as `a4249b6` on `hfu/mapterhorn`. **Deliberately not
downloaded** — explicitly low priority per Hidenori, the aalto GeoTIFF
DEM upload work takes precedence over anything here.

### Next steps

- [ ] When there's slack to spare (low priority, don't force it): run
      `jpnationalsea`'s `default` recipe (download → bounds →
      polygonize) and fold it into a future aggregation run alongside
      `jpnational1`/`jpnational5`/`jpnational10`.
- [ ] `jphakodatetrialsea`'s config is still recoverable from git
      history (`ffcd665^`) if the old small-scale pilot data is ever
      wanted again for comparison — the raw GLO-30 tif data itself was
      not preserved, only the source-catalog config.

## 2026-08-19 (continued): CSV manifests + aria2c (D14), `jpnational5`/`jpnational10` go national

Full detail in D14. Summary of what changed and current state:

- `japan-geotiff-dem`'s `build_filelists.py` now emits
  `latest_file_list.csv.gz`/`obsolete_file_list.csv.gz` (columns
  `url,size,md5`) instead of plain-text URL lists, getting size+MD5 for
  free from a single `aws s3api list-objects-v2` call (S3 ETag = true
  MD5 for these single-part-uploaded files, verified directly). Old
  `.txt.gz` manifests removed from the bucket on republish.
- `source_download.py` rewritten around `aria2c`: one invocation per
  source instead of one `wget` subprocess per URL. Uses the manifest's
  MD5 (`--checksum=` + `--check-integrity=true`) to let aria2c itself
  skip already-correct local files with zero network requests, when a
  trustworthy MD5 is available. Falls back to a local size-only
  pre-filter when it isn't (GLO-30's `opentopography.s3.sdsc.edu`
  mirror hands out placeholder ETags and doesn't support bucket
  listing at all — had to retarget `jpnationalsea` at the real
  `copernicus-dem-30m.s3.amazonaws.com` AWS mirror instead, which does
  have real ETags).
- `jpnational1`: full CSV+aria2c run completed in 2h16m4s (75,818
  entries, mostly already-present + verified, some genuinely new),
  every file checksum-OK. Then `source_bounds.py` started (not yet
  finished as of this entry — this repo's `default` Justfile recipe
  chains download→bounds→polygonize automatically, but this run was
  invoked as a standalone timed test, so bounds had to be kicked off
  by hand afterward).
- `jpnational5`/`jpnational10` expanded from the old 3900-5199
  mesh-range filter to **full national scope**: `jpnational10` 1,364 →
  4,981 tiles, `jpnational5` 91,595 → 378,618 tiles. Both downloading
  now. `jpnational1`'s own national expansion stays gated on
  `japan-geotiff-dem` finishing its national 1m publish (unrelated —
  5m/10m have no such dependency, which is why they went first, per
  Hidenori).
- New `check_download_progress.py`: file-count-only progress report
  (local `.tif` count vs. manifest row count) per source, or all
  sources at once. Snapshot at the time of this entry:
  ```
  jpnational1     75,818 /  75,818  (100.0%)
  jpnational10     1,720 /   4,981  ( 34.5%)
  jpnational5     92,203 / 378,618  ( 24.4%)
  jpnationalsea      187 /     275  ( 68.0%)
  ```

### Next steps

- [ ] Let `jpnational5`/`jpnational10`/`jpnationalsea` downloads run to
      completion (`jpnational5` in particular is far larger than
      anything downloaded under this pipeline before — expect it to
      take a while purely from genuinely-new-file volume, not a repeat
      of the old per-file-overhead problem).
- [ ] `jpnational1`: check on `source_bounds.py`'s progress, then run
      `source_polygonize.py jpnational1 4` once it's done.
- [ ] Once `jpnational5`/`10` finish downloading, run their own
      `source_bounds.py`/`source_polygonize.py` too.
- [ ] `aalto`'s `japan-geotiff-dem` JCI 2026-09 work is still in
      progress in parallel (Kanto-3 tail, Kanto-1, Chubu tail — see
      that repo's own `HANDOVER.md`) — `jpnational1`'s eventual
      national-scope expansion is gated on that finishing.
- [ ] `jpnationalsea` was briefly slowed by what looked like
      throttling/an outage on the `copernicus-dem-30m.s3.amazonaws.com`
      path specifically (a single `curl` HEAD took 10+ minutes, vs.
      ~7s to `data.source.coop` from the same machine at the same
      time) — resolved on its own within the session, but worth
      knowing this specific external dependency can degrade
      independently of everything else.

## 2026-08-19 (continued): `source_polygonize.py` rewritten (D15) — test in progress on `jpnational10`

Full detail in D15. Summary: `merge_source()`'s old one-`ogr2ogr`-
subprocess-per-mesh loop (the real cost behind `jpnational1`'s earlier
~4h17m full-run time, confirmed by a prior investigation to be
subprocess/driver-init overhead, not disk speed) replaced with a
two-level batched `gdal vector concat` (GDAL 3.13's new unified CLI) —
parallel `BATCH_SIZE=3000`-file batches, then one final concat over
the batch outputs. Measured **~16x** speedup on a real 500-file sample
(216.68s → 13.5s), with **exact feature-count agreement** (494/500
both ways) confirming no data loss. `BATCH_SIZE=3000` chosen because a
single-invocation call over all ~18k then-available files hit macOS's
1,048,576-byte `ARG_MAX`; 3000 files (~180KB of argv) has real margin.

### Current state (mid-test, this is a checkpoint before an expected `/clear`)

- **`jpnational10`** (4,981 tiles, national scope): **confirmed working
  end to end under the new D15 code.** `source_bounds.py` re-run to
  cover the newly-expanded scope (old `bounds.csv` was stale, from the
  pre-expansion 1,364-tile era). `source_polygonize.py jpnational10 4`
  completed cleanly (2 batches of ~2,500 each, 12s + 19s in parallel,
  then one final concat + union). Verified output
  `polygon-store/jpnational10.gpkg`: `Feature Count: 1` (correctly a
  single unioned multipolygon), `Extent: (122.93, 20.42) -
  (153.99, 45.56)` — matches the expected national EEZ-bounding-box
  extent exactly. This was the deliberately chosen first real target
  (small, safe) before trusting the new code on anything larger — it
  passed.
- **`jpnational1`** (75,818 tiles, still Kyushu-range): its own
  `source_polygonize.py` run under the **old** code was interrupted
  ~40 minutes in (only in the parallel `gdal_footprint`-extraction
  phase, `polygonize_source()` — never reached the slow
  `merge_source()` part) specifically to do this investigation. ~18k
  per-mesh GPKGs from that partial run are still on disk in
  `polygon-store/jpnational1/` and reusable (`polygonize_source()` is
  idempotent, `gdal_footprint -overwrite` skips nothing extra but
  doesn't corrupt anything either) — **not yet resumed under the new
  code**, waiting on `jpnational10` confirming clean first.
- **`jpnational5`** (378,618 tiles, national scope): still downloading
  (was ~25-26% by file count a short while before this entry). Its own
  `source_bounds.py`/`source_polygonize.py` haven't started. This is
  the real stress test for D15's rewrite once it gets there.
- **`jpnationalsea`** (275 tiles, GLO-30, national scope): download
  **complete** (2h29m54s under the new aria2c mechanism, D14, all
  checksum-verified). Bounds/polygonize not yet started.
- Download-progress snapshot at write time (`check_download_progress.py`,
  D14's companion tool):
  ```
  jpnational1     75,818 /  75,818  (100.0%)
  jpnational10     4,981 /   4,981  (100.0%)
  jpnational5     ~97,000-100,000 / 378,618  (~26%, still climbing)
  jpnationalsea      275 /     275  (100.0%)
  ```

### Also this session (before the D14/D15 work above)

- `jpkyushutest1`/`jpkyushutest5m`/`jpkyushutest10m` renamed to
  `jpnational1`/`jpnational5`/`jpnational10` (dropped the "m" suffix on
  the latter two once their old `...5m`/`...10m`-convention sibling
  entries were deleted as superseded test data — `jphakodatecity*`,
  `jphakodatetrial*`, `jpsapporo*`, `jpshakotan*`, ~3.5GB reclaimed;
  `jphokkaidodem1` deliberately left alone, frozen per D12, not a test
  entry).
- `jpnational5`/`jpnational10` expanded from the old 3900-5199
  mesh-range filter to full national scope (unfiltered
  `latest_file_list.csv.gz`). `jpnational1`'s own national expansion
  stays gated on `japan-geotiff-dem` finishing its national 1m publish
  — unrelated dependency, which is why 5m/10m went first.
- Added `jpnationalsea`: 275 GLO-30 tiles covering a bounding box (lat
  20-46N, lon 122-154E) around Japan's claimed EEZ extent, verified to
  have real tile coverage at the box's extremes — kept deliberately
  free of named-territory specifics in this repo's docs (Hidenori's
  request, practical EEZ-coverage requirement not a sovereignty
  statement).
- `japan.pmtiles` (D13, prior session) still lives on `stars`
  (`https://depot.optgeo.org/japan.pmtiles`), not re-touched this
  session.

### Next steps, in order

- [x] Confirm `jpnational10`'s `source_polygonize.py` run (new code)
      finishes clean — **done**, verified sane single-feature union
      matching the expected national extent.
- [ ] Resume `jpnational1`'s polygonize under the new code
      (`source_polygonize.py jpnational1 4`) — its `polygonize_source()`
      output is already ~18k/75,818 files in from the interrupted run,
      idempotent to continue.
- [ ] Once `jpnational1` polygonize is done: `aggregation_covering.py`
      → `aggregation_run.py` → `downsampling_covering.py` →
      `downsampling_run.py` → `bundle.py` → `merge_japan_bundles.py`
      (`TMPDIR` pointed at `/Volumes/Migrate-2025-04/tmp`, proven
      pattern from the earlier `tempfile`-bug fix) → re-upload
      `japan.pmtiles` to `stars` via `rsync` (not Source Cooperative,
      per D13).
- [ ] `jpnational5`/`jpnational10`/`jpnationalsea`: once each finishes
      downloading (5m still has a long way to go), run their own
      `source_bounds.py`/`source_polygonize.py` (now under the fast
      D15 code) and fold into a future aggregation run.
- [ ] `aalto`'s `japan-geotiff-dem` JCI 2026-09 work continues in
      parallel (Kanto-1 in progress, Chubu still has a tail — see that
      repo's own `HANDOVER.md`) — gates `jpnational1`'s eventual
      national-scope expansion.

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` work on `slate`.
> Read this file's last ~3 entries (D14: CSV manifests + aria2c
> downloader; D15: `source_polygonize.py` batched-concat rewrite; this
> closing entry) and `DECISIONS.md` D14/D15 for full technical detail
> before touching anything.
>
> **First**: `jpnational10` already confirmed D15's rewrite works end
> to end (single-feature union, correct national extent) — check
> whether `jpnational1`'s own polygonize (resumed under the new code
> right after this checkpoint was written) has finished
> (`ls polygon-store/jpnational1.gpkg`). If it hasn't been started yet
> for some reason, run `source_polygonize.py jpnational1 4` from
> `pipelines/` — its partial `polygon-store/jpnational1/*.gpkg` output
> from an earlier interrupted run should still be there and is safe to
> build on.
>
> **Then**: once `jpnational1`'s polygonize is done, continue to
> `aggregation_covering.py` → `aggregation_run.py` → downsampling →
> `bundle.py` → `merge_japan_bundles.py` (remember: `TMPDIR` pointed at
> `/Volumes/Migrate-2025-04/tmp`, not the internal SSD) → `rsync` the
> resulting `japan.pmtiles` to `stars` (`/home/stars/data/`, NOT
> Source Cooperative — SC's multipart upload kept failing on this file,
> see D13).
>
> `jpnational5` (378,618 tiles) is still downloading in the background
> and is the real scale-test for D15's rewrite once it gets to its own
> polygonize stage — don't wait on it before proceeding with
> `jpnational1`'s own pipeline above.

## 2026-08-19 (continued): checkpoint before `/clear` — `jpnationalsea` polygonize done, `jpnational1` still running, `japan.pmtiles` viewer repointed at `stars`

### Progress since the last checkpoint

- **`jpnationalsea`: fully done through polygonize.** Downloaded
  (275/275, D14 aria2c), `source_bounds.py` + `source_polygonize.py
  jpnationalsea 4` (D15 batched code) both completed clean — verified
  `polygon-store/jpnationalsea.gpkg`: `Feature Count: 1`,
  `Extent: (121.999861, 20.000139) - (153.999861, 47.000139)`,
  matching the intended national EEZ bounding box. Run **in parallel**
  with `jpnational1`'s own polygonize (small enough, ~275 files, that
  this didn't meaningfully compete for resources).
- **`jpnational1`: polygonize still running** under the D15 code,
  resumed ~19:12 JST, **not yet finished** as this entry is written
  (~2.5h+ elapsed — `jpnational10`'s own full validation run took well
  under a minute at 4,981 files, but `jpnational1` is 75,818 files —
  ~15x more — and, unlike the `merge_source()` step D15 actually sped
  up, `polygonize_source()`'s own `gdal_footprint` extraction phase
  redoes every file with `-overwrite` regardless of the ~18k already
  computed from an earlier interrupted run, so this is genuinely
  proportionally slower, not stuck). Check
  `ls polygon-store/jpnational1.gpkg`'s mtime on resume — as of this
  entry it's still `Aug 12 13:28`, the stale pre-session file; a fresh
  mtime plus `ogrinfo -so ... union` showing `Feature Count: 1` is the
  signal it actually finished.
- **`jpnational5`: still downloading**, ~47.6% (180,118/378,618) as of
  this entry. Its own `source_bounds.py`/`source_polygonize.py` haven't
  started.
- **`jpnational10`: fully done** (download + D15 polygonize), from the
  prior checkpoint.
- **Viewer repointed at `stars`**: `style.json`'s `mapterhorn` raster-
  dem source URL changed from the stale Source Cooperative object
  (`data.source.coop/.../japan.pmtiles`, ~2GB, last real update
  2026-08-09) to `pmtiles://https://depot.optgeo.org/japan.pmtiles`
  (the 70.7GB `stars`-hosted current build, D13). Verified live at
  `https://hfu.github.io/mapterhorn-japan-bridge/` after GitHub Pages'
  CDN caught up (~1min propagation delay observed) — base map and
  terrain-toggle UI render correctly. `encoding: "terrarium"` in
  `style.json` was double-checked against D11 (the orthophoto/RGB-
  encoding bug fix) before touching anything else — D11's fix defaults
  `TILE_ENCODING` to `terrarium` and the current `japan.pmtiles` build
  postdates that fix, so the existing encoding declaration is correct;
  only the URL needed to change.

### Environment note (aalto-side, not this repo, but relevant if `aalto` commands start failing)

`aalto`'s `~/Downloads` briefly became fully inaccessible
(`Operation not permitted` on `ls`/`unzip`/`rm`, while `stat` on the
directory itself still worked) — a macOS TCC/Full-Disk-Access glitch
after a Claude.app auto-update, not real data corruption. Fixed by
relaunching Claude.app. Mentioned here because it briefly looked like
a corrupted download (`chubu` Zone's Z008 pack got a false "CRC check
failed") — if something similar happens again on either machine, check
whether `stat`/`ls -ld` on the parent directory succeeds while listing
contents fails; that specific combination means TCC, not corruption.

### Next steps, in order

- [ ] Confirm `jpnational1`'s polygonize finished
      (`polygon-store/jpnational1.gpkg` fresh mtime, `Feature Count: 1`
      via `ogrinfo`).
- [ ] Once confirmed: `aggregation_covering.py` → `aggregation_run.py`
      → `downsampling_covering.py` → `downsampling_run.py` →
      `bundle.py` → `merge_japan_bundles.py` (`TMPDIR` pointed at
      `/Volumes/Migrate-2025-04/tmp`, per the earlier `tempfile`-bug
      fix) → `rsync` the result to `stars` (`/home/stars/data/`, not
      Source Cooperative — see D13). This is still against the
      Kyushu-range `jpnational1` scope, not national yet.
- [ ] `jpnational5`: keep letting it download; once done, its own
      `source_bounds.py`/`source_polygonize.py` (D15 code, real
      378,618-file scale-test) → fold into a future aggregation run
      alongside `jpnational1`/`jpnational10`/`jpnationalsea`.
- [ ] `jpnational1`'s own **national-scope expansion** (unfiltered
      `file_list.csv`, matching what `jpnational5`/`jpnational10`
      already did) is gated on `japan-geotiff-dem` finishing its
      national 1m publish on `aalto` — check that repo's own
      `HANDOVER.md`; as of this same checkpoint round, only 中部
      (Chubu) remains there, nearly done.
- [ ] Once `jpnational1` national-scope expansion happens, disk usage
      on `/Volumes/Migrate-2025-04` is worth re-checking (was 987GB
      free / 1.8TB at this checkpoint, comfortable for now — see
      Hidenori's own storage question this session) — national-scope
      `jpnational1` (~279k tiles vs current 75,818) plus a real
      national-scope `aggregation_run.py` for the first time this
      project has attempted that scale could use meaningfully more
      than anything run so far.

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` on `slate`. Read
> this file's last 4 entries (D14 CSV+aria2c, D15 polygonize rewrite,
> the jpnational10-verified checkpoint, this one) and `DECISIONS.md`
> D13/D14/D15 before touching anything.
>
> **First**: check whether `jpnational1`'s `source_polygonize.py`
> (D15 code, resumed ~19:12 JST) has finished —
> `ls -la polygon-store/jpnational1.gpkg` (fresh mtime, not
> `Aug 12 13:28`) and `ogrinfo -so polygon-store/jpnational1.gpkg
> union` (`Feature Count: 1`). If done, continue to
> `aggregation_covering.py` → `aggregation_run.py` →
> `downsampling_covering.py` → `downsampling_run.py` → `bundle.py` →
> `merge_japan_bundles.py` (remember `TMPDIR=/Volumes/Migrate-2025-04/tmp`)
> → `rsync` the resulting `japan.pmtiles` to `stars`
> (`/home/stars/data/`, **not** Source Cooperative — SC's multipart
> upload kept failing on this file, D13). If still running, just wait
> — it's the real thing this time (D15 already proven on
> `jpnational10`), not stuck.
>
> **`jpnationalsea`** is already fully done through polygonize
> (verified) — fold it into the same aggregation run once you get
> there.
>
> **`jpnational5`** (378,618 tiles) is still downloading in the
> background (~48% at last check) — the real scale-test for D15's
> rewrite once it reaches its own polygonize stage. Don't block on it.
>
> **The GitHub Pages viewer** (`https://hfu.github.io/mapterhorn-
> japan-bridge/`) now correctly points at `depot.optgeo.org/
> japan.pmtiles` (the current `stars`-hosted build) instead of the
> stale Source Cooperative object — already verified live, nothing to
> redo there.
>
> `jpnational1`'s own **national-scope expansion** (like `jpnational5`/
> `jpnational10` already got) is still gated on `japan-geotiff-dem`
> finishing its national 1m publish on `aalto` — check that repo's own
> `HANDOVER.md` for whether it's done yet before assuming you can
> start that.

## 2026-08-20: checkpoint before `/clear` — `jpnational1`/`10`/`sea` fully done through polygonize, `jpnational5` mid-polygonize (real D15 scale test), `japan-geotiff-dem` now fully national

### Big external update: `japan-geotiff-dem` (on `aalto`) finished JCI 2026-09

All 11 Zones are now complete there (北海道・東北・関東1-3・北陸・中部・
近畿・中国・四国・九州沖縄) — see that repo's own `HANDOVER.md` and
`UNopenGIS/7#978`'s final comment. This **removes the gating condition**
noted in this file's own earlier D14/D15 entries: `jpnational1`'s
national-scope expansion (matching what `jpnational5`/`jpnational10`
already did) was deliberately deferred until `japan-geotiff-dem`
finished — that's now true. **Hidenori was asked whether to proceed
with `jpnational1`'s national expansion and had not yet answered as of
this entry** — don't start it without checking first.

### Status of all four sources, this checkpoint

- **`jpnational1`** (75,818 tiles, still Kyushu-range scope): download
  + bounds + D15 polygonize all **complete and verified**
  (`Feature Count: 1`, extent `(127.63, 26.07) - (142.24, 34.67)` —
  matches the Kyushu/Okinawa/Shikoku/western-Chugoku range exactly).
  Confirms D15's rewrite works correctly at real production scale
  (75,818 files), not just the small `jpnational10` validation run.
- **`jpnational10`** (4,981 tiles, national scope): download + bounds
  + D15 polygonize all **complete and verified** (from the prior
  checkpoint).
- **`jpnationalsea`** (275 tiles, GLO-30, national scope): download +
  bounds + D15 polygonize all **complete and verified**
  (`Feature Count: 1`, extent matching the intended EEZ bounding box).
- **`jpnational5`** (378,618 tiles, national scope): download
  **complete** (378,616/378,618 — effectively 100%).
  `source_bounds.py` complete (3m49s). **`source_polygonize.py
  jpnational5 4` running now** (D15 code) — this is the real
  stress-test for D15's rewrite at genuinely large scale (~5x
  `jpnational1`'s file count); not yet finished as this entry is
  written. On resume, check `ls -la polygon-store/jpnational5.gpkg` —
  stale mtime was `Aug 13 04:07` before this run started; a fresh
  mtime + `ogrinfo -so ... union` showing `Feature Count: 1` and a
  national-extent bounding box is the completion signal.

### Next steps, in order

- [ ] Confirm `jpnational5`'s polygonize finishes cleanly (see check
      above).
- [ ] **Ask Hidenori** (if not already answered): proceed with
      `jpnational1`'s own national-scope expansion now that
      `japan-geotiff-dem` is fully national? If yes: regenerate
      `source-catalog/jpnational1/file_list.csv` unfiltered (same
      approach as `jpnational5`/`jpnational10`'s own expansion, D14's
      companion decision) from `smartmaps/japan-geotiff-dem/1/
      latest_file_list.csv.gz`, update `metadata.json`, re-download
      (aria2c, D14) and re-run bounds/polygonize (D15) at the new
      national scope.
- [ ] Once all four sources are confirmed polygonized at their final
      scope (three already national, `jpnational1` pending the above
      decision): `aggregation_covering.py` → `aggregation_run.py` →
      `downsampling_covering.py` → `downsampling_run.py` → `bundle.py`
      → `merge_japan_bundles.py` (`TMPDIR=/Volumes/Migrate-2025-04/tmp`)
      → `rsync` `japan.pmtiles` to `stars` (`/home/stars/data/`, not
      Source Cooperative — D13). **This would be the first genuinely
      national-scope `japan.pmtiles` build this project has ever
      attempted** if `jpnational1` also goes national first — disk
      usage is worth rechecking before/during that run (was 987GB free
      on `/Volumes/Migrate-2025-04` at the last check, comfortable
      margin, but this is uncharted scale for `aggregation_run.py`).
- [ ] The GitHub Pages viewer already points at the current
      `stars`-hosted `japan.pmtiles` (`depot.optgeo.org`) — no
      further change needed there once a fresh build is uploaded, it
      just needs the file at that same path/name to update.

## 2026-08-20: `jpnational1`'s national expansion decided — sequenced after this build, not before (D16); upstream-relationship policy recorded (D17); ETA estimated

**The "ask Hidenori again" from the last checkpoint is resolved.**
Asked a third time this session; his answer this time was explicit and
final for now: **build `japan.pmtiles` with `jpnational1` still
regional (Kyushu/Okinawa/Shikoku/western Chugoku) and `jpnational5`/
`jpnational10`/`jpnationalsea` national, once `jpnational5`'s D15
polygonize is confirmed correct** — don't wait to also expand
`jpnational1` first. Recorded as DECISIONS.md D16, including the
rationale: this is deliberately a chance to stress-test/tune
`aggregation_run.py`/`downsampling_run.py` at a large-but-not-largest
scale (these stages have only ever run once at real scale, back when
every source was still regional, D13) before also paying the added
cost of `jpnational1` going national too. **Don't re-propose expanding
`jpnational1` before this build — it's explicitly sequenced after, not
instead of.**

**`jpnational5` progress, as of this entry**: still in
`source_polygonize.py`'s footprint-extraction phase (screen session
`jpnational5_polygonize`, started 2026-08-20 06:13 JST), observed
throughput ~530-930 files/min across two spot-checks — several hours
left for this phase alone before the batched-concat phase even starts.
Not a failure, this is D15's real stress-test at 378,618 files (~5x
`jpnational1`'s own 75,818-file production run, which itself took
~4h17m under the *old* per-file method this rewrite replaced).

**ETA estimate for the D16 build** (reasoned, not yet measured —
`aggregation_covering.py` is a lightweight pure-Python planning step,
cheap to run for real once `slate` isn't busy with `jpnational5`, and
should replace this estimate with real numbers before trusting it for
scheduling): the prior real run (D13, 1,119 aggregation items / 2,697
downsampling items, ~33h total: ~25h22m aggregation + ~6h53m
downsampling + bundle.py's own ~16min) predates any source going
national, so its item counts don't transfer directly. Since
`aggregation_covering.py`'s macrotile grid comes from the *union* of
every source's coverage, and `jpnational10`/`jpnationalsea` already
make that union national on their own, **the D16 build's aggregation
item count should already be close to what a fully-national build
(`jpnational1` included) would need** — `jpnational1` going national
later mainly changes which macrotiles get upgraded to a 1m-priority
source (heavier per-item reprojection, same item count), not how many
macrotiles exist. Rough planning-level range: **low-single-digit days**
for the D16 build's `aggregation_run.py` + `downsampling_run.py`
combined, with a further **20-50%** on top for `aggregation_run.py`
specifically once `jpnational1` also goes national (more macrotiles
using the heavier 1m source, same total macrotile count). Treat this
as an order-of-magnitude placeholder, not a commitment — get a real
`aggregation_covering.py` item count first.

**DECISIONS.md D17 recorded**: upstream-tracking fidelity (real `git`
fork, periodic `git diff upstream/main`, merging upstream's fixes) is
now an explicit standing practice for this project, not just a
one-time thing D11 happened to do — D11's own investigation (finding
the `macrotile_z`/requantization bugs by diffing against upstream)
is the concrete evidence this pays off. Also records where `hfu/fusi`
(Hidenori's earlier, independent, non-fork DEM→PMTiles toolchain)
fits: structurally unable to benefit from the same upstream-diffing
mechanism (no `git` relationship to `mapterhorn/mapterhorn` at all),
dormant since 2025-12-19 (no commits, confirmed via `gh api`), and its
original role (feeding `jpdem1a`-style entries) now substantially
covered by this project's own `jpnational*` pipeline. **Recommends**
(does not decide) that Hidenori consider archiving `hfu/fusi` on
GitHub. Two outreach drafts (a factual `mapterhorn/mapterhorn#142`
comment reporting the 1m completion + csv.gz manifest format, and a
more personal note to Oliver Wipfli offering the D15 `gdal vector
concat` batching technique as a possibly-useful generic pattern for
Mapterhorn's own aggregation stage) were prepared this session for
Hidenori to review/post himself — not sent by Claude.

**Next steps, in order**:
- [ ] Confirm `jpnational5`'s polygonize finishes cleanly (`ls -la
      polygon-store/jpnational5.gpkg` fresh mtime, `ogrinfo -so ...
      union` `Feature Count: 1`, national-extent bbox).
- [ ] Run `aggregation_covering.py` for a real item count (cheap,
      doesn't need GDAL) — use it to replace the ETA estimate above
      with a measured one before committing to the full
      `aggregation_run.py`.
- [ ] `aggregation_run.py` → `downsampling_run.py` → `bundle.py` →
      `merge_japan_bundles.py` (`TMPDIR=/Volumes/Migrate-2025-04/tmp`)
      → `rsync` to `stars` (`/home/stars/data/`, not Source
      Cooperative — D13). Keep `slate` continuously working through
      this chain rather than checking in only at the very end.
- [ ] Once this build is live and confirmed stable, re-raise
      `jpnational1`'s national expansion with Hidenori (D16 sequences
      it after, not instead of, this build) — same recipe as
      `jpnational5`/`jpnational10` (D14).

## 2026-08-20/21: jpnational5 D15 confirmed complete at full national scale; D18-D21 found and fixed while building the first national `japan.pmtiles`; both repos' public docs cleaned up and pushed; upstream-sync planned next (D22)

**`jpnational5`'s D15 polygonize finished clean**, ~16 hours wall time
(started 06:13, done ~22:18): `Feature Count: 1`, extent
`(124.07, 24.31)-(145.82, 45.53)` — genuinely matches Japan's real
national bounding box (Yonaguni to Hokkaido). This is the real
scale-test D15 was written for (378,618 files, ~5x `jpnational1`'s own
75,818), now proven correct end to end, not just on the smaller
`jpnational10` validation run.

**`aggregation_covering.py` ran clean**: 5,875 real aggregation items
for the D16 build (`jpnational1` regional + `jpnational5`/
`jpnational10`/`jpnationalsea` national) — no code errors, first real
measurement replacing the earlier reasoned-but-unmeasured ETA guess.
`aggregation_run.py` started immediately after (`AGGREGATION_WORKERS=4`,
screen session `aggregation_run`) and is **still running** as of this
checkpoint — see D21 below for why its early throughput was
misleading, and why no confident ETA is offered here.

**Three real bugs found and fixed while this build ran, in escalating
depth** (D18 → D20 → D21, all committed and pushed to `origin`):
- **D18**: within-tier product-type priority (5a/5b/5c, 10a/10b) was
  purely alphabetical, not accuracy-based — `gdalbuildvrt`'s
  last-file-wins overlap behavior let lower-accuracy photogrammetry
  silently beat LiDAR wherever both existed for the same cell (25,522
  affected 5m cells nationally, confirmed against the live manifest).
  First fix: reorder files within one `gdalbuildvrt` group.
- **D20**: Hidenori correctly identified D18's fix as incomplete — a
  tile can contain a genuine spatial *mix* of product types, which
  deserves the same seam-aware nodata-fill/blend treatment the four
  coarser tiers (1/5/10/sea) already get via `aggregation_merge.py`,
  not a binary `gdalbuildvrt` overwrite. Fix: split the group key
  itself by product type too (7 groups instead of 4), reusing
  `aggregation_reproject.py`/`aggregation_merge.py` completely
  unchanged since both already handle an arbitrary group count. Also
  added `pipelines/lineage_inspect.py`, a standalone on-demand
  provenance-visualization tool (not wired into production), grounded
  the whole 7-tier order in `hfu/fusi`'s own real production command
  and design (`fusi` predates this fork, see D17).
- **D21**: `aggregation_run.py` stalled hard a few hours in — 45 items
  in 5.5 hours, `ps aux` showing only 1-2 of 4 workers busy while
  system CPU sat 66-92% idle. Root cause: `.todo` files are created in
  geographically-sorted order and `aggregation_run.py` reads them back
  with a plain (order-preserving) `glob()`, so spatially-clustered
  expensive tiles (one tile alone needed 1000+ source files merged)
  landed on the whole worker pool at once. Fix: `random.shuffle()`
  before handing the queue to the `Pool`. Verified live — killed and
  restarted the in-progress run (safe, `.done` markers preserved all
  110 completed items), immediately picked up completely different
  coordinates and cleared several items within 15 seconds.
- Also fixed: `source_prune_obsolete.py` (D19) — nothing had ever
  detected/cleaned local `source-store` files superseded by an
  upstream `japan-geotiff-dem` manifest refresh; built and verified
  against `jpnational1`'s real 81 orphaned files, not yet applied
  (`jpnational1` stays untouched this round per D16).

**Both repos' public-facing docs cleaned up, independently verified,
committed, and pushed to `origin`** (all confirmed live, not just
committed locally):
- This repo: added `README.md` + CC0 `LICENSE` (didn't exist before).
  GitHub Pages preview (`hfu.github.io/mapterhorn-japan-bridge/`)
  confirmed serving `200 OK`.
- `hfu/mapterhorn`: fixed a stale "Fork Note" that claimed this fork
  exists *only* for orthophoto/RGB workflows — contradicted by the
  Japan elevation pipeline that's been running here since D11. Now
  describes both purposes and cross-links this repo. Also removed two
  unused imports (`Path`, `json`) from the newly-added
  `lineage_inspect.py`.
- `japan-geotiff-dem` (on `aalto`): caught its own `source-coop/
  README.md` Changelog still showing the pre-refresh 5m count
  (378,618, all-latest) after the full 5m JCI cycle actually completed
  — fixed and re-synced via `just docs`, verified live before any
  external party (Oliver) could see stale data.

**`japan-geotiff-dem`'s own JCI 2026-09 finished 5m too, not just 1m**
(all 11 zones, executed via the same `process_pack.py` orchestrator
already proven for 1m — see that repo's own `HANDOVER.md` for the full
batch-processing narrative, including a recurring-but-fully-recoverable
`HTTP 520`/credential-expiry failure pattern). Final counts: 471,062
total (422,119 latest / 48,943 obsolete), ~47% genuinely new coverage
/ ~53% resurveys of this cycle's ~92,444 touched files.

**Reported publicly, both live**: `UNopenGIS/7#978` (5m completion,
zone table) and `mapterhorn/mapterhorn#142` (`@wipfli`, 1m+5m combined,
`.csv.gz` manifest format, multi-product-type note). A separate,
shorter personal note to Oliver (repo links, no overclaimed technical
details from the still-mid-flight build) was drafted collaboratively
with Hidenori and is his to post himself — check whether that
happened, it's outside this repo's own tracking.

**Next initiative, explicitly planned but not started: analysis-first
sync of `hfu/mapterhorn` against `upstream/main`** (D22) — 9 commits
behind as of this checkpoint, including a memory-reduction commit
directly relevant to the resource pressure observed during D21's
investigation. Sequenced *after* the current D16 build settles, not
concurrently — see D22 for the full commit-by-commit plan and the
explicit reasoning for going slow here.

### Status snapshot at this checkpoint

- `jpnational5` D15 polygonize: **done**, verified.
- `aggregation_covering.py`: **done**, 5,875 items.
- `aggregation_run.py`: **running** (D21 shuffle applied ~05:22
  2026-08-21; check `find aggregation-store/*/  -name '*.done' | wc -l`
  — was 149/5,875 at this checkpoint, throughput still being
  re-measured post-shuffle, no confident ETA yet).
- `jpnational1` national expansion: still deliberately deferred (D16).
- Upstream sync: planned (D22), not started.
- Both repos pushed to `origin`, confirmed via `git status -sb`.

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` on `slate`. Read
> this file's 2026-08-20/21 entries plus `DECISIONS.md` D16-D22 before
> touching anything.
>
> **First, check what's actually running**: `screen -ls` and
> `find aggregation-store/*/  -name '*.done' | wc -l` (out of 5,875
> total items) to see how far `aggregation_run.py` has gotten. Item
> cost is highly uneven (D21) — don't linearly extrapolate an ETA from
> a short observation window, and don't assume it's stalled just
> because progress looks slow over a few minutes; check `ps aux` for
> active `gdal_translate`/`gdalwarp` processes and fresh PIDs/CPU time
> before concluding anything is actually stuck.
>
> **If `aggregation_run.py` has finished** (todo count reaches 0, or
> the screen session has exited with `time` output in
> `/tmp/aggregation_run.log`): continue to `downsampling_covering.py`
> → `downsampling_run.py` → `bundle.py` → `merge_japan_bundles.py`
> (`TMPDIR=/Volumes/Migrate-2025-04/tmp`) → `rsync` to `stars`
> (`/home/stars/data/`, **not** Source Cooperative — D13). This would
> be the first genuinely national-scope `japan.pmtiles` this project
> has built — recheck disk usage on `/Volumes/Migrate-2025-04` before
> the downsampling stage (was 977GB free at the last checkpoint).
>
> **If it's still running**: just let it continue (D13's own
> precedent — this pipeline is designed to run unattended for many
> hours). Check in periodically rather than intervening.
>
> **Once the build is live and stable, two things are queued, in this
> order**:
> 1. Re-raise `jpnational1`'s own national expansion with Hidenori
>    (D16's own next-step, same recipe as `jpnational5`/`jpnational10`,
>    D14) — deliberately held off until now.
> 2. **The bigger one**: start the analysis-first upstream sync (D22)
>    — `git fetch upstream` on `hfu/mapterhorn`, re-check how far
>    behind it is now (9 commits as of 2026-08-21, will have grown),
>    and go through D22's commit-by-commit plan starting with the
>    memory-reduction commit (`57f8481` as of this checkpoint's SHA,
>    re-verify the actual commit hash after fetching since upstream
>    moves). Read D22's full reasoning before starting — this is meant
>    to be careful and unhurried, not a bulk merge.
>
> Also worth a quick check: whether Hidenori's personal outreach note
> to Oliver Wipfli (repo links, drafted but not tracked in this repo)
> was actually posted, and whether he's decided anything about
> archiving `hfu/fusi` (D17, a recommendation only, never acted on).
>
> `japan-geotiff-dem` (on `aalto`) has no further queued work of its
> own — both 1m and 5m JCI 2026-09 cycles are complete and reported.

## 2026-08-22: jpnational5 fully refreshed and prepared (download -> prune -> bounds -> polygonize, all complete)

Following on from the 2026-08-21 session (D22 LERC/ZSTD verdicts, D23
strategy, D25 hole-free design, D26 gzip manifests, D28 case-
sensitivity bug): `jpnational5`'s full refresh pipeline finished
end to end, unattended overnight, with Hidenori's Kyushu-scope test
build (D16/D27) paused throughout to give it full CPU.

**Sequence, timestamps approximate**:
- ~06:26 (Aug 21): `jpnational5` manifest regenerated from
  `japan-geotiff-dem`'s national 5m `latest_file_list.csv.gz`
  (422,119 rows).
- ~06:28: 48,943 now-obsolete local files pruned to
  `source-store/jpnational5-stale/` (`source_prune_obsolete.py --apply`).
- ~06:28-16:26: aria2c download of the ~92k net-new files, running
  concurrently with the Kyushu build (network-bound, no real CPU
  contention) -- completed 100%, 422,119/422,119 verified.
- ~17:27-17:44 (D27's trigger point -- Kyushu build paused here):
  `source_bounds.py jpnational5` -- single-threaded, 422,119 files,
  ~17 min, bounds.csv jumped from the stale 378,617-line file straight
  to 422,120 lines in one atomic write (the script builds the whole
  list in memory, only writes once at the end -- confirmed by reading
  its source, not assumed).
- ~17:45 (Aug 21) - 05:24 (Aug 22): `source_polygonize.py jpnational5 8`
  -- ~10h for the `gdal_footprint` extraction phase (422,119 files,
  8-way parallel), then ~1h for D15's batched `gdal vector concat`
  merge (141 batches of 3,000), then a further ~12 min for the final
  `ogr2ogr ST_Union(ST_MakeValid(...))` step, then a few more minutes
  for `shutil.rmtree()` cleanup of the 422,119 individual per-mesh
  gpkg files. Total polygonize wall-clock: ~11.7 hours.
- 5 non-fatal "Simplification resulted in empty geometry" GDAL
  warnings encountered during footprint extraction (investigated
  live, D-entry not yet written up separately from this one): confirmed
  via `ogrinfo` that the affected output files genuinely have 0
  features, but also confirmed via `grep -rl polygon-store *.py` that
  `aggregation_covering.py` never reads `polygon-store` at all (it
  uses `bounds.csv`, unaffected) -- only `list_used_sources.py`
  (diagnostic report) and `source_create_tarball.py` (public
  distribution artifact) consume it. **No impact on the actual
  aggregation pipeline or `japan.pmtiles` output** -- worth a real fix
  only if/when `jpnational5` is ever distributed as a public tarball.

**Final state, verified**: `source-store/jpnational5` 422,119 tifs,
`bounds.csv` 422,120 lines, `polygon-store/jpnational5.gpkg` 93.8MB
(national union), `polygon-store/jpnational5/` (the per-mesh
intermediate directory) cleanly removed. Fully consistent, ready for
the next `aggregation_covering.py` pass.

**Also found and fixed during this run, unrelated to jpnational5
specifically but discovered while watching its polygonize log**: D28,
`get_product_type_rank()`'s case-sensitive regex bug (6,677 legacy
lowercase-named files across all three national sources misranked as
tier-A) -- see `DECISIONS.md` D28 for full detail, already committed
and pushed (`5373993`).

**Concurrently**: `jpnational1`'s own download (started ~06:23 Aug 21,
network-bound, shared CPU freely with both the Kyushu build and
`jpnational5`'s polygonize without measurable mutual slowdown) reached
100% (291,779/291,779 per the manifest) around 02:08 (Aug 22) after
~19h45m; 8 files then turned up genuinely missing on a direct
manifest-vs-disk diff (small files, likely transient mid-run
failures) -- re-running `source_download.py jpnational1` (idempotent,
re-verifies the whole manifest before fetching the delta) is in
progress as this entry is written, 7 of 8 still outstanding.

**Next**: once `jpnational1`'s last few files land, per D27 this marks
the true end of the Kyushu-scope test build's active phase (already
paused since ~17:27 Aug 21, final tally 2,170/5,875 items, ~36.9% of
that generation). D23's "step 3" -- a fresh `aggregation_covering.py`
pass reflecting `jpnational5`'s now-current national coverage -- is
the next real decision point, alongside the long-deferred question of
whether to also trigger `jpnational1`'s own D14-style national
expansion now that its regional-scope download is fully current.
Neither started yet as this entry is written -- Hidenori's call on
timing and scope, not assumed.

### Session close, 2026-08-22 06:28 (continuing directly from the entry above)

Wrapping up this session (Hidenori clearing context). Full decision
log for everything below: `DECISIONS.md` D22 through D28, all in this
same session, all committed and pushed to `hfu/mapterhorn` (`main`,
`5373993` is the latest as this is written). Read those entries in
full before resuming, not just this summary.

**State at close-out**:
- `jpnational5`: **fully done** — download, prune (48,943 obsolete ->
  `jpnational5-stale/`), `source_bounds.py`, `source_polygonize.py`
  all complete and verified consistent (422,119 tifs, 422,120-line
  bounds.csv, 93.8MB national union `polygon-store/jpnational5.gpkg`).
- `jpnational1`: 291,772/291,779 — **7 files still outstanding** as
  this entry is written. `source_download.py jpnational1` is running
  (re-invoked after the first 100% pass turned up 8 genuinely missing
  files on a direct manifest-vs-disk diff; 1 has since landed). This
  re-run re-verifies the *entire* manifest via checksum before
  reaching the still-missing delta, which is why it's taking hours,
  not the CPU contention this project has seen elsewhere — confirmed
  alive and progressing (CPU time climbing, current mesh code
  advancing) via direct process inspection each time this was
  checked, not assumed. **Check `find source-store/jpnational1 -name
  "*.tif" | wc -l` against 291779 first when resuming** — likely
  finished or very close by then.
- Kyushu-scope test build (D16/aggregation_id
  `01M0FNHYXSAMNVTV430XD3XB5T`): **paused since ~17:27 (Aug 21) per
  D27**, final tally 2,170/5,875 items (~36.9%) for this generation.
  Its own remaining purpose was already exhausted (D22's ①②③
  decisions and D25's hole-free design were both validated live
  against it earlier in the session) — not planned to resume as-is;
  superseded by the next `aggregation_covering.py` pass (D23's
  "step 3").

**This session's other durable outcomes** (all in `DECISIONS.md`,
not re-derived here):
- D22: GDAL memory-reduction flags + heterogeneous-projection check
  adopted from upstream `57f8481`; LERC compression tested and
  **dropped** (25-35x slowdown on repeatedly-read intermediates);
  ZSTD_LEVEL=1 tested and **adopted** (no throughput cost, ~50%
  smaller intermediates); the multi-host `worker.py`/`downloader.py`
  machinery (`57f8481`'s other half) explicitly **not adopted** —
  this fork is single-host and doesn't need it. All 9 commits in the
  `fdd6adc..ef97ada` upstream queue reviewed and resolved
  commit-by-commit.
- D23: two-week phased strategy (upstream sync -> pause Kyushu ->
  `jpnational1` national expansion -> incremental national build) —
  Hidenori's own target cadence for the eventual incremental
  publish loop: roughly every half-day to a day, early on.
- D24: pipeline-wide "rational for Oliver's environment, not
  necessarily rational for ours" audit. Found `downsampling_run.py`'s
  `CENTER_LAT`/`CENTER_LON` still default to Freetown (never
  overridden for any Japan run to date) — and more importantly, the
  whole radial-distance-from-one-point priority model is a poor fit
  for Japan's elongated shape regardless of the coordinates.
- D25: hole-free, progressive execution design for the eventual
  incremental national build — implemented (`utils.japan_quadrans_of()`,
  `downsampling_run.py`'s `PRIORITY_MODE`/`DOWNSAMPLING_STRICT` env
  vars, both default-off/unchanged-behavior), tested against real
  data. Hidenori's priority order for quadrans batching: **北日本 ->
  南日本 -> 東日本 -> 西日本** (his own stated preference, not derived
  from anything technical — honor it when this actually gets wired
  into the publish loop).
- D26: source-catalog manifests now `.csv.gz` (gzip -9, ~21% of
  plain-CSV size) instead of Git LFS — resolves the GitHub 50MB
  file-size warning `jpnational5`'s refresh tripped. `utils.
  open_manifest()` used by all three consumer scripts, backward
  compatible with any source still on plain `.csv`.
- D27: decided (and executed) to pause the Kyushu build once
  `jpnational5`'s own CPU-bound post-download phase started, rather
  than let them compete — the Kyushu build's own output was already
  going to be superseded regardless.
- D28: found and fixed a real bug, incidentally, while watching
  `jpnational5`'s polygonize log scroll by — `get_product_type_rank()`'s
  regex was uppercase-only, silently misranking 6,677 legacy
  lowercase-named files (`jpnational10`: 95.9% of its entire file set)
  as tier-A. Fixed with `re.IGNORECASE`. A good reminder that this
  kind of thing surfaces from *watching* a live run closely, not just
  from deliberate audits.

**Next, in order, once resumed** (none started yet):
1. Confirm `jpnational1` reached 291,779/291,779 (or diagnose if not
   — the 7 remaining files' exact names were logged this session,
   search this entry's own earlier "missing" list in scrollback/git
   history if needed, or just re-run the manifest-vs-disk diff).
2. Decide with Hidenori: re-raise `jpnational1`'s own national
   expansion now (D16's original next-step, same D14 recipe as
   `jpnational5`/`jpnational10`), given its regional-scope data is
   now fully current — or proceed straight to D23's "step 3" rebuild
   with `jpnational1` still regional. Not decided this session.
3. D23's "step 3": a fresh `aggregation_covering.py` pass reflecting
   `jpnational5`'s national refresh (and possibly `jpnational1`'s
   national expansion, depending on (2)) — this starts a **new**
   `aggregation_id` generation; the paused Kyushu generation's own
   `.done` progress does not carry forward.
4. Before that pass: D23 point 4's "clean suspect intermediate data"
   concern — re-examine whether anything in `pmtiles-store`/
   `bundle-store`/`meta-store` from the old regional-scope generation
   needs invalidating, not just `tmp-store` (already proven safe to
   clean this session, twice).
5. Wire D25's hole-free design into an actual periodic publish loop
   (the readiness-filter + `PRIORITY_MODE=quadrans` + `DOWNSAMPLING_
   STRICT=1` pieces are built and tested in isolation, but not yet
   assembled into the real automation D23 envisions) — pick a chunk
   size/cadence once real national-scale aggregation throughput is
   known, targeting Hidenori's half-day-to-a-day early cadence.
6. D20's still-deferred real-data validation (20 random overlapping-
   source samples via `lineage_inspect.py`, checking for seam
   artifacts/NODATA handling) — postponed this session for CPU-load
   reasons (D22's build was competing for cores at the time); revisit
   once there's genuine headroom.

Converse in Japanese, per this repo's own language policy (top of
this file) — same as `japan-geotiff-dem`'s.

## 2026-08-22: Pre-launch capacity/correctness test campaign for the incremental national build (D28-D34)

Session run from `aalto` via SSH (`slate-via-spacex`), not on `slate`
directly — same repo, remote operation. Full decision log:
`DECISIONS.md` D28 through D34, all this same session. Framed by
Hidenori as an "Artemis launch" campaign: thorough ground testing of
every pipeline stage before committing to the real, hard-to-reverse
national `aggregation_covering.py` pass (D23's "step 3").

**State at close-out**:
- **`jpnational1`: national-scope download COMPLETE and independently
  verified** (D34) — 291,779/291,779 files, 20-sample hand-recomputed
  MD5 check all matched. `aria2c`'s own re-verification pass was still
  finishing up as this was written (2 processes alive, ~163min CPU
  time) — let it exit on its own, don't kill it.
- **`jpnational5`: already complete** (prior session) — download,
  prune, bounds, polygonize all done and verified.
- Both national sources ready means **D23's "step 3" (fresh national
  `aggregation_covering.py`) is now unblocked** — the actual "launch."
  **Not started this session.**
- **Before that launch**: `jpnational1`'s own `source_bounds.py`/
  `source_polygonize.py` need a re-run — the existing bounds/polygon
  data predates the final 7 files that landed this session. Don't trust
  `jpnational1`'s coverage in a new `aggregation_covering.py` pass
  without refreshing this first.
- **Kyushu-scope test build** (`aggregation_id 01M0FNHYXSAMNVTV430XD3XB5T`,
  D16/D27): resumed briefly this session for a concurrent-load capacity
  test (D32), then paused again — `.done` count around 2,600-2,700/5,875
  as of the last check, still not planned to resume as its own
  deliverable (superseded once the real national generation starts).
  **This generation now has some small, permanent gaps** from the D29
  orphan-deletion incident — harmless since it's throwaway, but don't
  be surprised if a future `bundle.py`/`downsampling_run.py` run
  against it hits a handful of already-known missing-children skips.
- **`lineage_inspect.py`**: real bug found and fixed (D28, colors were
  mismapped for any tile missing a tier) — committed and pushed to
  `hfu/mapterhorn` (`01f42ff`).
- **`merge_japan_bundles.py`**: real OOM risk found and fixed (D30,
  mmap → seek+read, 9GB RSS → ~50MB) — committed and pushed
  (`f0240a0`).
- **`bundle.py`**: granularity bottleneck found (one dense region
  dominates wall-clock regardless of worker count) and a scheduling fix
  applied (D31, largest-first + chunksize=1) — **verified clean once**,
  a **second clean verification (`bundle_rehearsal3`, screen session)
  was still running as this was written** — check `/tmp/bundle_
  rehearsal3.log` and `screen -ls` first when resuming; if it finished
  since, this fix is fully confirmed and worth committing to git (not
  yet committed — only deployed live on `slate`, not checked into
  `hfu/mapterhorn`).
- **`pmtiles-store` staleness** (D23 point 4, D29): audited, 2,215
  confirmed-orphan files deleted (16.16GB freed) — **but the deletion
  process itself had a real incident** (see D29 in full: a flawed
  orphan test plus a delete-while-reading race that crashed a bundle.py
  rehearsal). One downsampling item's stale `.done` marker was found
  and cleared as the one genuinely dangerous piece of fallout. Read
  D29's "lesson recorded" paragraph before ever cleaning `pmtiles-
  store`/`bundle-store`/`aggregation-store` again — don't delete while
  any pipeline process might be reading, and don't use "matches a
  current aggregation-item key" alone as an orphan test.
- **Operating model decided** (D32): `aggregation_run.py` runs
  continuously once the real build starts (never paused for publishing);
  the publish pipeline is a single, non-overlapping, externally-
  scheduled cycle; default worker counts kept as-is (measured: load
  11-14/10 cores sustained for over an hour with no thrashing); cadence
  starts at once/day.
- **`publish_cycle.py` written** (D33) — assembles the full readiness-
  gated downsampling → bundle → merge → rsync-to-stars cycle behind a
  `flock()`. **Not yet run for real** — its first real execution should
  be part of the real national build's first publish cycle, not before.
  `rsync` target verified reachable via `--dry-run` only.

**Not yet committed to git on `slate`** (all live-deployed, not pushed):
`pipelines/bundle.py` (D31 fix), `pipelines/publish_cycle.py` (D33, new
file), `pipelines/check_downsampling_readiness.py` (new file, D25's
readiness-filter report tool), `pipelines/check_disk_headroom.py` (new
file, disk monitoring loop). Commit these once `bundle_rehearsal3`
confirms clean, alongside a `git status --short` sanity check.

**Also still running as background `screen` sessions on `slate`** as
this was written: `disk_headroom` (15-min disk-space logging loop,
harmless, fine to leave running indefinitely), `bundle_rehearsal3`
(the pending clean re-verification above). Check `screen -ls` on
resume.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, most recently
> worked via SSH from `aalto` (`slate-via-spacex`). Read `DECISIONS.md`
> D28 through D34 and this file's own "2026-08-22: Pre-launch capacity/
> correctness test campaign" entry in full before touching anything.
>
> **First, check what's actually running**: `screen -ls` on `slate` for
> `bundle_rehearsal3` (a pending clean re-verification of D31's bundle.py
> fix) and `disk_headroom` (harmless, leave running). Check `ps aux |
> grep aria2c` — should have exited cleanly by now (jpnational1's own
> re-verification pass); if somehow still running, just let it finish.
>
> **If `bundle_rehearsal3` finished clean**: commit the four uncommitted
> files listed above (`git status --short` first) to `hfu/mapterhorn`,
> push, then proceed to the real launch sequence below. **If it also
> crashed or shows a real regression**: don't launch yet — diagnose
> first, per D29's own lesson about not assuming a clean environment.
>
> **Real launch sequence, once bundle_rehearsal3 is confirmed clean and
> committed** (this is D23's "step 3", genuinely the point-of-no-return
> event this whole session's testing campaign was preparing for):
> 1. Re-run `jpnational1`'s `source_bounds.py`/`source_polygonize.py`
>    (its existing data predates the final 7 files from this session).
> 2. Run a fresh `aggregation_covering.py` against the full national
>    union (`jpnational1`+`jpnational5`+`jpnational10`+`jpnationalsea`,
>    all national now) — this starts a **new** `aggregation_id`
>    generation; the Kyushu-scope generation's own `.done` progress does
>    not carry forward (expected, per D27).
> 3. Start `aggregation_run.py` for real, continuously (D32's operating
>    model — do not pause it for publishing).
> 4. Once enough of the new generation is done to be worth a first
>    publish, run `publish_cycle.py` for its first-ever real execution
>    (D33) — this is also that script's own first real test, watch it
>    closely the first time.
> 5. Set up `publish_cycle.py` on a daily external schedule (cron/
>    launchd) once step 4 confirms it works end to end.
>
> Converse in Japanese, per this repo's own language policy.


### Addendum, same session, shortly after the entry above

`bundle_rehearsal3` finished clean: `DONE_EXIT_0`, 23 files, and
**~18 minutes total** (vs the pre-fix run's 77 minutes) -- D31's
scheduling fix confirmed working as intended, both workers observed
busy from early on. The four previously-uncommitted files (`bundle.py`,
`publish_cycle.py`, `check_downsampling_readiness.py`,
`check_disk_headroom.py`) are now committed and pushed to
`hfu/mapterhorn` (`bb4f17f`). `pipelines-rehearsal/` removed (53GB
reclaimed). `aria2c` (jpnational1's tail-end verification) was still
running as this was written -- harmless, let it finish on its own.

**Nothing else outstanding from this session.** Next real step is the
resume-prompt's step 1 (refresh jpnational1's bounds/polygonize) then
straight into the real launch sequence.

## 2026-08-22 (late session): jpnational1 data quality issue found and partially fixed -- see DECISIONS.md D35

Session paused here, Hidenori away ~20h. Full detail: DECISIONS.md D35
(this repo) + japan-geotiff-dem's own DECISIONS.md D18 (the actual bug
and fix live in that separate repo/session on aalto). Short version:
found a silent data-corruption bug affecting a small, geographically-
localized subset of jpnational1's 1m source data (mesh4 4929/4930
specifically) -- 38 of 45 known-bad files already fixed upstream and
in this repo's own source-store; manifest regeneration and the
remaining 7 files are the next concrete steps. Hidenori's explicit call:
proceed toward the real national launch (D23 step 3) accepting the
small residual risk, rather than blocking on a full sweep first.

Resume prompt is in DECISIONS.md D35 (not duplicated here) -- read that
entry in full, plus japan-geotiff-dem's own D18, before resuming.

## 2026-08-22 (resumed, Hidenori back): manifests refreshed, real national launch executed

Full detail in `DECISIONS.md`'s addendum under D35 -- short version:

1. Refreshed `japan-geotiff-dem`'s manifest (`source-coop login` +
   `just filelists 1` on `aalto`) and this repo's own `source-catalog/
   jpnational1/file_list.csv.gz` to match, confirming the 38 D18-fixed
   files' checksums now agree end to end (upstream manifest, this
   repo's manifest, and local `source-store` bytes all match). Also
   published a Changelog entry on `japan-geotiff-dem`'s own public
   `source-coop/README.md` (`just docs`).
2. Confirmed `jpnational1`'s `bounds.csv`/`polygon-store` (already
   refreshed earlier today, before this resumed session) are not stale
   relative to the 38 corrected files -- see addendum for why this
   doesn't actually matter either way.
3. **Ran D23's "step 3" for real**: fresh national `aggregation_
   covering.py` -> new generation `01M0MWK852631SHCHPA66F21WQ`, then
   started `aggregation_run.py` continuously (1,979 dirty items, 4
   workers, per D32's operating model). **This is the real national
   build. Currently running.** Check `screen -ls` for
   `aggregation_run_national` and `tail aggregation_run_national.log`
   / `.done` file count under `aggregation-store/
   01M0MWK852631SHCHPA66F21WQ/` to see live progress.
4. Extended D18's decode-validity screening (generalized into the new
   `screen_source.py`, replacing the old hardcoded `screen_
   jpnational1.py`) to `jpnational5`/`10`/`sea`: **all clean, no
   corruption found** -- `jpnational5`'s 2,062 "0% valid" files turned
   out to be a structurally distinct, legitimate-empty-tile signature
   (uniform 506-byte files, nationwide scatter), not D18's bug. Detail
   in `DECISIONS.md`.

**Not yet done, left for whoever resumes next**:
- The 38-fix's remaining loose ends from D35 are still open: the 7
  silent-corruption files not yet re-uploaded/re-copied, and the
  4929/4930 comprehensive sweep (73/109 meshes unchecked) -- both
  still deliberately deferred per Hidenori's own residual-risk call,
  not blockers.
- `aggregation_run.py` is running continuously and should be left
  running (D32: never pause for publishing). Once enough of the 1,979
  items are `.done` to be worth a first publish, move to `publish_
  cycle.py`'s first real execution (HANDOVER's earlier resume-prompt
  steps 4-5 still apply).

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex`). Read `DECISIONS.md`'s D35 and its
> 2026-08-22 addendum in full first.
>
> **Check what's running**: `screen -ls` on `slate` for
> `aggregation_run_national` (the real national build, started this
> session -- should still be running, do not stop it) and
> `disk_headroom` (harmless). `tail -f pipelines/aggregation_run_
> national.log` and compare `.done` count under `pipelines/
> aggregation-store/01M0MWK852631SHCHPA66F21WQ/` against the "1,979
> dirty items" starting count for progress.
>
> **Once meaningfully far along** (Hidenori's own past framing: no
> hard chunk-size commitment yet, judge based on real throughput --
> see D23 point 5's still-open design question about incremental
> publish chunk sizing before automating this): run `publish_cycle.py`
> for its first-ever real execution, watch it closely.
>
> Converse in Japanese, per this repo's own language policy.

## 2026-08-23: `publish_cycle.py` first real run, verified live, national build continuing

Full detail: `DECISIONS.md` D36. Short version: ran `publish_cycle.py`
for real for the first time (downsampling -> bundle -> merge -> rsync),
clean end to end, ~1h17m total. Confirmed live on `depot.optgeo.org`/
`stars.optgeo.org` (content-length + martin catalog), and visually
confirmed real 1m terrain detail rendering in the GH Pages viewer at
one of the actually-completed aggregation items' coordinates
(Shin-Kamigoto / Goto Islands). `downsampling_run.py` had 0 files to
process this cycle (not enough sibling `.done` items yet for any
parent to be ready) -- expected this early, not a problem.

`aggregation_run.py` (the national build itself, generation
`01M0MWK852631SHCHPA66F21WQ`) is continuing uninterrupted per D32 --
**102 / 1,979 dirty items done** as of this checkpoint (~7h in), load
average steady around 5.6-5.8/10 cores, disk headroom stable
(~749GB free on `/Volumes/Migrate-2025-04`). Per-item cost is uneven
(D21) -- don't linearly extrapolate a confident ETA from this alone,
but the current pace suggests several more days, consistent with
D23's own original expectation.

**Next steps, in order**:
- Keep `aggregation_run.py` running (screen session
  `aggregation_run_national`) -- never pause it for publishing (D32).
- Re-run `publish_cycle.py` periodically as more items complete (no
  fixed chunk size decided yet -- D23 point 5's own open design
  question about incremental chunk sizing is still open; for now,
  running it opportunistically when checking in seems reasonable
  given how cheap this first cycle turned out to be when there's
  little new to process).
- Once downsampling actually has real work to do (some parent's full
  child set finally `.done`), that's the point to also visually
  re-verify at a lower zoom (the overview pyramid), not just the leaf
  zoom confirmed this session -- D36's recipe generalizes to that too,
  just pick a lower-zoom macrotile.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex`). Read `DECISIONS.md` D35 (+ its
> addendum) and D36 before touching anything.
>
> **Check what's running**: `screen -ls` on `slate` for
> `aggregation_run_national` (should still be running -- do not stop
> it) and `disk_headroom`. Compare `.done` count under `pipelines/
> aggregation-store/01M0MWK852631SHCHPA66F21WQ/` against the 1,979
> total dirty items for progress; don't assume it's stalled from a
> short observation window (D21).
>
> **To publish an update**: run `uv run python3 publish_cycle.py`
> (flock-protected, safe to invoke any time -- see D36 for what a
> clean run looks like and how to spot-check the result live,
> including the visual-verification recipe using a real completed
> item's coordinates).
>
> Converse in Japanese, per this repo's own language policy.

## 2026-08-23/24: D23 step 3 real launch, a ~7h blackout survived cleanly, worker tuning (D38/D39), storage trajectory found (D40)

Long session spanning `aalto`'s own `/clear` boundary -- full technical
detail lives in `DECISIONS.md` D35 (+ addendum) through D40. This entry
is the session-level orientation for whoever resumes after `/clear`.

**Where things stand right now** (2026-08-24 06:22 JST): `aggregation_
run.py` (generation `01M0MWK852631SHCHPA66F21WQ`) running continuously
in `screen` session `aggregation_run_national`, `AGGREGATION_WORKERS=4`,
**450/1,979 aggregation items done** (~22.7%). `downsampling` at
**1,790/5,382 done** (lagging behind aggregation as expected -- more
succeed each time `publish_cycle.py` runs and more aggregation items
have completed). `publish_cycle.py` not currently running (last run,
"cycle 5b", finished clean at 00:16:50 -- `japan.pmtiles` now
107,966,785,627 bytes / 951,005 tiles, live on `depot.optgeo.org`).
Load average steady ~5.5/10 cores, free disk ~606GB. All healthy.

**What happened, in order**:
1. **D35 resumed**: refreshed `japan-geotiff-dem`'s manifest (38
   corrected files from the earlier corruption fix), regenerated this
   repo's own `jpnational1/file_list.csv.gz` to match, ran a fresh
   ground-truth sweep of 53/109 already-downloaded 4929/4930 meshes
   (3,768 individual files) -- all clean, two real methodology bugs
   found and fixed along the way (see `japan-geotiff-dem`'s own D18
   addendum). 56 meshes and the previously-flagged 7 "silent" files
   remain unswept -- still deliberately paced thin-and-long, not
   urgent given the residual-risk call already made.
2. **D23 step 3 actually executed**: fresh national `aggregation_
   covering.py` (new generation, 8,354 items, 1,979 dirty against the
   old Kyushu-scope test generation), then `aggregation_run.py`
   started for real and has been running continuously since
   (2026-08-22 23:09, survived a mid-flight worker-count restart
   twice -- see below -- with zero data loss both times, confirmed via
   `.done`/`.todo` accounting matching exactly across each restart).
3. **`publish_cycle.py` run 5 times** (D36-D39): first run validated
   the whole chain end-to-end; a real, reproducible `bundle.py` crash
   (D37) was hit twice (`FileNotFoundError` when `aggregation_run.py`
   replaces a `pmtiles-store` file mid-read) -- harmless, just retried
   both times, **still not fixed in `bundle.py` itself**, flagged as a
   known gap for whoever next touches that file. A structural gap was
   found and fixed: `downsampling_covering.py` (the one-time-per-
   generation candidate-list builder, analogous to `aggregation_
   covering.py`) had never been run for this generation, meaning
   `downsampling_run.py` could never produce anything no matter how
   much aggregation completed -- fixed by running it once (D38).
4. **A ~7-hour blackout was survived cleanly** (Hidenori's own
   framing: an "in-orbit restart" test on the priority process,
   deliberately timed while `slate` couldn't be observed or
   intervened on). Everything kept running unattended in `screen`
   sessions and was found healthy on reconnect.
5. **Worker tuning, twice** (D38 then D39): first tried
   `AGGREGATION_WORKERS` 4->3 (paired with the default
   `DOWNSAMPLING_WORKERS=5`) during the blackout -- measured ~79% of
   baseline throughput, but confounded by nearly the entire window
   also running a concurrent `publish_cycle`. After the blackout,
   reallocated to **`AGGREGATION_WORKERS=4` (restored, unconditional
   priority) + `DOWNSAMPLING_WORKERS=3`** (D39, committed into
   `publish_cycle.py` itself, not just an env var) -- this combination
   was then measured cleanly: aggregation ran at ~13.2 items/hour
   *while* two full publish cycles ran concurrently, vs. ~14.1
   items/hour with no publish cycle running at all. **Only ~7%
   overhead** -- confirms D39's reallocation successfully protects the
   priority process from the secondary one, much better than the
   D38 configuration did.
6. **D40, storage trajectory concern found** (not yet acted on):
   `pmtiles-store` + `bundle-store`'s `japan.pmtiles` together already
   show real triple-redundancy for the same elevation data (raw
   per-item archives / regional bundles / final merged file). Naive
   linear extrapolation from the current ~22% completion projects
   roughly **~770GB more** needed for just the existing elevation
   product to reach 100%, against only ~600GB currently free.
   Hidenori's own call: **investigate the D23-point-4 old-Kyushu-test-
   generation cleanup carefully as the leading mitigation**, before
   storage actually becomes a hard blocker -- not urgent this exact
   moment, but flagged as the next real piece of work.
7. **A lineage/provenance tileset was discussed and deliberately NOT
   started** -- `lineage_inspect.py` is intentionally a single-tile,
   on-demand PNG diagnostic only (D20's own scope decision), not a
   tileset generator. Building a real lineage tileset would need new
   production-pipeline code and its own storage budget on top of
   D40's already-tight picture -- explicitly deferred, not scheduled.

**Next steps, in priority order for whoever resumes**:
1. **Design and execute the D40 storage mitigation**: audit exactly
   how much of `pmtiles-store`/`bundle-store` belongs to the old
   Kyushu-test generation (`01M0FNHYXSAMNVTV430XD3XB5T`) vs. the
   current national one, apply D29's own lesson (verify before
   deleting, never delete while any pipeline process might be
   reading) before removing anything. Do this before the free-space
   trajectory actually becomes a blocker, not after.
2. Keep `aggregation_run.py` running uninterrupted (never pause it
   for publishing, per D32 -- still the standing model). Re-run
   `publish_cycle.py` periodically; D39's `(4,3)` worker split is now
   the committed default in `publish_cycle.py` itself, no need to
   re-specify it by hand.
3. D35's own remaining items (56/109 4929/4930 meshes, 7 unidentified
   silent-corruption files) stay paced thin-and-long, whenever
   convenient -- not urgent.
4. **Note on monitoring continuity**: this session ran a 15-minute
   status-check loop via a local `Monitor` background task (checking
   `aggregation_run.py`/`publish_cycle.py`/disk via SSH). That task is
   tied to this specific session and will not survive `/clear` --
   whoever resumes should set up fresh monitoring if continuous
   observation is wanted again, rather than assuming it's still
   running.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth). Read `DECISIONS.md` D35 through D40 in full before
> touching anything -- this was a long, dense session; don't skip any
> of them.
>
> **First**: `screen -ls` for `aggregation_run_national` (should still
> be running -- the priority process, never intentionally stopped) and
> check its `.done` count (`find pipelines/aggregation-store/
> 01M0MWK852631SHCHPA66F21WQ -name '*-aggregation.csv.done' | wc -l`,
> out of 1,979) against this entry's 450 to gauge elapsed progress.
> Also check `df -h /Volumes/Migrate-2025-04` against this entry's
> ~606GB free -- if it's dropped substantially, D40's storage concern
> may already be biting; if so, that becomes the priority over
> anything else below.
>
> **Then**: decide whether to tackle D40's storage cleanup now (audit
> old-Kyushu-generation `pmtiles-store`/`bundle-store` footprint,
> confirm safe to delete per D29's lesson, then actually free it) or
> keep deferring -- check current free space trend first, don't guess.
>
> **Otherwise**: business as usual -- `publish_cycle.py` can be run
> any time (its `DOWNSAMPLING_WORKERS=3`/`BUNDLE_WORKERS=2` are
> already committed defaults), `aggregation_run.py` keeps running
> unattended regardless. Set up a fresh monitoring loop if continuous
> observation is wanted (the previous session's was tied to that
> session, not persistent).
>
> Converse in Japanese, per this repo's own language policy.


## 2026-08-24〜26: D35 corruption investigation closed, Oliver correspondence (D42), publish_cycle crash-rate analysis + bundle.py race fix (D44), downsampling completion-guarantee audit + fix (D45)

Bridges two sessions this entry hadn't yet covered -- full technical
detail lives in `DECISIONS.md` D35's closing addendum through D45.
This entry is the session-level orientation for whoever resumes.

**Where things stand right now** (2026-08-26 06:00 JST): `aggregation_
run.py` (generation `01M0MWK852631SHCHPA66F21WQ`) running continuously
in `screen` session `aggregation_run_national`, **1,296/1,979 items
done (65.5%)**. `publish_cycle_8` running (screen session
`publish_cycle_8`, started 04:36), mid-`downsampling_run.py`. Disk free
~440Gi. All healthy.

**What happened, in order, across both sessions**:
1. **D35's corruption investigation fully closed**: a full ground-truth
   sweep of all 109 `4929`/`4930` 2次メッシュ (7,485 files) found 3 more
   corrupted files beyond the original 45 -- 48 total, all fixed and
   re-verified. Broad calibration sampling (~3,544 files across
   Hokkaido, 8 scattered prefectures, and Kyushu/Okinawa's own `Z007`
   pack) found zero corruption anywhere outside the known zone. See
   `japan-geotiff-dem`'s own `DECISIONS.md` D18 for the full technical
   narrative -- not duplicated here.
2. **Correspondence with Mapterhorn maintainer Oliver Wipfli, digested
   into D42** (not transcribed, per standing practice): corrected the
   update-trigger model -- refresh proactively when GSI ships new data,
   then tell Oliver, rather than waiting passively for his own release
   signal. Got an independent ~100k-file-delta confirmation of this
   project's manifest. Surfaced two open 号2 engineering questions: a
   LERC/tiled/no-overview source-GeoTIFF variant for Mapterhorn's own
   direct consumption, and whether `aggregation_merge.py` could move to
   single-pass reads to make LERC viable for our own intermediates too.
3. **`PLAN.md` created** (repo root) -- living 号2 design doc, gated on
   GSI actually shipping new DEM1A data, not started.
4. **`publish_cycle_6` completed clean** (~12h, `japan.pmtiles` grew to
   159.6GB/1,377,720 tiles), verified live three ways.
5. **`publish_cycle_7` crashed**, then **a full crash-rate audit across
   all of 1号's publish cycles found 3 crashes out of 8 launches
   (37.5%)** -- cycles 2, 5, and 7, all the *identical* `bundle.py`
   `FileNotFoundError` race D37 first found and left unfixed (glob'd
   file renamed mid-read by a concurrent `aggregation_run.py`
   reprocess). Crash points spanned ~5% to 62.5% aggregation
   completion with no clear trend -- not just an early-generation risk.
6. **`bundle.py` fix applied and committed** (`hfu-mapterhorn`
   `8b4a50c`): catches the race's `FileNotFoundError` per source file,
   skips just that file's tiles for the current pass instead of
   crashing the whole cycle. Self-heals via the next cycle's own full
   fresh pass. See D44 for the full reasoning on why hot-swapping the
   renamed file instead wasn't safe.
7. **Asked directly whether downsampling can actually be trusted to
   reach 100% once aggregation finishes -- audited the full dependency
   chain by reading the code, found a worse, silent variant of the same
   race (D45)**: `aggregation_covering.py` assigns each item's maxzoom
   deterministically and `aggregation_tile.py` always honors it exactly
   (confirmed no permanent filename mismatch -- good news), but
   `downsampling_run.py`'s own `create_tile()` had an *inner* missing-
   file check, unprotected by `DOWNSAMPLING_STRICT`, that silently
   treated a renamed-away child file as "no data" and let `main()` mark
   the whole parent tile `.done` anyway -- a permanent, silent hole,
   worse than `bundle.py`'s old loud crash. Root cause traced one level
   deeper: `utils.create_archive()` (shared by both `aggregation_
   tile.py` and `downsampling_run.py`) wrote its `.pmtiles` output
   directly to the final path, non-atomically, so a concurrent reader
   could also hit a partially-written file mid-write.
8. **Three-part fix applied and committed** (`hfu-mapterhorn`
   `ff23d2e`): `utils.create_archive()` now writes to a temp path and
   `os.replace()`s into place atomically; `create_tile()` now raises a
   `ChildPmtilesUnavailable` exception instead of silently swallowing
   the missing-file case; `main()` catches it and skips the item
   without marking it done, same shape as `DOWNSAMPLING_STRICT`'s own
   existing pre-check. Deployed while `publish_cycle_8`'s own
   `downsampling_run.py` was still mid-run -- a small, understood,
   accepted risk (see D45's own "Deployment timing note"), confirmed
   not to have crashed anything at deploy time.
9. **A session-local 15-minute cron status-check loop ran throughout**
   this second session -- same caveat as always: tied to that session,
   does not survive it ending.

**Next steps, in priority order for whoever resumes**:
1. **The real test for D45's fix**: once `aggregation_run_national`
   reaches 100%, run `downsampling_run.py` once with nothing else
   touching `pmtiles-store` concurrently and confirm it converges to
   `Total: 0 files` needing work -- that's the actual proof the fix
   closes the loop, not just that nothing crashed.
2. Check whether the currently-running (or most recent) `publish_cycle`
   hit the D37/D44/D45 race again and whether the fixes actually
   worked as designed (clear `WARNING` + continued execution) rather
   than still crashing or (for downsampling) still silently completing
   with a hole.
3. Keep `aggregation_run_national` running uninterrupted (D32, still
   standing). Re-run `publish_cycle.py` roughly daily (D32).
4. D40's ~2.54GB `pmtiles-store` orphan cleanup is still deliberately
   deferred -- re-confirm `bundle.py`'s glob behavior before touching
   it, nothing has changed there.
5. 号2 stays gated on a real GSI DEM1A update landing -- check
   `https://service.gsi.go.jp/kiban/app/data_update_info/`
   periodically, no fixed cadence known.
6. Set up fresh monitoring if continuous observation is wanted again
   -- neither this session's cron loop nor any earlier session's
   Monitor-based one persists across sessions.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth if idle too long; if a retry hangs on "another
> cloudflared process is already waiting," kill the stale
> `cloudflared access ssh` process first).
>
> Read `DECISIONS.md` D35's closing addendum through D45 in full before
> touching anything -- D44 and D45 are dense and directly load-bearing
> for whether 1号 actually finishes correctly, not just whether it
> looks finished. Skim `PLAN.md` for 号2's own standing design notes.
>
> **First**: `screen -ls` for `aggregation_run_national` (never
> intentionally pause it, D32) and check its `.done` count against
> 1,979 to gauge pace against this entry's own 1,296.
>
> **Then**: check the most recent `publish_cycle`'s outcome -- did it
> finish clean? If it hit the known race again, did the new fixes
> (`hfu-mapterhorn` `8b4a50c` for `bundle.py`, `ff23d2e` for
> `downsampling_run.py`/`utils.py`) actually prevent a crash/silent
> hole this time, or do they need further work? Neither fix has been
> proven against a live occurrence yet -- this is the one open question
> this session couldn't close by itself.
>
> **Once aggregation hits 100%**: run `downsampling_run.py` once
> cleanly (nothing else touching `pmtiles-store`) and confirm it
> converges to zero remaining work -- the real proof D45's fix closes
> the loop.
>
> **Otherwise**: business as usual -- storage headroom was fine (~440Gi
> free), D40's orphan cleanup still deliberately deferred, 号2 still
> gated on GSI shipping new data with no fixed cadence.
>
> Converse in Japanese, per this repo's own language policy.

### Addendum (same session, 2026-08-26 09:38 JST): renamed the published archive to `mapterhorn-japan-bridge.pmtiles` (D46)

After `publish_cycle_8` finished clean (proving out D44/D45's fixes
live, see above), Hidenori asked to rename the published archive from
`japan.pmtiles` to `mapterhorn-japan-bridge.pmtiles` everywhere ahead
of `publish_cycle_9`. Done across both repos plus `stars`: pipeline
scripts (`merge_japan_bundles.py`, `publish_cycle.py`), the file on
`stars` (instant same-filesystem `mv`, `martin`'s auto-discovery picked
it up live with no config/restart needed), the GH Pages viewer's
`style.json`, and `README.md`/`CLAUDE.md`'s own prose -- full detail
and every reference found in `DECISIONS.md` D46. Also freed 211GB by
deleting the now-orphaned old-named `bundle-store/japan.pmtiles` on
`slate` (verified `lsof`-clear first, per D29's own lesson) -- disk
free rose to ~546Gi. The resume prompt immediately above this addendum
is superseded by D46's own resume prompt in `DECISIONS.md` -- read that
one, not this entry's.

## 2026-08-26〜28: viewer migrated to martin's XYZ endpoint (D47), `aggregation_run_national` reaches 100% (D48), a live disk-full near-miss during the first clean `publish_cycle_9` validation (D49)

Long session, full technical detail lives in `DECISIONS.md` D47 through
D49 (D46 itself -- the `japan.pmtiles` -> `mapterhorn-japan-bridge.pmtiles`
rename -- was already recorded by the previous session's own entry).
This entry is the session-level orientation for whoever resumes.

**Where things stand right now** (2026-08-28 14:34 JST): `aggregation_
run_national` is **done** -- 1,979/1,979, completed 2026-08-27 19:43
JST. `publish_cycle_9` (launched immediately after, the first cycle
with zero concurrent aggregation) has cleared `downsampling_run.py` and
`bundle.py` with **zero** race warnings (`no longer exists`) -- D44/D45's
fixes hold up under a real clean run. `merge_japan_bundles.py` finished
(`mapterhorn-japan-bridge.pmtiles`, 2,358,133 tiles) despite a disk-full
near-miss along the way (see D49). Currently mid-`rsync` to `stars`,
not yet confirmed finished as of this entry.

**What happened, in order**:
1. **D47: GH Pages viewer migrated from reading the raw `.pmtiles` file
   directly (`pmtiles://` protocol against `depot.optgeo.org`) to
   `martin`'s own XYZ tile endpoint** (`https://stars.optgeo.org/
   mapterhorn-japan-bridge`), for Cloudflare edge-cache benefit on
   individual tile requests. Removed the now-dead `pmtiles.js` client
   library entirely. Verified via a local static-server test: tiles
   decode to the correct 512x512, default 2D hillshade renders
   correctly. **Found but not fully attributed**: toggling 3D terrain
   surfaces a `dem dimension mismatch` MapLibre error at some
   coarse-zoom positions -- traced to genuine `204` (sparse coverage)
   responses, likely explained by aggregation still being incomplete
   at the time (~77%) combined with `downsampling_covering.py`'s own
   region-based (not uniform-pyramid) overview construction -- flagged
   for a re-check now that aggregation is 100%, not yet done.
2. **`aggregation_run_national` crashed silently on its own final 3
   items** -- found by a routine check (`.done` count stuck at 1,976,
   `screen` session gone), not assumed clean. Root cause traced to
   `aggregation_merge.py`: `tmp_folder` is never wiped between attempts
   at the same item, and all 3 items' folders held 4-day-stale
   intermediate state from an interrupted earlier run (likely D38's own
   ~7h blackout window) -- `merge()`'s own unscoped `glob(f'{tmp_folder}
   /*.tiff')` also matched its own already-written `merged-3857.tiff`
   output on retry, inflating the input count by one and crashing on a
   nonexistent "last" group tiff. **Fixed** (`hfu-mapterhorn` `cf857ff`):
   scoped the glob to the real per-group naming pattern and added an
   early-return that finishes an interrupted item's cleanup instead of
   re-merging from scratch. Verified working (all 3 items' own
   `merge-done` markers appeared within 2s of the retry). Restarted,
   **finished cleanly at 2026-08-27 19:43 JST, 1,979/1,979** -- D48.
3. **`publish_cycle_9` launched immediately** as the first cycle with
   zero concurrent aggregation -- simultaneously the clean-run
   validation D45's own resume prompt asked for, the first native
   `mapterhorn-japan-bridge.pmtiles` production run (D46), and another
   real test of D44's `bundle.py` fix. **Zero race warnings through
   both `downsampling_run.py` and `bundle.py`** -- both fixes hold.
4. **D49: `merge_japan_bundles.py` drove disk to 100% full (13Gi free)
   mid-run** -- root cause traced to the `pmtiles` library's own
   `Writer.finalize()`: it streams all tile writes into a separate,
   immediately-unlinked scratch temp file (invisible to `du`/`find`,
   only visible via `lsof`), then does a single full-file
   `shutil.copyfileobj` from that temp file into the real output at
   `finalize()` time -- meaning temp file and growing final output
   coexist, needing ~2x the final archive's own tile-data size in
   headroom at peak. This is a structural property of the upstream
   library, not something this project's own code controls directly.
   **Resolved live**: confirmed via `lsof` that the temp file had
   stopped growing (meaning all 23 regional `bundle-store/*.pmtiles`
   inputs + `planet.pmtiles`, 266GB total, were already fully
   consumed), verified zero open handles on each with `lsof` before
   acting (D29's own lesson), and deleted them -- safe because
   `bundle.py` always does a full fresh rebuild from `pmtiles-store`
   every cycle regardless, so nothing was actually lost. Freed 266GB,
   `merge_japan_bundles.py`'s own copy resumed immediately. **Flagged,
   not fixed this session**: `merge_japan_bundles.py` could delete each
   input immediately after its own read loop finishes, trading
   "cheaply regenerable if merge crashes partway" for "never actually
   at risk of this again" -- a real design tradeoff, not a quick patch,
   and likely to recur on every future cycle now that the archive is
   permanently at national-100% scale.
5. **Built and committed `check_pmtiles_integrity.py`** (`hfu-mapterhorn`
   `0c45422`), per Hidenori's own request for a comprehensive "no holes"
   health check on the published archive: walks the PMTiles directory
   tree only (root through leaf directories), never fetching actual
   tile image bytes, so it stays cheap even against a 200+GB archive.
   For every tile at every zoom, confirms a tile exists at
   `(z-1, x//2, y//2)` -- reports orphans grouped by zoom plus a
   per-zoom tile-count summary. Validated against a stale `cycle_8`
   regional bundle (built while aggregation was only ~65-70% complete)
   -- correctly found thousands of real orphaned tiles there, zero
   false positives on clean single-zoom test files. **Not yet run
   against the actual `mapterhorn-japan-bridge.pmtiles`** -- that
   verification is the next concrete step once `publish_cycle_9`'s own
   `rsync` finishes.
6. Session-local 15-minute cron status-check loop ran throughout (as
   in every prior session this week) -- does not survive this session
   ending, same caveat as always.

**Next steps, in priority order for whoever resumes**:
1. **Confirm `publish_cycle_9` actually finished** (`screen -ls`,
   `grep -a "publish cycle finished\|Traceback" pipelines/
   publish_cycle_9.log`) -- was still mid-`rsync` as of this entry.
2. **Run `check_pmtiles_integrity.py bundle-store/mapterhorn-japan-
   bridge.pmtiles`** (or a local `scp`'d copy if more convenient) --
   the actual "no holes" verification this whole clean-run effort was
   building toward. Report tile counts per zoom and any orphans found.
3. **Re-test the GH Pages viewer's 3D terrain toggle** (D47's own open
   thread) now that aggregation is 100% complete -- confirm whether the
   `dem dimension mismatch` finding is gone.
4. **D40's ~2.54GB `pmtiles-store` orphan cleanup** -- now unambiguously
   safe to execute (aggregation will never reprocess/rename anything
   again), still not done.
5. Consider whether `merge_japan_bundles.py` needs the progressive-
   input-deletion fix from D49 before the *next* `publish_cycle`, given
   the disk-full near-miss is expected to recur otherwise.
6. 号2 stays gated on a real GSI DEM1A update landing (D42/`PLAN.md`) --
   check `https://service.gsi.go.jp/kiban/app/data_update_info/`
   periodically, no fixed cadence known. Whether/when to notify Oliver
   Wipfli about 1号's completion is Hidenori's own call, not something
   to act on unprompted.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth if idle too long; if a retry hangs on "another
> cloudflared process is already waiting," kill the stale
> `cloudflared access ssh` process first; a "context deadline
> exceeded" / connection-closed error on the first attempt after a
> long idle period is also normal, just retry once).
>
> Read `DECISIONS.md` D35's closing addendum through D49 in full before
> touching anything -- this is a long, dense stretch (D44 through D49
> especially) covering 1号's actual completion. Skim `PLAN.md` for
> 号2's own standing design notes.
>
> **1号's `aggregation_run_national` is done** (1,979/1,979, completed
> 2026-08-27 19:43 JST) -- nothing more to run at that stage, ever,
> for this generation.
>
> **First**: check whether `publish_cycle_9` (`screen -ls`, `tail
> pipelines/publish_cycle_9.log`) finished cleanly -- look for
> `publish cycle finished` or a crash, and confirm `depot.optgeo.org/
> mapterhorn-japan-bridge.pmtiles` / `stars.optgeo.org/mapterhorn-
> japan-bridge` are both live with the current byte count (Content-
> Length match against the local `bundle-store/mapterhorn-japan-
> bridge.pmtiles` file).
>
> **Then**: run `check_pmtiles_integrity.py bundle-store/mapterhorn-
> japan-bridge.pmtiles` (already committed, `0c45422`) -- the actual
> "does the published archive have holes" verification this session
> was building toward but hadn't run against the real file yet. Report
> tile counts per zoom and any orphaned tiles found.
>
> **Also open**: D47's 3D-terrain `dem dimension mismatch` re-test;
> D40's ~2.54GB `pmtiles-store` orphan cleanup (safe now); D49's own
> `merge_japan_bundles.py` progressive-deletion fix (not yet
> implemented -- the disk-full near-miss will likely recur on the next
> cycle without it, though this session's own emergency cleanup is a
> viable one-off fallback if it happens again).
>
> Converse in Japanese, per this repo's own language policy.

## 2026-08-31 06:25 JST 時点の状況(compact直前のスナップショット)

このセクションは、セッションのcompact(コンテキスト圧縮)直前に書かれた、
最新かつ最も詳細な引き継ぎ。過去の「Resume prompt」より新しい情報は
すべてこちらを優先すること。

### 今まさに進行中の作業

**`aggregation_repair_3344`**(slate上、screenセッション名同じ)が実行中。
背景: D74(pmtiles-store全体の50%の位置にstale child_z重複ファイル発見・
212GB削除)の対応中に、D75(downsampling層の複数child_z共存を見落として
過剰削除)・D76(aggregation層とdownsampling層の座標名前空間衝突で
3,344件のaggregation出力を誤削除)という2段階の追加事故が発覚し、現在は
**この3,344件の再aggregationで復旧中**。

- 進捗確認コマンド: `ssh slate-via-spacex "cd /Volumes/Migrate-2025-04/github/hfu-mapterhorn/pipelines && ls aggregation-store/01M0MWK852631SHCHPA66F21WQ/*-aggregation.csv.done 2>/dev/null | wc -l"`
- 06:23時点: 3,060/6,373(ベースライン3,029 + 復旧済み31件、目標3,344件の復旧)
- ペースは不安定(九州級の重いアイテムが点在、1件で最大29分かかった実績あり)。
  ETAは都度計算すること(MONITORING_REQUIREMENTS.md参照)
- ワーカー: `AGGREGATION_WORKERS`既定4、ログは`aggregation_repair_3344.log`
  (標準出力バッファリングでリアルタイムには見えないことが多い、
  `.done`ファイル数で進捗を追うこと)

### 復旧完了後にやるべきこと(順番厳守)

1. `check_downsampling_readiness.py`で downsampling層の再収束を確認
   (前回は`not ready: 203`が2回連続で変化しなかった——本当に子タイルが
   無い項目か、`downsampling_run.py`をもう一度回して変化するか確認)
2. `bundle.py` + `merge_japan_bundles.py`を実行し、`japan-z8plus.pmtiles`
   を作り直す(**必ず`TMPDIR=/Volumes/pmtiles-store/tmp-store/writer-scratch/`
   を明示すること**——publish_cycle.py経由でない単独実行はTMPDIRの
   既定が内蔵SSDの手薄な領域を指すためENOSPCになる、PIPELINE_DESIGN.md
   3.10節参照)
3. `/Volumes/Migrate-2025-04/global-overview-backup.pmtiles`
   (z0-7、tiles.mapterhorn.com由来、13,524タイル、検証済み)を
   `bundle-store/global-overview.pmtiles`に戻す
4. `pmtiles merge bundle-store/global-overview.pmtiles bundle-store/japan-z8plus.pmtiles bundle-store/mapterhorn-japan-bridge.pmtiles`
   (go-pmtilesの`merge`コマンド、`/opt/homebrew/bin/pmtiles`)で最終結合
5. `check_pmtiles_integrity.py`で孤立タイル0件を確認
6. **本来の目的である中国・四国沿岸の市松模様が解消されたか目視確認**
   (これが今回の一連の作業全体の検証ゴール)
7. 問題なければ`publish_cycle.py`相当の手順でstarsへrsync

### 新規リポジトリ: `hfu/mapterhorn-monitor`(Open MCTベースの生産モニタ)

藤村さんの指示で新規作成(2026-08-31)。ローカルパス`/Users/hfu/mapterhorn-monitor`、
`git init`済み・リモート`git@github.com:hfu/mapterhorn-monitor.git`設定済みだが
**まだ1度もcommit/pushしていない**。

構成はsas0(`/Users/hfu/sas0`、DWG7のOpen MCT実装、詳細はそのDECISIONS.md/
HANDOVER.md参照)のパターンを踏襲。

**作成済みファイル**:
- `docs/index.html` — sas0と同じCDN固定(`openmct@4.3.0-rc1`, `maplibre-gl@5.24.0`)、
  `window.SharedWorker = undefined`のワークアラウンド込み
- `docs/core.js` — sas0の`core.js`を移植(namespace: `mjbmon`、window.MJBMON)
- `docs/config.js` — データソースURL設定(現状は相対パス、将来的には
  raw.githubusercontent.com経由の専用ブランチ配信に切り替える想定)
- `docs/data/progress.json` — 現在のステージ・ETA材料・資源状況・
  aggregation/downsampling件数のスナップショット(手動更新、実データ)
- `docs/data/agg_tiles.json` — aggregation全6,373件の座標+done状態(実データ、
  164KB)——状況図インスツルメントの材料
- `docs/data/build_log.json` — D71〜D76の実際の記録(実データ)

**まだ作っていないファイル(次にやること)**:
- `docs/instruments/current-stage.js` — 現在のステージ・ETA表示
- `docs/instruments/status-map.js` — MapLibreベースの空間モニタ(agg_tiles.json
  を色分け表示、藤村さんが最も期待している「状況図」相当)
- `docs/instruments/build-log.js` — build_log.jsonのタイムライン表示
  (sas0の「更新情報」パターン参考)
- `docs/instruments/resources.js` — ディスク/メモリ/load average表示
  (Open MCTネイティブのPlot APIは使わない——sas0が実地で「+Createを経ない
  登録では描画されない」壁にぶつかった、自前のSVG/DOM表示にする)
- `docs/boot.js` — `MJBMON.start()`を呼ぶだけ
- `docs/style.css` — 最低限のレイアウト
- ローカルでの動作確認(`cd docs && python3 -m http.server 8000`)
- 初回commit・push

**他セッションへの相談実績**:
- `sas0-9e`(sas0担当セッション)に実装上の勘所を相談、非常に詳細な回答を
  得た: SharedWorkerのクロスオリジン問題、Plot/Telemetry APIの壁、
  キオスクモードのCSS+Fullscreen APIパターン、独立リポジトリ推奨の理由、
  raw.githubusercontent.com(CORS `*`)を使ったバックエンドレス配信の裏技
- `zukaku`(製図/印刷アトラスツール担当セッション)にSave Paper(eject)
  機能について相談——直接の転用は不可(印刷ページ除外専用)だが、
  「位置から機械的に決まるID設計」「セル中央の小さなトグルでドラッグ操作と
  共存させるUIパターン」は進捗マップに応用可能とのアドバイス

### 新設ドキュメント(`mapterhorn-japan-bridge`リポジトリ)

- `PIPELINE_DESIGN.md`(新規) — パイプライン各段階・状態遷移・環境変数・
  7段階ソース優先合成・既知の構造的落とし穴を網羅。D74-D76の事故を機に
  「ドキュメント化→自己レビュー→コード照合→バグ修正→ドキュメント反映」
  というプロセスで作成(藤村さんの提案)。実際にこのプロセス中にbundle.pyの
  振り分け条件の記述ミスを1件発見・修正済み
- `MONITORING_REQUIREMENTS.md`(新規) — 15分ごとのtick報告・ETA算出方法・
  資源逼迫判定基準・並行作業時の注意点を明文化

### 藤村さんからの標準運用指示(48時間規模、2026-08-31 06:24時点で発令)

「生産管理、ダッシュボード設計開発、ロジック&コードレビュー。これらの3つを
バランスよく、自律的に、48時間ほど続けてほしい。確認したいことがあれば
確認してくれていい。」——この3本柱を自律的に回すのが現在の標準運用。

- **生産管理**: 15分ごとの標準Monitorタスク(`bb37v4xay`、
  「mapterhorn-japan-bridge: グローバルMapterhorn z0-7スプライス作業の進捗・
  slateの空き容量・メモリを15分ごとに報告」)が動き続けている。tickが来る
  たびにディスク・メモリ・load averageを確認し、変化があれば報告
- **ダッシュボード開発**: 上記`hfu/mapterhorn-monitor`の残タスクを進める
- **コードレビュー**: `PIPELINE_DESIGN.md`「6. 既知の構造的落とし穴」に
  挙げた項目(特に`aggregation_reproject.py`の`FAIL_ON_WARNING=False`による
  エラー握りつぶし、`aggregation_tile.py`のstale cleanupが50%の位置で
  機能していない原因)を深掘りする。まだ根本原因は未特定

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`(via `aalto` →
> `slate-via-spacex`)、および新規`hfu/mapterhorn-monitor`(ローカルのみ、
> 未push)。日本語で会話する(このリポジトリの言語ポリシー)。
>
> **まず`aggregation_repair_3344`の進捗を確認**(上記コマンド)。完了
> していれば「復旧完了後にやるべきこと」の手順1から順に進める。まだなら
> 15分ごとの標準tick報告を継続しつつ、`hfu/mapterhorn-monitor`の残り
> インスツルメント実装(現在のステージ→状況図→更新履歴→資源状況の順を
> 推奨、状況図が藤村さんの最重要視ポイント)を進める。
>
> 藤村さんから「生産管理・ダッシュボード開発・コードレビューを48時間
> 自律的に回してほしい」という標準運用指示が出ている(2026-08-31
> 06:24発令)。3本柱をバランスよく進めること。確認したいことがあれば
> 遠慮なく質問してよい。
>
> `DECISIONS.md`のD71〜D76、`PLAN.md`、`PIPELINE_DESIGN.md`、
> `MONITORING_REQUIREMENTS.md`を先に読むこと。


---

# Archived from HANDOVER.md, 2026-09-04 compaction

## Current state (2026-09-01, ~21:05 JST)

**1号's mission-complete moment (D73) was short-lived**: hours later,
a stale-file cleanup cascaded into three compounding incidents
(D74→D75→D76) that deleted first 212GB of genuinely-stale files, then
4,396 legitimate downsampling outputs, then 3,344 legitimate
aggregation outputs. Recovery (`aggregation_repair_3344`) ran
2026-08-31 05:29 → 2026-09-01 18:00 JST (D97, 6,373/6,373 clean).

**Then, mid-rebuild verification, a second and larger incident of the
same class was found**: `check_pmtiles_integrity.py` on the freshly
rebuilt archive found 1.8M orphaned tiles. Root cause: 86% (7,079 of
8,215) of downsampling `.done` markers were stale — pointing at
`pmtiles-store` files the aggregation repair's own renames had already
invalidated (same mechanism as D53/D69, much larger blast radius this
time). Markers cleared (`check_downsampling_done_integrity.py --fix`,
D100), rebuild in progress (D101) — **slower than expected (~2
items/min against 7,079 items), root cause not yet confirmed** (a
`PRIORITY_MODE` env var was found to be dead code — always sorts by
proximity to Freetown regardless — plausibly related to D21's own
"clustered expensive tiles" pattern, not yet fixed).

**Publish to `stars` is on hold** until: downsampling reconverges
clean → bundle→merge→cluster→merge redone (the current
`mapterhorn-japan-bridge-with-overview.pmtiles` is stale, don't
publish it) → `check_pmtiles_integrity.py` clean → the actual
checkerboard-artifact visual check (D79's 512px-block hypothesis,
the original motivation for this whole rebuild) → Hidenori's
go-ahead for the `rsync` itself.

**After that**, per Hidenori's 2026-09-01 decision (D96): don't detach
`pmtiles-store`/disk5, don't wait for the next GSI update yet. Instead
run **「1.5号」** — same source data, new pipeline (D95's
aggregation/downsampling layer-namespace-separation fix, implemented
for the first time; D93/D94's lineage-tile feature) — as a staging
run and regression test before real 2号 (gated on GSI's next quarterly
DEM1A update, ~end of October 2026, still not landed as of this
writing).

**Standing operating mandate** (Hidenori, 2026-08-31 06:24, still in
force): balance three pillars autonomously for ~48h — production
management (the 15-min tick cadence via task `bb37v4xay`), dashboard
development (`hfu/mapterhorn-monitor`, live at
`hfu.github.io/mapterhorn-monitor/`, Open MCT-based), and code review
(`DECISIONS.md`'s ongoing entries). Ask when genuinely blocked;
otherwise keep going.

**Dashboard** (`hfu/mapterhorn-monitor`, separate repo, pushed and
public): 7 instruments (Progress Trend, Current Stage, Status Map,
Resources, Mission Timeline, Live Viewer — embeds the production
viewer directly), kiosk-style cycle mode (fullscreen, arrow-key
navigation, Open MCT chrome hidden via CSS — patterns shared with
sibling sessions `sas0`/`claude-mct` -- Open MCT field notes now
live at `github.com/dwg7/cafebabe/blob/main/patterns/open-mct.md`
(migrated from sas0 2026-09-02), not duplicated here).

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` (via `slate-via-
> spacex`) and `hfu/mapterhorn-monitor`. Converse in Japanese (repo
> language policy: repo content itself stays English).
>
> **First**: check `downsampling_repair2` screen / `check_downsampling_
> readiness.py` progress. If 0 not-ready: re-run `bundle.py` → `merge_
> japan_bundles.py` → `pmtiles cluster` → `pmtiles merge` (with
> `global-overview-backup.pmtiles`) → `check_pmtiles_integrity.py`. If
> clean, do the D79 checkerboard visual check, then ask Hidenori before
> `rsync` to `stars`. If still rebuilding, keep the 15-min tick cadence
> (dashboard update + brief report) and investigate D101's slow-
> throughput root cause if it's still unresolved.
>
> Read `DECISIONS.md`'s most recent entries (D95 onward) and `PLAN.md`
> before assuming anything about 1.5号/2号 timing. Don't touch
> `get_pmtiles_folder()`/aggregation-downsampling file-naming code
> until 1号 is genuinely done (D95's structural fix waits for that).
> Full history before 2026-09-01: `HANDOVER-archive.md`.
