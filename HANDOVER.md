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

## Current state (2026-09-05, ~13:33 JST): 1.5-go aggregation ~96% done, D129 incident behind us

**Read DECISIONS.md D122 through D131 for the full arc** (all short,
worth reading in order) -- summary since the D128 launch:

- **D128**: 1.5-go's national aggregation launched 07:23 JST 2026-09-04
  (generation_id `01M1MKD73P0KDT719H21NJV9VR`, screen `agg15go` on
  `slate`, originally 5 workers, `EMIT_LINEAGE=1`). Roster
  cross-check clean (6,373 items, exact match with 1-go).
- **D129**: at 19:54 JST, slate suffered a kernel panic --
  `watchdog timeout: no checkins from watchdogd in 91 seconds`, root
  cause the memory compressor hitting 100% of its segment limit after
  ~12.5h of 5 concurrent workers (D84's 2026-09-01 default, tuned for
  CPU idle time only, never accounted for per-worker memory spikes --
  one worker was observed at ~7.7GB RSS pre-crash). No data loss
  (roster/`.done` markers verified intact, in-flight items' scratch
  dirs are safely reusable by `aggregation_run.py`'s own
  `exist_ok=True` design). Recovered by remounting both volumes,
  restarting `disk_headroom`, and restarting `agg15go` with
  `AGGREGATION_WORKERS=3`.
- **D130**: a full analysis comparing the 5-worker phase (12.2h,
  avg 4.03 items/min, 1 crash) against the 3-worker phase (crash-free,
  avg 3.10 items/min) -- 40% fewer workers cost only 23% throughput,
  and the single largest worker RSS spike seen all run (10.37GB) hit
  *during* the 3-worker phase with zero incident, confirming the
  crash was about sustained concurrency over hours, not any one large
  tile. Verdict: worth staying at 3 for this run, treat 4 as a soak-test
  candidate before 2-go.
- **D131**: Hidenori's final call -- skip the 4-worker soak test
  entirely, fix 3 workers as the standard for **both** the rest of
  1.5-go and all of 2-go (accepting the throughput cost for zero
  crash risk). `aggregation_run.py`'s `get_worker_count()` default
  changed from 5 to 3 (`hfu-mapterhorn` commit `8b19b17`) so 2-go
  needs no special env var -- matching this project's own stated goal
  of finishing worker-tuning during 1.5-go rather than touching code
  during 2-go's speed run.
- **Dashboard fixes (2026-09-05, un-numbered)**: `mapterhorn-monitor`'s
  Current Stage instrument had an empty stat grid the whole run --
  it read 1-go's D74-D76 repair-cycle schema
  (`current_stage.done/baseline_done/total_to_repair/started_at`),
  fields 1.5-go's `progress.json` never populated. Fixed to read
  `aggregation.done/total` plus a new `current_stage.started_at`.
  Three other instruments (status-map/mission-timeline/progress-trend)
  are the same repair-cycle vintage and unfed since 2026-09-01 --
  rather than archive them, each now shows an honest "not live" notice
  (`MJBMON.renderInactiveNotice()`) instead of stale or broken data.
  Also added `?v=` cache-busting to every script tag after discovering
  a long-lived dashboard tab can keep running stale instrument JS
  indefinitely with no revalidation.

**As of this snapshot**: 6,153/6,373 aggregation items done (96.5%),
3 workers, all health metrics clean (disk/load/memory pressure all
normal, no repeat of D129 since the restart). 1-go's live archive
remains stable, published, and untouched throughout.

**What happens next, unattended**: aggregation should finish within
the next ~1-2h at the current pace. After it completes: downsampling
(elevation then lineage) -> `bundle.py` (both datatypes) ->
`merge_japan_bundles.py` (both datatypes) -> `./pmtiles cluster`
(D127) -> `./pmtiles verify` -> `./pmtiles merge` (z0-7 splice) ->
`./pmtiles verify` -> **stop and get Hidenori's explicit publish
approval** before any `rsync` to `stars` (`publish_cycle.py` stays
hard-disabled, D115). Rollback command if ever needed:
`rm -rf pmtiles-store/{aggregation,downsampling}/*/01M1MKD7*/
aggregation-store/01M1MKD7*/` -- 1-go is untouched by construction.

**Monitoring**: `check_disk_headroom.py` runs autonomously in a
detached screen (`disk_headroom`, 15-min loop, covers both volumes)
independent of any session -- it was restarted along with `agg15go`
during D129's recovery. The `mapterhorn-monitor` dashboard
(`progress.json`) is **not** autonomous -- it is updated by whichever
agent session is watching, each time it checks in (a local 15-min
Monitor task drives this; note it does NOT survive a Claude.app
restart, which happened once this run and required manually
re-arming it -- automating the mechanical part of this update on
slate itself, independent of any Claude session, is the agreed next
step but deliberately deferred until after 1.5-go finishes). If you
are resuming this project mid-run, check `screen -ls` on `slate` for
`agg15go` and `disk_headroom.log`'s tail before assuming anything
about progress from a stale dashboard snapshot.
