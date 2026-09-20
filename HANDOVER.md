# HANDOVER

Session log for `mapterhorn-japan-bridge`. Read `START_HERE.md` first
if this is your first time in this project at all; read `CLAUDE.md`
for the standing rules (especially the repo×machine split table) and
`DECISIONS.md` for why things are the way they are; this file is what
actually happened, session by session.

**Compacted 2026-09-13, compacted again 2026-09-19**: both the 2026-09-11
(D156-D161) and the 2026-09-17 (D162-D173, 1.6号's launch) "current
state" sections have been moved into `HANDOVER-archive.md`, unedited.
This file keeps only the current state and a short recent-context
summary. Compact again the same way once this file itself grows
unwieldy — archive everything above the current-state section, keep
only a fresh snapshot.

**This handover is deliberately long.** The outgoing session expects
to be cleared and a fresh agent to pick up from here with zero memory
of what happened — read it in full before touching anything, especially
the strategic decision below and the exact next step in "What's next".

## Current state (2026-09-19): D174-D178 -- the "壁" (wall) problem, found, root-caused, designed, implemented, and PUBLISHED LIVE to `stars`. 1.6号's own launch (D162-D173) is unaffected and still live; this is a real fix layered on top of it

**The short version**: days after 1.6号 launched (D173), a visual spot-check of small/remote islands (波照間島 Hateruma, 久場島 Kuba-jima/Senkaku) found a real, ugly artifact in the 3D terrain viewer -- a vertical "wall" where MapLibre renders a giant cliff. This turned out to be a genuine, nationwide, previously-undetected characteristic of the archive (not new to 1.6号 -- present in 1.5号 too, just never spotted before), was root-caused all the way to a real Copernicus GLO-30 upstream data gap, designed and re-designed through two independent Opus reviews that each caught real, serious problems in the proposed fix, implemented as real committed pipeline code, run for real against production, and published live. **As of this snapshot, the fix is live on `stars` and directly verified against the public service.** Read `DECISIONS1.md` D174 through D178 for the full, detailed arc -- this section is a compressed summary; the detail file has exact numbers, code, and reasoning for every step.

**Read in this order if you want the full story**: D174 (investigation: root cause, scope, two design reviews, the exact upstream MapLibre bug identified) is the longest and most important; D175 (a quick, independent viewer-side mitigation) is a side branch; D176 (prototype implementation, verified, a real bug caught mid-implementation) and its own promotion-to-committed-code addendum (which caught a SECOND instance of nearly the same bug during promotion -- a genuinely important methodological lesson, see below); D177 (the real production run against `bundle-store/`); D178 (the actual `stars` publish, live-verified).

### 1. D174: the wall problem -- root cause, scope, and a staged design that survived two rounds of adversarial review

Hidenori's own visual spot-check (the same D79/D172 practice, now applied to more remote locations post-launch) found large vertical walls in 3D terrain view at two small islands. Investigated methodically:

- **Ruled out**: raw data corruption (no `-9999`/`-32768`-class values anywhere sampled), a pyramid-depth hole near the islands themselves (both have real data to z16), a D165 #1 regression (directly diffed 1.5号 vs 1.6号 tile presence at the same positions -- byte-identical, this predates 1.6号 entirely).
- **Root cause, confirmed three independent ways**: the specific missing tiles correspond to 1-degree cells genuinely absent from Copernicus GLO-30's own global inventory (not a curation gap -- verified against `source-catalog/glo30/file_list.txt`, a live HEAD check against the real upstream AWS bucket returning a genuine 404, and upstream Mapterhorn's own `tiles.mapterhorn.com` 404ing at the exact same positions). **Nothing to re-download; this is a real, permanent gap in the world's most widely-used sea-level DEM fallback.**
- **Scope is nationwide, not two islands**: 13.2% of land-containing tiles at z9 sit directly adjacent to a missing tile, spread across Senkaku, Hateruma, southern Okinawa, Yaku-shima/Tanega-shima, Tsushima/Goto, the Shimane coast, offshore Chiba, Shakotan, the Kurils, Okinotorishima, Minamitorishima, and the Iwo-jima/Ogasawara chain. Confirmed present since at least 1.5号.
- **The exact upstream MapLibre bug identified by reading its own source and issue history**: PR #5392 diagnoses this project's own tile server (Martin) by name -- missing (204) raster-dem tiles get stored as degenerate 1x1 images, producing rendering glitches. The actual fix (PR #8207, merged 2 weeks before this investigation) is already live in maplibre-gl 6.10.0 -- but this project's own viewer was pinned to v4 at the time (see D175).
- **Two independent Opus design reviews**, launched separately (not nested), each found real problems: the first review corrected the original design's fill-scope math (the sea source tops out at z12, so filling z13-z16 would mean synthesizing the entire ocean, ~86M tiles -- staged the fix to z8-z12 instead, which covers both actual reported cases). The second review found three real blockers in even the staged design: (1) the proposed rectangular fill box would have stamped fake 0m sea level over REAL foreign land (Luzon, Sakhalin, Kamchatka, Beijing) -- fixed by using the GLO-30 global inventory itself as a free, precise land mask; (2) the z0-7 global overview's OWN gaps needed completing first, or the fill would create real orphans; (3) `pmtiles merge` copies metadata from its FIRST input only -- ordering matters.
- **Decision (Hidenori, "欠損位置に合成0mタイルを差し込むことを承認する")**: approved the synthetic-fill direction (Option 2). Later ("z8-z12を本番実行・再公開(推奨)"): proceed with the staged z8-z12 fix now, treat any z13+ extension as an explicitly separate, deferred follow-up rather than a blocker -- partly because D175 already reduces the urgency for this project's OWN viewer specifically.

