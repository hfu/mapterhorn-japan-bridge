# DECISIONS.md

Architecture Decision Records (ADR) for `mapterhorn-japan-bridge`. Each
entry has:

- **Status**: current state (`Accepted` / `Open` / `Superseded`)
- **Context**: why the decision was needed
- **Decision**: what was decided
- **Consequences**: what follows from it, and when to reconsider

This file is the *why*, kept stable. Session narrative lives in
`HANDOVER.md` instead. Same split as `japan-geotiff-dem` and the wider
`optgeo`/`hfu` family.

## Table of contents

| # | Title | Status | Date |
|---|---|---|---|
| [D1](#d1-a-separate-repo-not-inside-the-hfumapterhorn-fork) | A separate repo, not inside the `hfu/mapterhorn` fork | Accepted | 2026-08-08 |
| [D2](#d2-run-the-mapterhorn-pipeline-on-slate-not-aalto) | Run the Mapterhorn pipeline on `slate`, not `aalto` | Accepted | 2026-08-08 |
| [D3](#d3-source-store-fed-from-source-cooperative-urls-not-copied-between-machines) | source-store fed from Source Cooperative URLs, not copied between machines | Accepted | 2026-08-08 |
| [D4](#d4-deduplicate-file_listtxt-by-newest-survey-date-per-mesh-coordinate) | Deduplicate `file_list.txt` by newest survey date per mesh coordinate | Accepted | 2026-08-08 |
| [D5](#d5-skip-source_to_cogpy) | Skip `source_to_cog.py` | Accepted | 2026-08-08 |
| [D6](#d6-never-combine-jpdem1a-with-the-bridge-sources-in-one-run) | Never combine `jpdem1a` with the bridge sources in one run | Accepted | 2026-08-08 |
| [D7](#d7-japanpmtiles-a-single-ever-growing-merged-archive) | `japan.pmtiles`: a single ever-growing merged archive | Accepted | 2026-08-08 |
| [D8](#d8-verified-the-1m5m10m-priority-merge-by-reading-the-code) | Verified the 1m/5m/10m priority-merge by reading the code | Accepted | 2026-08-08 |
| [D9](#d9-added-5m10m-fallback-trial-sources-after-confirming-real-1m-gaps) | Added 5m/10m fallback trial sources after confirming real 1m gaps | Accepted | 2026-08-08 |
| [D10](#d10-custom-preview-viewer-not-rendering-bvmaphillshade) | Custom preview viewer not rendering bvmap/hillshade | Open | 2026-08-08 |

---

## D1: A separate repo, not inside the `hfu/mapterhorn` fork

**Status**: Accepted

**Context**: This bridge effort needs somewhere to keep its own
narrative (why decisions were made, what's done, what's next) and a
preview viewer. `hfu/mapterhorn` (the fork actually running the tiling
pipeline) is a natural-seeming place to put both, but Hidenori
explicitly said he doesn't want to add unrelated features there —
that fork is meant to stay close to upstream `mapterhorn/mapterhorn`,
carrying only the bug fixes documented in its own `FORK_NOTES.md`.

**Decision**: Created `hfu/mapterhorn-japan-bridge` as its own repo.
It holds `CLAUDE.md`/`DECISIONS.md`/`HANDOVER.md` for the whole bridge
effort (even the parts that execute in `hfu/mapterhorn` on `slate`)
plus a GitHub Pages preview viewer. No pipeline code of its own.

**Consequences**: Three repos now matter for this effort
(`japan-geotiff-dem`, `hfu/mapterhorn`, this one) across two machines.
See `CLAUDE.md`'s "four-way split" table — read it before assuming
which repo/machine a given task belongs to.

---

## D2: Run the Mapterhorn pipeline on `slate`, not `aalto`

**Status**: Accepted

**Context**: `aalto` (this session's main machine) is an Apple M1 with
only 8GB RAM, and its large external volume (`/Volumes/github`) is a
spinning USB HDD, not an SSD. Mapterhorn's own docs say aggregation
needs genuine SSD random access for `source-store/`, and individual
aggregation tiles can spike to ~4GB uncompressed — tight even with a
single worker on 8GB. A second machine, `slate` (Mac mini, Apple M4,
16GB RAM), has an actual portable SSD attached ("Elements SE SSD",
228GB free) and is reachable via `ssh hfu@slate.local`.

**Decision**: Do all `hfu/mapterhorn` pipeline work (source prep,
aggregation, downsampling, bundling) on `slate`, driven via SSH from
whatever machine hosts the Claude Code session. Installed `brew`,
`uv`, `gdal`, `just`, `git` there for this purpose (previously bare).
`aalto` continues to run `japan-geotiff-dem` (GeoTIFF conversion) and
`aws`/`source-coop` uploads, since those tools and credentials are
already set up there.

**Consequences**: Every pipeline command in session notes/handovers
needs the `ssh hfu@slate.local '...'` wrapper and the `brew shellenv`
eval preamble (slate's shell doesn't have Homebrew on `PATH` by
default in non-interactive SSH sessions). Uploading output requires an
extra `scp` hop back to wherever `aws` lives.

---

## D3: source-store fed from Source Cooperative URLs, not copied between machines

**Status**: Accepted

**Context**: Hidenori pushed back on an initial plan to `rsync` GeoTIFF
files directly from `aalto` to `slate`, pointing out this doesn't
match Cloud-Native Geospatial (CNG) philosophy — the canonical source
should be the published Source Cooperative bucket, not a peer-to-peer
copy between two personal machines that could drift out of sync.

**Decision**: Every `hfu/mapterhorn` source-catalog entry created for
this bridge (`jphakodatetrial1/5m/10m`, `jphokkaidodem1`) uses a
`file_list.txt` of public `https://data.source.coop/smartmaps/
japan-geotiff-dem/...` URLs, fetched via the pipeline's own
`source_download.py` — the same mechanism any external user of the
published data would use. `aalto` is never used as a file source for
`slate`.

One real constraint surfaced building this: `data.source.coop` doesn't
support anonymous bucket listing (only authenticated `aws s3 ls
--profile source-coop` does, and `slate` doesn't have `source-coop`
credentials of its own). Practical compromise: `aalto` (which does
have credentials) computes the target file list — either by listing a
narrow, already-known prefix, or by computing exact JIS regional mesh
codes for a target lat/lon and checking those specific prefixes
(much faster than a broad `/vsicurl/`-based header scan across
thousands of files — measured at ~1.6 files/sec, i.e. 2+ hours for
12,736 files, versus a handful of targeted `aws s3 ls` prefix queries
taking seconds) — and hands `slate` just the resulting URL list.

**Consequences**: Regenerating a source's `file_list.txt` currently
requires a manual step on `aalto` (list/compute candidate mesh codes,
build the list, `scp`/commit it to `hfu/mapterhorn`). Not automated;
revisit if this becomes frequent enough to be worth scripting.

---

## D4: Deduplicate `file_list.txt` by newest survey date per mesh coordinate

**Status**: Accepted

**Context**: `japan-geotiff-dem`'s `sync` is additive-only (its own
D9) — a mesh that gets a newer survey doesn't overwrite the old file
in place, it uploads under a new date-stamped filename, leaving the
old one live too. If both dates for the same mesh coordinate ended up
in a `file_list.txt`, Mapterhorn's equal-maxzoom tie-break (earlier
lexicographic filename wins, per `utils.get_grouped_source_items`)
would favor the *older* date string over the newer one — backwards
from what's wanted.

**Decision**: When building a `file_list.txt` from a set of local
filenames, group by mesh key (strip the trailing `-DEM1A-<date>.tif`)
and keep only the newest date per group before writing the URL list.

**Consequences**: This was verified clean for the trial sources (zero
duplicates found locally as of 2026-08-08), but the check only
compares within the files a given `file_list.txt` is built from — it
can't detect a stale duplicate that exists on the *remote* bucket
under a different mesh vintage if that vintage was never re-downloaded
locally. Worth a dedicated remote-side check before a real production
`jphokkaidodem1` run (noted in `jphokkaidodem1`'s own README).

---

## D5: Skip `source_to_cog.py`

**Status**: Accepted

**Context**: `hfu/mapterhorn`'s standard source-prep sequence includes
`source_to_cog.py`, which re-encodes every input to LERC compression
via `gdal_translate` (full read + write, local-file-only, doesn't
support remote URLs). `japan-geotiff-dem`'s GeoTIFFs are already
internally tiled (512×512 blocks) and reasonably compressed (ZSTD-max)
— GDAL reads either compression scheme equally well downstream in the
reproject/warp step.

**Decision**: All bridge source-catalog `Justfile`s omit
`source_to_cog.py` from their sequence.

**Consequences**: Saves a full local re-encode pass (which would also
have forced full local downloads regardless of D3's URL-based
approach, since that script can't work against `/vsicurl/`). If a
concrete correctness reason to re-encode ever surfaces (hasn't so
far), revisit per-source rather than globally.

---

## D6: Never combine `jpdem1a` with the bridge sources in one run

**Status**: Accepted

**Context**: `jpdem1a` (upstream's existing full-Japan 1m source,
produced via `hfu/fusi`) and this bridge's own 1m sources
(`jphakodatetrial1`, `jphokkaidodem1`) are both 1m — i.e. the same
maxzoom — so if both were present in `source-store/` during one
`aggregation_covering.py` run, Mapterhorn's tie-break for
equal-maxzoom sources (earlier lexicographic name wins) would apply:
`jpdem1a` < `jphokkaidodem1` alphabetically, so `jpdem1a`'s (older,
pre-update) data would win over this bridge's fresher data in any
area both cover.

**Decision**: Never populate `source-store/jpdem1a/` (or the 5m/10m
equivalents) alongside the bridge sources in the same `slate` working
tree. The bridge's own sources are the only 1m sources present when
building `mapterhorn-japan-bridge` output.

**Consequences**: This bridge and `jpdem1a` never actually get
tested together — fine, since the entire point is that they're
alternatives (use the bridge until `jpdem1a` itself is refreshed, then
retire the bridge). If this project ever needs to merge with
`jpdem1a`'s coverage for areas the bridge doesn't cover, that's a
deliberate future decision, not something to fall into by accident.

---

## D7: `japan.pmtiles`: a single ever-growing merged archive

**Status**: Accepted

**Context**: Hidenori asked whether to publish output as
`hokkaido.pmtiles` (matching current coverage) or as an always-named
`japan.pmtiles` that grows over time. Mapterhorn's own `bundle.py`
groups output by zoom-6 tile, not administrative region — Hokkaido's
actual extent already turned out to span *more than one* z6 tile once
the 5m/10m fallback sources were added (confirmed: `6-56-23.pmtiles`
and `6-57-23.pmtiles` both produced from one aggregation run), so
there's no natural single file per prefecture to point people at
without extra region-filtering logic.

**Decision**: Every time there's new output, merge **all**
currently-produced bundle files (`planet.pmtiles` + every regional
`{z}-{x}-{y}.pmtiles`) into one file, always uploaded to the same key,
`s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`. The name never
changes as coverage grows past Hokkaido toward the rest of Japan, so
the preview URL and any bookmark of it stay valid indefinitely.

**Consequences**: This is a full rebuild every time, not an
incremental append — cost grows with total coverage, not with what's
new. Accepted for now because this is an interim bridge at a modest
current scale (a few thousand tiles), not the real full-Japan-at-full-
zoom dataset. Revisit (e.g., switch to per-region files + a TileJSON
that routes between them) if coverage grows enough that "rebuild
everything on every update" becomes actually slow or expensive — that
threshold hasn't been hit as of 2026-08-08 (~3MB, seconds to rebuild).

---

## D8: Verified the 1m/5m/10m priority-merge by reading the code

**Status**: Accepted

**Context**: After the multi-resolution trial (D9) ran, Hidenori asked
a sharp, specific question: could the *lowest*-resolution source
(10m) actually be overwriting the higher-resolution ones (5m, 1m)
instead of only filling their gaps — i.e., is "highest priority" being
implemented as "painted first, then covered over" rather than "base
layer, only gaps filled from below"? This is exactly the kind of bug
that would be easy to get backwards and hard to notice visually.

**Decision**: Read the actual implementation rather than trusting the
prose docs. Confirmed in `utils.get_grouped_source_items()`: source
groups are sorted by `(-maxzoom, source, filename)` ascending, so the
*highest* maxzoom (most important) sorts *first*. Confirmed in
`aggregation_merge.py`: the merge starts with group 0's pixels as
`merged_tile`, and for every subsequent (lower-priority) group only
does `copy_mask = (merged_tile == -9999) & (current_tile != -9999)` —
it is structurally impossible for a later (lower-priority) group to
overwrite a pixel the earlier group already filled.

**Consequences**: The priority-merge logic is sound; the "detail looks
soft" unease that prompted this question has a more mundane
explanation instead — see `HANDOVER.md`'s note on this session's
viewer debugging (likely: judging fidelity from a low/wide-zoom
screenshot due to the official viewer's camera-position bug, not an
actual data or merge problem). Don't re-litigate the merge-direction
question without a specific new reason; it's been read line by line
once already.

---

## D9: Added 5m/10m fallback trial sources after confirming real 1m gaps

**Status**: Accepted

**Context**: Hidenori asked whether Mt. Hakodate / Goryokaku would
need 5m/10m mixing, floating "maybe it's just water where 1m is
missing" as the null hypothesis. Checked directly: computed the JIS
mesh code for Mt. Hakodate's summit (41.7631, 140.7100 → 2nd-mesh
`624055`), and confirmed only 13 of the 100 possible 1km cells in that
block have 1m coverage locally — the summit's own cell is not one of
them. This is real land, not water; a genuine 1m survey gap.

**Decision**: Added `jphakodatetrial5m` and `jphakodatetrial10m`
source-catalog entries (same Hakodate/Goryokaku area, fed from
`japan-geotiff-dem`'s `5/` and `10/` prefixes) alongside
`jphakodatetrial1`, and re-ran the full pipeline with all three
present. Result: 499 aggregation items (up from 2 with 1m alone) —
confirms the combined coverage footprint is meaningfully larger than
1m's alone, consistent with 5m/10m genuinely filling gaps.

**Consequences**: For `jphokkaidodem1` (the real, full-Hokkaido run,
not yet attempted), plan on needing equivalent 5m/10m fallback
source-catalog entries covering all of Hokkaido, not just the Hakodate
trial area — 1m coverage gaps are apparently real and not
geographically rare.

---

## D10: Custom preview viewer not rendering bvmap/hillshade

**Status**: Open

**Context**: Built a GitHub Pages viewer (`index.html`/`app.js`/
`style.json` in this repo) reusing `hfu/kitavolca`'s basemap+hillshade+
3D-terrain pattern, specifically to get a better/more diagnostic
preview than the bare official `mapterhorn.com/viewer` (no basemap,
unreliable camera-position URL param). Deployed to
`hfu.github.io/mapterhorn-japan-bridge/`.

Observed: the page loads without JS errors, MapLibre controls render,
and the attribution control shows the `bvmap` source's attribution
string (`国土地理院最適化ベクトルタイル`) — meaning the style itself
parses and loads successfully, including the `bvmap` source
definition. But the map canvas shows nothing (confirmed via a WebGL
`readPixels` probe on the official viewer's blank state, and via
repeated visual/network inspection on this repo's own viewer): the
`bvmap` vector layers never render, and network logs show **zero**
requests ever made to `stars.optgeo.org` (the bvmap tile host) across
multiple fresh loads. `window.onerror`/`unhandledrejection` handlers
were added and caught nothing. One PMTiles hillshade tile fetch
(`data:image/webp` response) did succeed per load, but the hillshade
layer isn't visibly rendering either, and the "Mapterhorn" portion of
the custom `mapterhorn` source's attribution string never appears in
the attribution control (suggesting MapLibre doesn't consider that
source "in use" by any active layer, despite `style.layers` containing
a `hillshade` layer with `source: "mapterhorn"`).

**Not yet root-caused.** Candidate directions not yet tried:
- Check whether `stars.optgeo.org` sends CORS headers permissive
  enough for `hfu.github.io` as a cross-origin caller (kitavolca's own
  deployment may be on a different origin that's specifically
  allowlisted, or no allowlist exists and this should just work — not
  verified either way).
- Check MapLibre GL JS version compatibility — this repo pins `@4` via
  unpkg like kitavolca does, but worth diffing exact resolved versions.
- Instrument `map.on('sourcedata', ...)` and `map.on('styledata', ...)`
  events directly (more granular than the coarse `error` event
  already wired up) to see whether the `bvmap` source ever transitions
  to a loaded/visible state at all, and whether any tiles are
  requested-and-rejected (as opposed to never-requested).
- Try the same style.json against a plain local static server (not
  GitHub Pages) to rule out anything Pages-specific (base path,
  service worker caching, etc.).

**Decision**: Documented as an open item rather than debugged further
in this session (time-boxed ahead of a context `/clear`). The official
`mapterhorn.com/viewer` remains the fallback for now — confirmed
working (real hillshade renders there, away from Hakodate at a wider
zoom).

**Consequences**: Until resolved, this repo's own viewer doesn't yet
deliver its intended value (a better fidelity-check than the official
viewer). Pick up the candidate directions above on resume.
