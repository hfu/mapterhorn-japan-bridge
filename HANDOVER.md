# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-04**: the 2026-09-01 "current state" section (D74-
D101 era: the D74-D76 incident cascade, its repair, and the immediate
aftermath) has been moved into `HANDOVER-archive.md`, unedited. This
file keeps only the current state and a short recent-context summary.
Compact again the same way once this file itself grows unwieldy --
archive everything above the current-state section, keep only a fresh
snapshot.

## Current state (2026-09-04, ~07:30 JST): 1.5-go national aggregation LAUNCHED

**Read DECISIONS.md D122 through D128 for the full arc** (all short,
worth reading in order) -- summary:

- **1-go** is complete, published, stable, and untouched (D122; a
  major west-Japan z13+ publish gap and the Tsushima/Goto z8-11 gap
  were both found and fixed first, D117/D115).
- A proposed shortcut ("1.4-go": patch 1-go in place) was aborted
  *before* launch when an independent comparison found it would trip
  a D76-class collision (D123). Pivoted to the fuller "1.5-go"
  arrangement instead: new generation_id, full namespace separation +
  generation_id store layer + lineage + hardening, validated in one
  national run rather than paying the 50-70h cost twice.
- **D124**: all five pre-launch conditions implemented in production
  `pipelines/` and proven via a real chained two-sibling rehearsal
  (both datatypes, zero writes into 1-go's tree, elevation byte-
  identical to 1-go, freshness invalidation proven live).
- **D125**: a second, independent reviewer graded the actual diff
  against a pre-derived checklist (not trusting either agent's self-
  report) -- verdict "push it", one blocker found (`downsampling_run.py`
  had no TMPDIR override) and fixed immediately, plus three small
  cleanup/runbook items, all resolved.
- **D126**: a parallel documentation audit found and fixed several
  places docs would have actively misled a new session (publish_
  cycle.py's hard-disable was undocumented; the launch runbook's own
  env vars were missing from the reference table) and added
  `START_HERE.md` as a new onboarding entry point.
- **D127/D128**: Hidenori reviewed the launch checklist directly
  (code/data/cleanup/staleness, each confirmed Go), asked for and got
  two final additions (a `pmtiles cluster` step in the runbook,
  matching 1-go's own D118 precedent; disk-headroom monitoring
  extended to cover `pmtiles-store` as well as `Migrate-2025-04`),
  then approved: **"lift off."** `aggregation_covering.py` generated
  1.5-go's roster (generation_id `01M1MKD73P0KDT719H21NJV9VR`); a
  D123-style bidirectional cross-check against `source-store` came
  back completely clean (6,373 items, exact match with 1-go's own
  count). `aggregation_run.py` is running now in screen session
  `agg15go` on `slate` (5 workers, `EMIT_LINEAGE=1`).

**Everything is pushed** to `origin/main` in both `hfu/mapterhorn` and
this repo as of D125.

**What happens next, unattended**: the aggregation phase alone is
~50-70h by 1-go's own timing history. After it completes: downsampling
(elevation then lineage) -> `bundle.py` (both datatypes) ->
`merge_japan_bundles.py` (both datatypes) -> **`./pmtiles cluster`**
(new step, D127) -> `./pmtiles verify` -> `./pmtiles merge` (z0-7
splice) -> `./pmtiles verify` -> **stop and get Hidenori's explicit
publish approval** before any `rsync` to `stars` (`publish_cycle.py`
stays hard-disabled, D115). The rollback command if anything needs to
be undone: `rm -rf pmtiles-store/{aggregation,downsampling}/*/01M1MKD7*/
aggregation-store/01M1MKD7*/` -- 1-go is untouched by construction, so
this is a clean, low-risk revert.

**Monitoring**: `check_disk_headroom.py` runs autonomously in a
detached screen (`disk_headroom`, 15-min loop, now covers both
volumes, D127) independent of any session. The `mapterhorn-monitor`
dashboard (`progress.json`) is **not** autonomous -- it is updated by
whichever agent session is watching, each time it checks in. If you
are resuming this project mid-run, check `screen -ls` on `slate` for
`agg15go` (or whatever screen the current phase is running in) and
`disk_headroom.log`'s tail before assuming anything about progress
from a stale dashboard snapshot.