### 2. D175: bumped the preview viewer's MapLibre GL JS from v4 to v6

Independent, safe, viewer-only change: `index.html`/`app.js` now load `maplibre-gl@6` (ESM-only now, no more classic global-script build -- `app.js` uses a namespace `import` so every existing `maplibregl.X` call needed no further changes). v6 already contains the upstream fix for the exact PR #5392 bug. Verified via CHANGELOG review, live HTTP/CORS checks, and a local Node import test (this session has no working browser -- `claude-in-chrome` never connected all session). **Does not touch or substitute for the archive-level fix** -- other consumers (Source Cooperative, Oliver Wipfli, the official viewer, anyone on an older MapLibre) still need the archive itself fixed.

### 3. D176: implementation, verified as a prototype, then promoted to real committed code -- catching the SAME bug twice

Built the actual fix: `glo30_land_mask.py`-equivalent logic (a free, precise land mask from the GLO-30 inventory), a canonical 0m/nodata fill tile generated via this project's own `utils.save_terrarium_tile()`-equivalent encoding path, and a top-down, parent-gated enumeration (a position is only filled if its own PARENT is resolvable -- real, or already filled) -- this last part exists because the FIRST naive version (checking each zoom's mask-eligibility independently) produced 759 genuine orphans: a fine child tile's small footprint can be 100% GLO-30-absent while its own larger, coarser parent touches one additional cell that DOES have real data, and if that parent is also absent from the real archive, the child becomes an orphan. Fixed, reverified: zero orphans against the full real 273GB archive.

**Promoted to real, committed code** (`hfu-mapterhorn/pipelines/build_wall_fix_archive.py`, `d7eedee`) -- partly because this session's own scratchpad was wiped once already by an unrelated restart, losing real verified work that had to be rebuilt from scratch. **Promoting the logic reintroduced the exact same class of bug**: the committed script's z8-parent check consulted only the z0-7 fill archive, not the real z0-7 overview itself, undercounting the fill by ~15%. Caught immediately by diffing the promoted script's own output against the prototype's already-verified numbers (NOT by any structural check -- `pmtiles verify` passed both the buggy and the correct version). **Lesson worth remembering**: a bug fixed once in a prototype is not automatically safe once the same logic is retyped into a "cleaner" committed version -- always re-verify a promoted/rewritten script against the original's own known-good numbers, not just against generic structural checks.

### 4. D177: the real production run against `bundle-store/`

Built both fill archives against real production data (exact match to every prior verified number: 8,321 z0-7-completion tiles, 152,267 z8-z12 tiles), merged into the live 272.9GB elevation archive (`pmtiles merge`, real archive first for correct metadata inheritance), and verified thoroughly BEFORE touching anything: `pmtiles verify` clean, `addressed_tiles_count` matches the exact expected sum (3,461,089 + 8,321 + 152,267 = 3,621,677), `check_pmtiles_integrity.py` -- this project's own official orphan checker, the same one D172 used to certify the original archive clean -- reports **CLEAN, zero orphans**, both originally-reported wall tiles decode correctly (0m, alpha=0), and real neighboring data is untouched. Swapped into `bundle-store/mapterhorn-japan-bridge.pmtiles` locally; old version preserved as `*.pre-wallfix-20260919`, not deleted. Fill archives themselves retained as a small (<2KB) provenance record.

### 5. D178: published to `stars`. Live. Verified against the actual public service

Same transfer-then-atomic-rename procedure as D173 (`scp` as `.new`, remote MD5 matched local exactly this time -- `8ed3ac39e210e2ad6f187143c4cddf20` -- and completed quickly rather than being I/O-starved like D173's own ~20-hour experience, plausibly because `stars`' own load-testing had concluded by then), atomic rename with the pre-fix version preserved as a dated backup. **Verified live, directly against the public endpoint**: both originally-reported wall positions (`9/431/216` north of Kuba-jima, `9/432/221` south of Hateruma) now return `200`/52 bytes where they previously returned `204`. A real, untouched position (Mt. Fuji) still serves its own genuine data unchanged.

