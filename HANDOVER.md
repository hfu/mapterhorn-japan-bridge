# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `CLAUDE.md` first for
the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-01**: the full session-by-session narrative from
2026-08-08 through 2026-08-31 (D1–D73 era: pipeline validation,
national build, first "mission complete" at D73) now lives in
`HANDOVER-archive.md`, unedited. This file keeps only the current
state and a short recent-context summary, so a cold resume doesn't
have to read ~3,900 lines to find out what matters right now. Compact
again the same way once this file itself grows unwieldy — archive
everything above this section, keep only a fresh current-state
snapshot.

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
