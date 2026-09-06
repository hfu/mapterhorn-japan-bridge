# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-06**: the 2026-09-05 "current state" section (the
1.5-go aggregation-in-progress era, D122-D131) has been moved into
`HANDOVER-archive.md`, unedited. This file keeps only the current
state and a short recent-context summary. Compact again the same way
once this file itself grows unwieldy -- archive everything above the
current-state section, keep only a fresh snapshot.

## Current state (2026-09-06, evening JST): 1.5-go mission complete, 2号 launch-readiness reviewed

**Read DECISIONS.md D132 through D146 for the full arc since the last
compaction** -- summary:

- **D132-D141**: aggregation finished cleanly (6,373/6,373, zero
  repeat of D129), downsampling converged for both datatypes, the z0-7
  Mapterhorn global overview was spliced into the elevation archive,
  and `pmtiles cluster` was applied to lineage (D140/D143: found
  lineage dedupes ~83.5% of its tile content vs. elevation's ~19%,
  since folded into `merge_japan_bundles.py`'s code unconditionally
  for every future datatype, D144).
- **D142/D145**: Hidenori approved publishing; the full elevation
  (314.66GB) + lineage (204.6MB, first publish) archives transferred
  to `stars` and went live. Live-site spot checks at known coordinates
  matched 1号's own verified byte counts exactly -- no regression from
  the pipeline rewrite. **1.5-go's dual mission (D96) is done**:
  D95's namespace separation validated at national scale, and lineage
  shipped. 1号's own data was never touched.
- **Dashboard integration**: `mapterhorn-monitor` gained a working
  "Lineage" instrument -- a real MapLibre map combining the lineage
  color-relief layer with the production terrain+hillshade style and a
  color legend. Non-trivial bug hunt along the way: MapLibre's spec'd
  `encoding:'custom'` raster-dem decode is validator-accepted but never
  actually renders (confirmed through at least maplibre-gl 6.7.0) --
  worked around by repurposing `encoding:'terrarium'`'s real decode
  formula on the category bytes instead. Palette softened afterward
  for a public-facing/shareable look.
- **D146**: lineage's own downsampling pyramid extended below its
  z8 floor (down to z4 by default) via a new standalone script,
  `lineage_extend_low_zoom.py` -- deliberately not folded into the
  shared `downsampling_covering.py`/`downsampling_run.py` (those files
  are datatype-agnostic and shared with elevation; naively lowering
  the shared floor would have pulled elevation into building unwanted
  low-zoom overviews of its own). A real "whole planet" bug was found
  and fixed during development (a self-produced archive's coverage
  got mis-derived from its own placeholder extent tile as if it
  covered the globe) -- now guarded by a tile-count sanity check.
  lineage-only re-bundle/merge/publish followed; elevation was never
  touched. **This script is now documented in `PLAN.md` §9 as a
  standard step for 2号 too**, not a 1.5-go one-off.
- **New standalone site**: `hfu/japan-bridge-lineage` (GitHub Pages,
  `https://hfu.github.io/japan-bridge-lineage/`) -- a Vite-built globe-
  view map showing the lineage layer, built for sharing outside the
  dashboard (used to notify Oliver Wipfli of Japan-side tile
  production progress). Hit and resolved a real upstream bug along the
  way: **maplibre-gl 6.7.0 never finishes loading any raster-dem
  source** (confirmed with both this project's own tiles and the
  public AWS `elevation-tiles-prod` terrarium demo tiles -- `isStyleLoaded()`/
  `'load'` never fire, no error thrown, `new Worker(...)` never even
  called). Pinned to maplibre-gl **5.24.0** instead (same version
  `mapterhorn-monitor`'s own dashboard already uses) -- byte-identical
  application code then works immediately, including globe projection.
  Worth remembering if any future project reaches for maplibre-gl 6.x
  and terrain/hillshade/color-relief mysteriously never renders.
- **2号 launch-readiness reviewed (2026-09-06, this session)**: per
  Hidenori's request to "prepare 2号" while explicitly keeping the
  actual launch in a fresh session, `PLAN.md` §0/§4/§8 were refreshed
  against current reality (worker count, disk5 status, a live re-check
  of GSI's update-info page -- still 2026-07-31, no new update). See
  `PLAN.md` §8 for the current checklist: code/infra readiness is
  essentially done; the open items needing attention before an actual
  2号 launch are the JGD2011→JGD2024 CRS question (§1), the untested
  5m/10m corruption-bug-class question (§3), and the dirty-tracking
  design decision (§4/D57). `CLAUDE.md`/`START_HERE.md` were also
  brought current in the same pass -- both had drifted noticeably (the
  Mission section and source-catalog listing in particular still
  described the pre-1.5-go, pre-rename state).

**What's next**: 2号 itself, once GSI ships a new DEM1A update
(`PLAN.md` §1, working estimate end of November 2026) -- **in a fresh
session**, not this one (Hidenori's own call, avoids one session
juggling multiple generations/repos at once, the exact class of mix-up
that motivated this rule). Nothing in this project is currently
running unattended; `check_disk_headroom.py`'s autonomous screen on
`slate` can likely be stopped once confirmed idle, though this hasn't
been explicitly done as of this snapshot.

**Monitoring**: `mapterhorn-monitor` dashboard is fully caught up to
1.5-go's mission-complete state as of the last update in this arc. It
remains **not autonomous** -- updated by whichever agent session is
watching. If resuming this project cold, don't assume `progress.json`
reflects live state without checking `DECISIONS.md`'s latest entries
first.