### What's next, in likely order

**Updated 2026-09-20 (D179, pre-2号 planning pass) — see that entry for the full writeup.** GSI re-checked live: still 2026-07-31, no change. Both repos confirmed clean/pushed. One real gap found and now tracked in `PLAN.md` §8: the wall fix was never written down as a step 2号's own launch must perform. Read `PLAN.md` §8 directly before starting 2号 prep — it now has two new ⬜ items (wall-fix reapplication, `LAND_UPSAMPLE_ZOOM_BY_GENERATION` same-commit discipline) plus one item corrected from ⬜ to ✅ (the publish-script transfer-then-delete reordering — already done via D173/D178, the checklist just hadn't been marked).

1. **Nothing is currently blocking or running.** The wall fix is live, verified, done.
2. **[Updated D179]** When 2号 launches, its own fresh archive must have the wall fix re-applied before publish — `build_wall_fix_archive.py` is generation-agnostic and mechanically ready, but this step was missing from any checklist until D179 added it to `PLAN.md` §8. Do not skip it assuming 2号 "inherits" 1.6号's fix; 2号 rebuilds `jpnationalsea` coverage from scratch and will reproduce the same Copernicus GLO-30 gap.
3. **The z13+ extension** -- explicitly deferred, not forgotten. The staged z8-z12 fix covers both originally-reported cases and 13.2% of nationwide z9 exposure; whether deep ocean (z13-z16) actually shows the same wall in practice was never empirically confirmed (this whole session had no working browser). Revisit when: (a) a peer session or Hidenori can do a live-viewer check at z14 over open water ~30km off Tsushima, or (b) 2号 prep naturally revisits this area. If pursued, the same `build_wall_fix_archive.py` script's approach generalizes (would need a third mode or an extended zoom range, plus re-checking the ~86M-tile-scale cost this time since the staging was specifically to avoid that).
4. GSI's next DEM1A update — live-checked 2026-09-20, still 2026-07-31 (no new update). Gates 2号's launch timing (the decision to launch it at all is already settled, D160).
5. D172's own 116-tile lineage orphan gap (z8, both 1.5号 and 1.6号) -- real, pre-existing, low-severity, not investigated further this session. Still open.
6. D170's reuse-fingerprint producer-version gap -- still open, same framing as before (cheap mitigation #2 whenever convenient, fingerprint-definition change #1 only right before a toolchain upgrade).
7. `bundle.py`'s own non-atomic `create_archive()` -- still open (D171).
8. cafebabe (a peer session) was asked to visually confirm D175's viewer upgrade in a real browser; no reply had arrived as of D179's own check. Worth checking `stars` conversation/peer messages for a reply, or re-asking, next session.
9. Someday, not urgent (D160's own framing): the coastal erosion-gate bug fix (`hfu-mapterhorn` commit `1b6e4e1`) remains a real upstream-PR candidate.
10. Someday, not urgent, surfaced by D174 but not required: report the shared upstream Copernicus GLO-30 inventory gap to Oliver Wipfli (D174 found it also affects upstream Mapterhorn's own `tiles.mapterhorn.com`, not just this project).

### Git state

Both repos should be fully committed and pushed as of this snapshot — verify with `git status --short` (expect clean, modulo `hfu-mapterhorn`'s own long-standing untracked scratch files: `pipelines-rehearsal*/`, `screen_results_jpnational{5,10,sea}.csv`, `stale_done_manifest.txt` -- leave these alone) and `git log origin/main..HEAD` (expect empty) in both before trusting this note. `mapterhorn-japan-bridge` HEAD is this session's own D178 documentation commit (`f270b59`). `hfu-mapterhorn` HEAD is `d7eedee` (`build_wall_fix_archive.py`, the committed production script). `bundle-store/` on `slate` now holds: the wall-fixed `mapterhorn-japan-bridge.pmtiles` (live/current), `mapterhorn-japan-bridge.pmtiles.pre-wallfix-20260919` (preserved backup), `mapterhorn-japan-bridge-lineage.pmtiles` (untouched), and `wall-fix-z0-7.pmtiles`/`wall-fix-z8-z12.pmtiles` (small provenance record, ~4KB combined) -- none of these last three should be deleted without a specific reason. `stars` mirrors the same live/backup split for the elevation file.

If you're resuming and `git status`/`git log origin/main..HEAD` show anything other than clean, something changed after this snapshot was written — investigate before assuming this handover is still accurate.

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
