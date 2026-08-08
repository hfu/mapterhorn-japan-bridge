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

### Next steps

- [ ] **Debug the viewer** (D10) — candidate directions listed there.
      Start with checking `stars.optgeo.org`'s CORS headers for a
      `hfu.github.io` origin, since "zero requests ever sent" plus "no
      console error" is consistent with either a preflight failure
      that isn't surfaced as a console error, or the vector source
      genuinely never being scheduled to load.
- [ ] Once `japan-geotiff-dem` has synced its fuller Hokkaido progress
      (its own `HANDOVER.md` next-steps), regenerate `jphokkaidodem1`'s
      `file_list.txt` against the current bucket state (D3/D4) and its
      matching `jphokkaidodem15m`/`10m` fallback entries (D9), then run
      the full pipeline for real Hokkaido coverage (not just the
      Hakodate trial).
- [ ] Rebuild and republish `japan.pmtiles` (D7) once Hokkaido coverage
      grows — remember the merge step needs `bundle.py` re-run first,
      then the ad hoc merge-everything script (not checked in anywhere
      yet — see D7, worth turning into an actual script in this repo
      if this becomes routine).
- [ ] Keep watching for whether upstream `mapterhorn/mapterhorn`'s own
      `jpdem1a` picks up the July 2026 GSI update — that's this whole
      repo's retirement condition (see `CLAUDE.md`'s Mission section).

## Resume prompt

Paste this after `/clear` to pick up exactly here:

> Resuming the `mapterhorn-japan-bridge` effort. Read, in order:
> `/Volumes/github/mapterhorn-japan-bridge/CLAUDE.md` (repo×machine
> split — this spans `japan-geotiff-dem` on `aalto`, `hfu/mapterhorn`
> on `slate` via `ssh hfu@slate.local`, and this repo for docs+viewer),
> then this file's "Current state"/"Next steps", then
> `DECISIONS.md` D10 (the open viewer bug) and D7 (the `japan.pmtiles`
> strategy). Also skim `/Volumes/github/japan-geotiff-dem/HANDOVER.md`
> for the upstream data side (Hokkaido download progress, sync status)
> since `jphokkaidodem1` work depends on it. Priorities in order: (1)
> debug the broken GitHub Pages viewer, (2) check whether
> `japan-geotiff-dem` has synced further and regenerate
> `jphokkaidodem1`'s file lists if so, (3) otherwise just report status
> and wait for direction.
