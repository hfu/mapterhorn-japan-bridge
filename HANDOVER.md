# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-11**: the 2026-09-09 (night JST) "current state"
section (D147-D155, elevation regen in flight) has been moved into
`HANDOVER-archive.md`, unedited. This file keeps only the current
state and a short recent-context summary. Compact again the same way
once this file itself grows unwieldy — archive everything above the
current-state section, keep only a fresh snapshot.

**This handover is deliberately long.** The outgoing session expects
to be cleared and a fresh agent to pick up from here with zero memory
of what happened — read it in full before touching anything, especially
the strategic decision in the first bullet below.

## Current state (2026-09-11, morning JST): D155/D154 published and verified; mission-critical strategic decision made; several infrastructure fixes landed

**Read `DECISIONS.md` D156 through D161 for the full arc since the
last compaction — six entries in one session, one of them (D160) is
the single most important thing to understand about this project's
future.** Summary, most important first:

### 0. D160 — the mission does NOT wind down just because upstream caught up

This is not optional background reading. A project-wide review (done
at Hidenori's request) found that upstream `mapterhorn/mapterhorn`'s
`jpdem1a` source is now fed by Oliver Wipfli's own
`wipfli/japan-download` (new 2026-08-21), which reads **this project's
own sibling product** `smartmaps/japan-geotiff-dem`'s
`latest_file_list.csv.gz`. Measured directly: our `jpnational1` file
list and that public list are **the same 291,779 files, identical MD5
of the sorted filename set**.

The agent doing that review proposed retiring the bridge without ever
running 2号, on the theory that the source-level gap this bridge exists
to close has already closed. **Hidenori explicitly rejected that
proposal.** His reasoning, verbatim from the session: being upstream's
Japan data supplier is now a standing obligation, and the only way to
keep `latest_file_list.csv.gz` trustworthy is to keep consuming it in
a real national build and catching what breaks. Stop building and
nobody is checking what gets published upstream.

**If you are a future session and you independently notice "hey,
upstream's data source is now the same as ours" — that discovery has
already been made and already been acted on. Do not re-propose
retirement. Read D160 in full before raising the question again.**
This is now baked into `CLAUDE.md`'s own Mission section too, so it
should be hard to miss, but it bears repeating here because it is the
kind of insight that feels newly-discovered and urgent to whoever
finds it next.

One thing this discovery *did* change: the framing of what 2号 is for.
It is not "close the gap before upstream does" (the gap is effectively
closed already) — it is "keep the supply chain honest by continuing to
exercise it," plus a hedge against upstream's own release timing
(Oliver's releases are demand-driven, per D42, so a materially-updated
source does not automatically mean materially-updated published
tiles).

### 1. D155/D154's regen finished and published clean

The elevation downsampling regen (rounding cap 32m→1m, Oliver's
follow-up commit) that was still running when the last handover was
written completed successfully — all 8,223 items, confirmed via
`check_downsampling_done_integrity.py` (0 stale). D154's lineage fix
(skip all-nodata parent tiles in `lineage_extend_low_zoom.py`) had
already been re-run in production (z7: 117→88 tiles).

From there: `bundle.py` → `merge_japan_bundles.py` (D144's automatic
`pmtiles cluster`) → `./pmtiles merge` (z0-7 global overview splice,
elevation only) → `./pmtiles verify` → publish to `stars`, for both
datatypes, following D148/D153's proven sequence. **This is now fully
done and verified.** The publish ran 02:05→08:17 JST (6h12m,
`screen publish_d155_d157`, script preserved at
`/tmp/publish_d155_d157.sh`), exit code 0, no errors.

**Post-publish spot check, all seven checks matched a prediction
written into the check script *before* running it** (script preserved
at `/tmp/spotcheck_d155.sh` — reusable template for the next publish):

| check | prediction | actual | why this pair matters |
|---|---|---|---|
| elevation z13/6894/3521 (Yonaguni, aggregation layer) | unchanged, 64,276 B | **64,276 B** | proves the regen did NOT touch the aggregation layer |
| elevation z8/219/101 (Tsushima/Goto, downsampling layer) | ~+65% (~102 KB) | **103,546 B** (+67.5% from D153's 61,812) | proves the new 1m cap DID take, in the z≤10 band it targets |
| lineage z8/219/101 | unchanged, 490 B | **490 B** | this is D154's *source* zoom, not a rewritten one |
| lineage TileJSON minzoom | 4 | **4** | D146's low-zoom extension survived the regen |

The z13-unchanged / z8-changed pair is the actual proof, not either
number alone — z13 alone could not rule out "the regen silently
touched aggregation too," and z8 alone could not rule out "the new cap
never took effect." Neither single observation distinguishes those
failure modes; only having both does. Keep this pairing technique for
future spot checks — it recurred twice more in this same session (see
§3 below) and seems to be a generally useful pattern for this
pipeline's verification work.

`stars`' own session independently re-fetched all three cited tile
byte counts and confirmed an exact match — see §5 below for the
cross-session collaboration this involved.

### 2. Three of four pre-2号 housekeeping items are done; one is deferred by design

`PLAN.md` §8 has the full checklist. Status:

- ✅ **`START_HERE.md`'s stale machine table** — `japan-geotiff-dem`
  was listed as living on `aalto`; it has been on `slate` since D12
  (weeks ago). Fixed. Also rewrote the "everything happens on slate
  over SSH" line into "check `hostname` first" — that flat assertion
  is literally what caused D156 (below).
- ✅ **`check_disk_headroom.py`'s thresholds and blind spot** — old
  defaults (warn 200GB / critical 80GB) were guesses, and were
  demonstrably too low: D157's ENOSPC crash happened with 228GiB free,
  which this script logged as "ok". New defaults (300/120GB) are
  derived from the actual measured requirement of the largest single
  stage (elevation merge, 237.4 GiB in → out). Also added: when either
  volume is under pressure, the script now also reports the size of
  the two scratch subtrees (`writer-scratch`, `go-cli-scratch`) — a
  volume-level free number alone cannot distinguish "genuinely full of
  real data" from "full of a week-old crash's garbage," which is
  exactly what caused D157. Committed as `hfu-mapterhorn` `216fb22`.
- ✅ **Stale upstream clone removed** — `github/mapterhorn` (a plain,
  unmodified clone of `mapterhorn/mapterhorn`, last fetched
  2026-06-10, 123MB) sat right next to the real working fork
  `github/hfu-mapterhorn` under a confusingly similar name. Verified
  it held no uncommitted work, no unpushed commits, no stashes, and
  that its remote was reachable (so re-cloning is always possible) —
  then Hidenori approved deletion and it's gone. **If you need
  upstream's content going forward, use `hfu-mapterhorn`'s own
  `upstream` remote** (`git fetch upstream`) — that is now the only
  path.
- ⬜ **Publish script's delete-then-transfer ordering** — deliberately
  NOT changed this session, because the D155 publish was already
  running on the old script when this became actionable. `stars`'
  free space grew from 201GB to 1.6TB during this session (D159,
  Hidenori's own infra work), which removes the reason the old
  ordering existed (there wasn't room to keep both old and new
  simultaneously). **Apply the new ordering
  (`.new` transfer → verify → delete old → atomic rename) when writing
  2号's own publish script** — it eliminates the window where the live
  archive is briefly absent, which is exactly what triggered the
  `stars`-session incident in §5.

**Unplanned bonus from the `check_disk_headroom.py` fix**: the very
first run under the new scratch-reporting code found **765GiB of
orphaned `go-cli-scratch` files** (seven temp files from `pmtiles
cluster`/`merge` runs dating back to 2026-09-06, largest 311GB, none
held open by any process — confirmed via `lsof`). Hidenori approved
deletion; `/Volumes/pmtiles-store` went from 569Gi free to 1.3Ti free.
The fix that was supposed to help *next time* helped *the same day it
was written*.

### 3. `stars` now writes its own name/description at generation time

`stars`' own Claude session asked (mid-session, over the cross-session
messaging channel — see §5) that the published archives' Martin
catalog `name`/`description` fields be set by the pipeline itself,
rather than patched after publish with `pmtiles edit` — which rewrites
the *entire file*, an unacceptable risk against a 258GB archive.
Implemented in `hfu-mapterhorn`'s `merge_japan_bundles.py`
(commit `010b558`):

- `name`/`description` are now written into `writer.finalize()`'s JSON
  metadata, for both datatypes. Confirmed (by reading `./pmtiles
  merge`'s own log line, "Copying center and JSON metadata from first
  input") that the later z0-7 splice step preserves whatever this
  script wrote, since this script's own z8plus output is always that
  splice's first input.
- **`name` deliberately does NOT equal the Martin source id.**
  `stars` pointed out that Martin's own source code
  (`martin-core/src/tiles/source.rs`) filters the name with
  `.filter(|v| *v != id)` — a name identical to the id silently
  disappears from the catalog. So: `Mapterhorn Japan Bridge:
  nationwide terrain` (elevation) / `Mapterhorn Japan Bridge: source
  lineage` (lineage) — the lineage string matches what `stars` had
  already set by hand, so the catalog entry does not churn between
  publishes.
- Also ported upstream's `ca98d40` (#313, "Add encoding terrarium in
  PMTiles metadata") — **elevation only**. Lineage tiles are a
  single-channel source-tier category, not Terrarium-packed heights,
  so adding `encoding: terrarium` there would misdescribe the data to
  any client reading that field.
- **Not yet exercised against a real publish** — this only takes
  effect starting with 2号's own bundle/merge run. Today's published
  archives (the ones just verified in §1) do not have these fields
  yet; `stars` is manually re-adding the lineage name by hand in the
  meantime (elevation is left as-is per their own risk call).

### 4. Two operational incidents this session, both harmless, both instructive

**D156 — the agent was running ON slate, not on some remote host
SSHing into it.** Wasted real time trying `ssh hfu@slate.local` and
hitting "Too many authentication failures" — a self-connection loop.
`CLAUDE.md`'s own "everything runs on slate over SSH" framing (now
softened, see §2 above) is what led to this. The decisive test that
resolved it: `diskutil info /Volumes/Migrate-2025-04 | grep Protocol`
returned `USB` — a USB-attached disk can only ever mount as `local` on
the machine it is physically plugged into, so `hostname` returning
`slate.local` plus this protocol check together prove the session
*is* slate. **Check `hostname` and this protocol trick before ever
reaching for SSH** — CLAUDE.md, START_HERE.md, and PLAN.md all now say
this explicitly.

**D158 — `/Volumes/Migrate-2025-04` briefly disconnected and
auto-recovered.** Right as the stars publish was about to start, the
volume unmounted (a USB re-enumeration — its `diskN` identifier
changed from `disk6` to `disk4`, and has since changed again to `disk6`
in a later check this same session; **always refer to volumes by
mount point, never by `diskN` identifier**, per D158/START_HERE.md).
Auto-remounted about 90 seconds later via a backgrounded `diskutil
mount`. No data loss — the two just-completed output archives were
confirmed byte-identical (size + mtime) before and after, and
`pmtiles verify` passed on both post-recovery. If this happens again
*during* an active write (as opposed to right after one, which is what
happened this time), expect the affected stage to crash and need a
rerun, same class of recovery as D157.

### 5. Ongoing live collaboration with the `stars` session

This session communicated directly with another live Claude session
named `stars` (the serving host) via the cross-session `SendMessage`
tool throughout this session — this is a real, working communication
channel, not a one-off. Topics covered: reassuring `stars` mid-transfer
that the archive wasn't lost (their own new daily-snapshot dashboard's
first run happened to catch the transfer's dead window and flagged
`mapterhorn-japan-bridge` as "removed"), the metadata request in §3,
and independent verification of the post-publish spot check.

Two structurally interesting findings came out of this exchange, both
worth remembering as a *pattern* rather than just a fact:

- `stars`' own catalog↔disk reconciliation could not detect this kind
  of transient disappearance, because a directory-auto-discovered
  source (like this one) vanishes from the catalog at the exact same
  moment its file vanishes from disk — so a reconciliation pass always
  sees "consistent," never "missing." Only a diff between successive
  daily snapshots (`dataset_removed`) could catch it. `stars` has
  since added a `staging` bucket that recognizes in-flight `.new`
  files by name, so a future publish reads as "transferring" rather
  than "gone."
- This is the same shape of problem `check_disk_headroom.py` had (§2):
  a single number (free space; or "is it in the catalog") cannot
  distinguish two situations that need different responses. The fix
  in both cases was the same: report a second, more specific number
  alongside the first (scratch-tree size; a staging bucket) so the
  two situations become distinguishable from the log/catalog alone.
  If you hit something similar elsewhere in this pipeline, this
  pattern — "what's the second number that would make this
  ambiguous state legible?" — is probably the right lens.

If `stars` messages this session again (a comment, a question, a
report from their own dashboard), that is a live peer conversation —
reply via `SendMessage` to the `stars` name, same as before.

### 6. Something raised but NOT resolved: SSH access from this environment

Near the end of the session Hidenori mentioned he'd made the disks
under `/Volumes` "accessible via SSH sessions" — intending, it turned
out, that a session running on `aalto` (or any other host) SSHing into
`slate` should now see `/Volumes/pmtiles-store` etc. This session
could not verify that claim, because this environment's own
`~/.ssh/authorized_keys` on `slate` contains exactly one key
(`aalto-to-slate-hfu@aalto`), and none of this environment's own
keys (`id_ed25519`, `id_rsa`, etc.) match it. Since this session
already runs directly on `slate` (see D156), it never needed to SSH
in anyway, so this was never actually blocking anything — but it
remains **unverified**, and adding this environment's own public key
to `authorized_keys` was explicitly not done (that's a security-config
change, out of scope for an agent to decide unilaterally without a
clear go-ahead). If a future session needs to confirm this, either:
(a) have Hidenori test `ssh hfu@slate.local` from `aalto` itself and
report back, or (b) get explicit, specific authorization to add a key
before touching `authorized_keys`.

### What's next, in likely order

1. **Nothing is currently blocking.** The D155/D154 cycle is fully
   published and verified; there is no running job to babysit.
2. Whenever 2号 actually starts (see D160 — it is a "when," not "if
   upstream hasn't caught up yet"): write its publish script using the
   transfer-then-delete ordering (§2), and confirm the new
   name/description/encoding metadata (§3) actually shows up correctly
   in the resulting archive before treating that as done.
3. The two original, still-untouched 2号-readiness items from
   `PLAN.md` §8: the untested 5m/10m corruption-bug-class question
   (`PLAN.md` §3) and the dirty-tracking design decision (`PLAN.md`
   §4/D57).
4. GSI's next DEM1A update — live-checked 2026-09-11, still
   **2026-07-31** (no new update). Cadence has been roughly quarterly;
   next expected around November–December 2026. This is what actually
   gates 2号's *launch timing*, independent of the D160 policy
   question of whether to launch it at all (settled: yes).
5. Someday, not urgent (Hidenori's own framing, D160): the coastal
   erosion-gate bug fix (`hfu-mapterhorn` commit `1b6e4e1`, D114(B)/
   D116) is a genuine, generic upstream-quality bug fix (not Japan-
   specific) with both a synthetic test suite and real-data no-
   regression evidence already in hand — a strong candidate for an
   eventual upstream PR, whenever contributing upstream becomes a
   priority.
6. Resume "1.6号" once `downsampling_covering.py`'s redesign is worked
   out — untouched this whole session, still blocked on the same
   design question as before (D151).

### Also wrapped up this session, unrelated to the pipeline itself

A full project-wide inventory (repos, machine roles, timeline,
upstream sync candidates, upstream contribution candidates) was
produced as an Artifact and shared with Hidenori — it has since been
updated in place to reflect D160's decision. If you need it, it is
this session's most recently published Artifact; ask Hidenori for the
link if it isn't otherwise available to you, since a fresh session
cannot always reach a prior session's own Artifact history directly.

### Git state

All three repos (`mapterhorn-japan-bridge`, `hfu-mapterhorn`,
`japan-bridge-lineage`) were fully committed and pushed as of this
snapshot. `mapterhorn-japan-bridge` HEAD is D161's own commit chain
(latest: "D161: publish D155/D154 to stars, spot check clean, clear 3
housekeeping items"). `hfu-mapterhorn` HEAD is `010b558` (the
name/description metadata work); it has some pre-existing untracked
scratch/rehearsal files unrelated to this session
(`pipelines-rehearsal*/`, a few `screen_results_*.csv`) — leave them
alone unless you know what they are. `japan-bridge-lineage` is
unchanged since the previous handover (issue #1 closed, nothing
pending there).

If you're resuming and `git status`/`git log origin/main..HEAD` show
anything other than clean, something changed after this snapshot was
written — investigate before assuming this handover is still accurate.
