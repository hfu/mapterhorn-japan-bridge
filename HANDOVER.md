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

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming the `mapterhorn-japan-bridge` effort. Read, in order:
> `/Volumes/Migrate-2025-04/github/mapterhorn-japan-bridge/CLAUDE.md`
> (this repo now runs entirely on `slate` — `aalto`'s copy, and its
> external HDD, both failed/are retired as of 2026-08-11), this file's
> 2026-08-11 entry (the recovery + policy pivot), and `DECISIONS.md`
> D12 (the frozen-Hokkaido/Kyushu-only/slate-sole-machine decision) and
> D11 (background on the elevation-pipeline fixes, still valid).
>
> **Current scope**: Kyushu/Okinawa only, best-effort, no deadline.
> Hokkaido is deliberately frozen, not abandoned — do not resume it
> without checking with Hidenori first. Of Kyushu/Okinawa's 25
> region-pack zips, only 10 (`Z010`-`Z019`) survive `aalto`'s drive
> failure; the other 15 would need re-downloading from GSI if ever
> wanted, not currently planned.
>
> Check `japan-geotiff-dem`'s own `HANDOVER.md`/`CLAUDE.md` for the
> current state of the upstream GeoTIFF pipeline (also now
> `slate`-only) before assuming what's actually published and
> downloadable for this repo's own `jpkyushutest1`/`5m`/`10m`
> source-catalog entries in `hfu/mapterhorn`.
>
> Standing constraint, unchanged: never publish `japan.pmtiles` (or any
> bundled `pmtiles`) and never `git push` without Hidenori's explicit
> go-ahead.
> and wait for direction.
