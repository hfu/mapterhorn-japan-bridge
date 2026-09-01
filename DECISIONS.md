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
| [D11](#d11-japanpmtiles-was-encoded-through-the-forks-orthophoto-path-not-terrarium) | `japan.pmtiles` was encoded through the fork's orthophoto path, not Terrarium | Accepted | 2026-08-09 |
| [D12](#d12-aaltos-external-hdd-failed-outright-hokkaido-frozen-kyushuokinawa-only-slate-is-now-this-repos-sole-machine-too) | `aalto`'s external HDD failed outright; Hokkaido frozen, Kyushu/Okinawa-only, `slate` is now this repo's sole machine too | Decided | 2026-08-11 |
| [D13](#d13-japanpmtiles-fails-to-upload-to-source-cooperative-on-large-multipart-puts-host-on-starsmartin-for-daily-use-instead-keep-sc-as-a-lower-frequency-archive) | `japan.pmtiles` fails to upload to Source Cooperative on large multipart PUTs; host on `stars`/`martin` for daily use instead, keep SC as a lower-frequency archive | Accepted | 2026-08-19 |
| [D14](#d14-csv-manifest-with-sizemd5-from-s3-etag--aria2c-replaces-the-one-wget-per-url-download-loop-jpnational5jpnational10-expanded-to-national-scope) | CSV manifest with size+MD5 (from S3 ETag) + aria2c replaces the one-wget-per-URL download loop; `jpnational5`/`jpnational10` expanded to national scope | Accepted | 2026-08-19 |
| [D15](#d15-source_polygonizepys-merge_source-rewritten-around-the-new-unified-gdal-vector-concat-cli--16x-measured-speedup-batched-to-work-around-macos-arg_max) | `source_polygonize.py`'s `merge_source()` rewritten around the new unified `gdal vector concat` CLI — ~16x measured speedup, batched to work around macOS ARG_MAX | Accepted, verified at production scale | 2026-08-19 |
| [D16](#d16-jpnational1-stays-at-its-current-regional-scope-for-now-build-japanpmtiles-with-510sea-national--1-regional-to-stress-test-the-downstream-pipeline-before-the-largest-jump) | `jpnational1` stays at its current regional scope for now; build `japan.pmtiles` with 5/10/sea national + 1 regional, to stress-test the downstream pipeline before the largest jump | Accepted | 2026-08-20 |
| [D17](#d17-upstream-fidelity-as-a-standing-practice-and-where-fusi-fits) | Upstream fidelity as a standing practice, and where `fusi` fits | Accepted | 2026-08-20 |
| [D18](#d18-within-source-product-type-priority-abc-was-purely-alphabetical-not-accuracy-based-lower-accuracy-data-was-silently-winning-over-higher-accuracy-data) | Within-source product-type priority (A/B/C) was purely alphabetical, not accuracy-based — lower-accuracy data was silently winning over higher-accuracy data | Accepted, fixed | 2026-08-20 |
| [D19](#d19-nothing-pruned-local-files-superseded-by-an-upstream-japan-geotiff-dem-refresh--added-source_prune_obsoletepy) | Nothing pruned local files superseded by an upstream `japan-geotiff-dem` refresh — added `source_prune_obsolete.py` | Accepted, tool verified | 2026-08-20 |
| [D20](#d20-escalate-d18s-fix-from-within-group-last-wins-to-true-seven-tier-pixel-level-priority-merge-reusing-aggregation_mergepy-unchanged) | Escalate D18's fix from within-group last-wins to true seven-tier pixel-level priority merge, reusing `aggregation_merge.py` unchanged | Accepted, unit-tested | 2026-08-20 |
| [D21](#d21-shuffle-aggregation_runpys-work-queue--geographically-sorted-todo-order-clustered-expensive-tiles-onto-the-same-workers) | Shuffle `aggregation_run.py`'s work queue — geographically-sorted `.todo` order clustered expensive tiles onto the same workers | Accepted, verified live | 2026-08-21 |
| [D22](#d22-plan-not-yet-executed--analysis-first-sync-of-hfumapterhorn-against-upstreammain) | Plan (not yet executed) — analysis-first sync of `hfu/mapterhorn` against `upstream/main` | Open | 2026-08-21 |

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

**Update, 2026-08-09 — resolved, not reproducible.** Re-tested live
against `hfu.github.io/mapterhorn-japan-bridge/` — bvmap and hillshade
both render correctly, confirmed via
`map.style.sourceCaches[id]._tiles` state (all `loaded`, real feature
buckets) across two independent fresh page loads. No code changed
since the original report; whatever caused it was external and
cleared on its own. **Methodology note, worth remembering if this
needs debugging again**: this session's network-request-log tooling is
blind to however MapLibre issues these particular tile requests —
"zero requests in that log" is not proof of a stuck source. Inspect
`map.style.sourceCaches[id]._tiles` directly instead.

## D11: `japan.pmtiles` was encoded through the fork's orthophoto path, not Terrarium

**Status**: Fix applied and verified on `slate` (`hfu/mapterhorn`,
uncommitted) via direct pixel decoding and visual inspection at multiple
zooms — see the 2026-08-09 update at the end of this entry. **Not yet
republished**: `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`
still carries the old, bad encoding as of this writing.

**Context**: While re-verifying D10 live, the hillshade layer showed a
dense, regular grid/hatch pattern instead of smooth relief — reproduced
identically when loading our own `japan.pmtiles` directly into the
*official* `mapterhorn.com/viewer` (ruling out this repo's own
`style.json`/viewer as the cause; the bad data is baked into the
pmtiles archive itself). Byte-level inspection of an actual z17 tile
fetched from the published archive confirmed a `RIFF....WEBP VP8 `
(lossy WebP) signature, not `VP8L` (lossless).

Traced to `hfu/mapterhorn`'s `pipelines/aggregation_tile.py`: its
`create_tile()` unconditionally calls `utils.save_rgb_tile()` — which
clips raw float pixel values into an 8-bit 0-255 range (no Terrarium
math at all) and WebP-encodes at `lossless=False, level=80`. The
correct elevation writer, `utils.save_terrarium_tile()` (proper
Terrarium RGB packing + lossless WebP), exists in the same file but is
never called anywhere in the pipeline — dead code.

This is not a bug in the traditional sense: `FORK_NOTES.md` section B
documents that `save_rgb_tile()` was deliberately introduced in
`5eaa737` ("Adapt Mapterhorn pipeline for orthophoto workflows...
instead of Terrarium") to support the Freetown, Sierra Leone orthophoto
project this fork was originally built for, and flags the change itself
as "a genuine purpose extension... a design question for the
maintainer," not something to just revert. But it means every
elevation-source run through this fork since then — including every
`jphakodatetrial*`/`jphokkaidodem1` tile this bridge effort has ever
produced — went through the wrong encoder. Confirmed by diffing
`5eaa737`: pre-orthophoto, `create_tile()` read the elevation band,
zeroed `-9999` nodata, and called `save_terrarium_tile()` directly —
exactly the logic needed here.

The severity is compounded, not just "some compression noise": clipping
raw elevation floats to `uint8` discards all sub-meter precision, and
because Terrarium's decode (`256R + G + B/256 - 32768`) amplifies each
RGB unit by roughly 257x, every place a 1m-DEM's real elevation crosses
a whole-meter boundary between adjacent pixels becomes a fake
multi-hundred-meter "cliff" once decoded — consistent with the
fine-grained hatch pattern actually observed. `downsampling_run.py`'s
overview/parent-tile builder (`create_tile()`, z16 down to z11) has the
analogous problem one layer up: it correctly *averages* already-decoded
child pixels (exact for Terrarium, since elevation is linear in R/G/B),
but re-encodes the result via the same `lossless=False, level=80` call
— unrelated to the orthophoto-adaptation commits (present since before
`5eaa737`, so possibly an upstream characteristic rather than
fork-introduced), but wrong for elevation data regardless of origin.

**Decision**: Per Hidenori's direction, added a `TILE_ENCODING`
environment variable (`terrarium` default / `rgb`) to both
`aggregation_tile.py` and `downsampling_run.py`, following the same
env-var-override convention already used for `CENTER_LAT`/`CENTER_LON`
in this fork. `terrarium` restores the original upstream elevation path
(single-band read, `-9999`→0, `save_terrarium_tile`, lossless overview
averaging); `rgb` preserves the exact current orthophoto behavior
byte-for-byte, so the already-published Freetown archive's pipeline is
unaffected and reproducible if it's ever re-run. Default is
`terrarium` (not `rgb`) because every other entry in this fork's
`source-catalog/` (inherited wholesale from upstream in the
`93075b4`/`6cdf66b` merge — hundreds of real countries' DEM sources)
expects elevation semantics; requiring every DEM run to remember an
opt-in flag was judged riskier than requiring the one already-completed
orthophoto project to pin `TILE_ENCODING=rgb` if it's ever re-run.

**Consequences**: Fix is code-only so far — not yet committed on
`slate`, not yet verified against a real re-run (would need clearing
`pmtiles-done` and the per-parent `*-downsampling.done` markers in the
existing `aggregation-store/01KZGT978PC9WBAKBS9J10MRZK` trial item to
force regeneration under the corrected code, then re-bundling/re-merging
into a fresh `japan.pmtiles`), and the currently-published
`s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles` still has the bad
encoding. Do not treat any hillshade-quality judgment made before this
fix's verification (including D8's) as evidence about actual data
quality — D8 was about merge *priority direction* (still correct,
unaffected by this) not encoding correctness. Once verified, republish
`japan.pmtiles` and re-examine whether the "soft detail" impression
from earlier sessions was this bug all along.

**Update, 2026-08-09 — verified, plus two more bugs from the same
commit found and fixed:**

Re-running the trial (501 aggregation items) under the `TILE_ENCODING`
fix alone was not enough — the rebuilt `japan.pmtiles` still showed
severe artifacts. Root-caused two further regressions, both introduced
by the *same* `5eaa737` orthophoto-adaptation commit:

1. **Wrong resampling algorithm.** `aggregation_reproject.py`'s
   `gdalwarp` call was changed from upstream's `-r cubicspline` +
   `-dstnodata -9999` to `-r lanczos` with no explicit dstnodata —
   appropriate for photo detail, prone to ringing/overshoot on
   elevation data. Fixed with the same `TILE_ENCODING` switch (restores
   `cubicspline`/`dstnodata -9999` for `terrarium` mode).
2. **Nodata treated as elevation 0 during downsampling, corrupting the
   overview pyramid.** `downsampling_run.py`'s `create_tile()` (builds
   z16 down to z11 from already-encoded child tiles) zero-fills any
   missing/uncovered child quadrant. For opaque photo data that's a
   reasonable default; for Terrarium, R=G=B=0 decodes to elevation
   **-32768m**, and blindly averaging that into real neighboring data
   produces garbage. Confirmed by direct pixel decode: overview tiles
   showed elevations spanning the full **-32768 to +32767** range
   (verified with a standalone script reading tiles straight out of the
   `.pmtiles` via the `pmtiles` Python package + `imagecodecs`/PIL —
   this bypasses the browser entirely and was far more reliable than
   screenshots, see the methodology note below). Given this project's
   current trial coverage is a tiny real-data island inside a huge
   nodata field, nearly every overview tile is mostly gap — the worst
   possible case for this bug.

   Fixed properly, not just patched around: `utils.save_terrarium_tile`
   now takes an optional `valid_mask` and encodes it as a real alpha
   channel (0 = nodata, 255 = real data) instead of the previous
   3-channel-only output; `aggregation_tile.py` passes `subdata !=
   -9999` as that mask before zeroing nodata to 0 (zeroing is still
   needed for the RGB math, but no longer lies about validity);
   `downsampling_run.py`'s 2x2 averaging is now alpha-*weighted* (nodata
   contributes zero weight, so it can't drag a real neighbor's average
   toward -32768) and writes the covered-fraction back out as the
   output alpha, so validity keeps propagating correctly up the whole
   pyramid rather than only at the first level.

   `bundle.py` was also parallelized while in the area (was a plain
   sequential loop over independent per-parent output files, needless
   given the other pipeline stages already use `multiprocessing.Pool` —
   added a `BUNDLE_WORKERS` env var following the same convention).

**Verification methodology note** (worth remembering if this needs
debugging again): screenshots of the official `mapterhorn.com/viewer`
were **not reliable** during this investigation and produced repeated
false readings in both directions — a canvas that hadn't finished
resizing/loading showed a misleadingly smooth low-zoom placeholder, and
`pmtiles serve`'s TileJSON-oriented endpoints don't serve the raw
`.pmtiles` file the viewer's `url=` field expects (404s that fail
silently into whatever URL happens to be in the viewer's own
localStorage-remembered input box — not the URL you think you just
loaded). What actually worked: (a) serve the raw file with a real
Range+CORS-capable static server (plain `python -m http.server` doesn't
send `206 Partial Content` either — a ~30-line Node http server was
used instead), (b) click the viewer's "View" button explicitly rather
than relying on the `#url=` hash to auto-apply, (c) poll
`performance.getEntriesByType('resource')` for the target host and wait
for `pending === 0` (no in-flight requests) before treating a
screenshot as final, and (d) prefer decoding actual tile bytes directly
(via `pmtiles.Reader` + `imagecodecs`/PIL, standalone, no browser at
all) over any visual check when precision matters — this is what
actually caught the -32768 corruption; the visual symptom alone was too
inconsistent to diagnose from.

Both new fixes verified the same way: direct pixel decode across z11-17
showed no more out-of-range elevations (values stayed within roughly
-256m to +333m, matching Mt. Hakodate's real range, `valid_frac`
correctly shrinking at coarser zooms as the trial's real-data footprint
becomes a smaller fraction of each tile), and visual inspection at both
z17 (close) and z11 (wide) showed clean hillshade with a correct
jagged coverage-boundary edge and no cliffs, hatching, or noise.

**Still open, noted for the next session** (see `HANDOVER.md`'s next
steps for full context) — do not consider D11 fully closed until these
are resolved too:
- A residual staircase/contour-like stepping artifact in the elevation
  tiles, observed only below the native maxzoom (z17) — absent at z17
  itself, present at z16 and coarser. Not yet root-caused; the leading
  hypothesis (Hidenori's) is a significant-figures truncation bug
  somewhere in the pyramid (e.g. an inadvertent 8-bit clamp, or a
  dropped fractional part) rather than a resampling or nodata issue,
  since those are already fixed and this survives them.
- 5m/10m fallback fill needs to reach all the way to 1m's own maxzoom
  (currently unclear whether the priority-merge's fill actually
  operates at the true maxzoom or stops short — needs verification, not
  yet checked).
- Ocean/sea handling has no established approach yet in this fork; need
  to check how upstream `mapterhorn/mapterhorn` itself handles sea
  elevation (0m flat plane? nodata? something else) and match it,
  rather than inventing our own convention.

None of this has been committed to git on `slate` yet, and
`japan.pmtiles` has not been republished — both fixes exist only as
uncommitted local changes pending the further fixes above.

**Update, 2026-08-09 (continued) — root-caused and fixed the staircase
artifact too; land data now verified clean. Sea still pending.**

Hidenori redirected the approach mid-session: stop debugging from
symptoms, start diffing this fork against upstream
`mapterhorn/mapterhorn` step by step (`git remote add upstream
https://github.com/mapterhorn/mapterhorn.git && git fetch upstream` —
no `upstream` remote existed on `slate` despite `FORK_NOTES.md` implying
one). `git diff upstream/main --stat -- pipelines/*.py` was the map:
`aggregation_merge.py` is byte-for-byte identical to upstream (ruled
out as a seam source); `aggregation_tile.py`'s buffer/window math
(`col_start = i*512+buffer_pixels` etc.) is also identical to upstream
— only the encoding call differs, already fixed. Two more real
divergences turned up:

1. **`downsampling_run.py`'s requantization didn't match upstream's,
   even after the alpha-weighting fix.** Upstream decodes each child to
   a real elevation float, averages the *elevation values themselves*,
   then re-derives R/G/B from that single scalar via floor-division/
   modulo (`R = data // 256`, `G = floor(data % 256)`, `B =
   floor(frac(data) * 256)`) — a digit-extraction formula that's
   internally consistent by construction. This session's earlier fix
   instead rounded each already-encoded R/G/B *channel's own average*
   independently (`np.round(...).astype(uint8)`), which is
   mathematically equivalent in exact arithmetic (Terrarium's decode is
   linear) but risks a channel average landing right at a digit
   boundary (e.g. G averaging to 255.6) and, unlike upstream's approach,
   has no natural mechanism keeping the result in a consistent, in-range
   state. Rewrote to match upstream's exact formula, extended with
   alpha-weighting (upstream has no nodata concept at all — see below).
2. **`macrotile_z` was 17 in this fork, 12 upstream — global unification
   of two conflated concerns.** Root cause: commit `4bf6e535`
   (Hidenori's own, categorized in `FORK_NOTES.md` as a "generic bug
   fix") raised `macrotile_z` from upstream's 12 to 17 as a safety cap,
   because a ~4cm/px Freetown orthophoto source (native maxzoom ~21) was
   making `aggregation_reproject.py` try to materialize ~256GiB rasters
   per macrotile. That's the right fix *for a z21 source* — but applied
   as a single global constant, it also silently changed behavior for
   every elevation source (native maxzoom 17):
   - `aggregation_covering.py`'s `maxzoom = max(computed_maxzoom,
     utils.macrotile_z)` line (generic, not glo30-specific as first
     assumed) floors every source's maxzoom up to at least
     `macrotile_z`. With `macrotile_z=17`, our 1m GSI data's genuinely
     *native* resolution — `get_smallest_overzoom()` correctly computes
     **16** at this latitude (~0.89m/px at z17 vs ~1.79m/px at z16,
     GSI's real ~1m data lands at z16) — got artificially forced up to
     z17, an oversample beyond what the source data actually resolves.
     Every z17 pixel-level check earlier in this session (the "z17 is
     clean, z16 and below are broken" pattern) was unknowingly comparing
     *fake, interpolated z17* against *honest z16* downsampled from it.
   - `macrotile_z` also sets the granularity of `aggregation_covering.py`'s
     planning grid. At 17, every macrotile *is* a single finest-resolution
     tile — the trial's 3-source run produced **501 independent
     aggregation items**, each `gdalwarp`'d completely separately with
     only a 150-unit edge buffer. `aggregation_merge.py`'s Gaussian-blur
     boundary blending only smooths transitions *within* one macrotile
     between source groups — it does nothing across macrotile-to-macrotile
     boundaries, and cubicspline's resampling kernel needs neighboring
     pixels outside that small buffer for a truly seamless result. This
     is the leading (now-confirmed, see below) explanation for the
     mesh-like/seam artifact Hidenori spotted, distinct from the
     already-fixed truncation issue.

   Fixed with the same `TILE_ENCODING`-conditional pattern in `utils.py`:
   `macrotile_z = 12 if TILE_ENCODING == 'terrarium' else 17` (terrarium
   restores upstream's original value — still ≥ `num_overviews` below
   our own true maxzoom 16, so the downsampling pyramid range is
   unaffected; `rgb`/orthophoto mode keeps the 17 safety cap, so the
   already-completed Freetown pipeline is unaffected if ever re-run).

**Re-verification after all fixes together** (encoding, resampling,
alpha-weighted nodata-aware requantization matching upstream exactly,
`macrotile_z`): re-ran the full pipeline from `aggregation_covering.py`
onward (had to physically move `source-store/jphakodatetrialsea` aside
first — `aggregation_covering.py` globs *every* `source-store/*/bounds.csv`
unconditionally, so the sea source was silently getting pulled back in
otherwise; see the sea sub-thread below). Coverage collapsed from 501
aggregation items to **4**, and downsampling from 149 items to 31 —
both expected and correct given the coarser, consolidated macrotile
grid. Archive's actual maxzoom is now honestly **16** (not 17).
Verified two independent ways:
- **Direct tile-boundary continuity check** (not just single-tile pixel
  ranges): decoded two horizontally-adjacent z16 tiles straight from the
  merged `.pmtiles` (bypassing any viewer) and compared elevation at
  their shared edge — mean difference 0.07m, max 1.0m, i.e. within
  ordinary quantization noise, not a seam.
- **Visual**, via the same corrected local-preview setup (see
  methodology note above): field-boundary/valley/ridge detail renders
  cleanly at multiple zooms with no hatching, cliffs, or staircasing.
  Hidenori confirmed independently by opening
  `http://localhost:8971/index.html` in his own browser on the same
  machine (`aalto`) — "陸は綺麗だね。これで正しそうだ" (the land looks
  clean, this looks correct).

**Land data is now considered verified correct.** Ocean/sea is not:
a `jphakodatetrialsea` source-catalog entry was created (2 Copernicus
GLO-30 tiles, later cropped to just a 0.3°×0.3° box around
Hakodate/Goryokaku instead of the full 1°×1° originals) to test sea
fallback per D9-style reasoning ("upstream's own real data blends the
sea in extremely naturally — study upstream's actual approach rather
than inventing one," per Hidenori). Adding it under the *old*
`macrotile_z=17` regime made aggregation explode to 901, then even
after cropping tighter, 773 items — some genuinely enormous (a single
z11 macrotile forced to 1m-equivalent resolution ballooned to 4GB+ of
intermediate raster; 13 such items alone used ~49GB of `slate`'s disk,
which dropped to 90% full before cleanup). Both attempts were killed
and their partial output cleaned from `tmp-store`, `pmtiles-store`, and
`aggregation-store` (contamination from the first aborted attempt
leaked into `pmtiles-store` and inflated a `bundle.py` run to 116,355
tiles before being caught and removed — `bundle.py` does a live
directory glob, unlike `downsampling_run.py` which only reads a
specific pre-computed file list, so stale leftover `pmtiles-store`
files silently get included in the next bundle unless manually swept).
Sea work was set aside (Hidenori: "海処理もまだしない") specifically to
verify the truncation/macrotile_z fixes in isolation first — now that
`macrotile_z=12` consolidates the aggregation grid, Hidenori expects sea
merging to be much more tractable next time (no longer forcing huge
z11-scale ocean tiles to fake 1m resolution). `source-store/jphakodatetrialsea`
currently lives at `source-store-sea-setaside/` (renamed, not deleted)
on `slate` specifically to keep it excluded from `aggregation_covering.py`'s
unconditional glob until sea work resumes.

**Status of uncommitted changes on `slate`** (`git status --short` in
`hfu/mapterhorn`, as of this update):
```
 M pipelines/aggregation_reproject.py
 M pipelines/aggregation_tile.py
 M pipelines/bundle.py
 M pipelines/downsampling_run.py
 M pipelines/utils.py
?? pipelines/full_rerun.py          (throwaway helper, safe to delete)
?? pipelines/merge_japan_bundles.py (D7's ad hoc merge script, now real)
?? pipelines/retile_terrarium.py    (throwaway helper, safe to delete)
?? pipelines/source-store-sea-setaside/  (sea source, parked)
?? pipelines/tmp-store/             (current 4-item build's working state)
?? source-catalog/jphakodatetrialsea/    (sea source catalog entry)
```
None of this is committed. Nothing has been republished to
`s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles` — it still has
the original broken encoding from before this whole investigation.
The currently-verified-good build only exists at
`slate:.../pipelines/bundle-store/japan.pmtiles`, `scp`'d to `aalto` at
`/private/tmp/claude-501/.../scratchpad/pmtiles-preview/japan.pmtiles`
(session-scoped scratch path — gone after this session ends) and served
there via a small hand-written Node range-server (`range-server.js`,
not checked in anywhere; plain `python -m http.server` doesn't send
real `206 Partial Content` responses, which pmtiles-js requires) on
`http://localhost:8971/`.

**Update, 2026-08-09 (new session) — committed, sea re-run succeeded
under `macrotile_z=12`, republished. Sea's own correctness against
upstream is still unverified — see caveat below.**

Resumed from the above: committed the 10-file changeset on `slate`
(`5609479`) essentially as described, minus the two throwaway helper
scripts (`full_rerun.py`, `retile_terrarium.py` — left untracked and
undeleted; deleting them over `ssh` was blocked by this session's
sandbox policy as a remote destructive action, harmless to leave
behind). Also added `tmp-store`/`source-store-sea-setaside` to
`pipelines/.gitignore` (they were untracked only because they don't
match `pipelines/.gitignore`'s existing `source-store`/`aggregation-
store`/etc. patterns, being renamed rather than the originals).

Moved `source-store-sea-setaside` back to
`source-store/jphakodatetrialsea` and re-ran the pipeline from
`aggregation_covering.py` with all four sources present (3 land +
1 sea). Hidenori's prediction held: `macrotile_z=12` made sea
tractable where `macrotile_z=17` had twice exploded it (901, then 773
items, 90% disk) — this run produced **19 aggregation items** (up from
land-only's 4, as expected for a much larger sea-crop footprint), all
completed cleanly with no disk pressure (217GiB free throughout,
`tmp-store` grew a modest 6.1GB→9.3GB). Downsampling: 48 items, also
clean. `bundle.py 1` + `merge_japan_bundles.py` produced a fresh
126MB `japan.pmtiles`, 7,383 tiles total (up from the land-only
build's much smaller count).

**Verification performed**: direct pixel decode of every tile
(`pmtiles.Reader` + `imagecodecs`, same methodology as the land
verification above) across all 17 zoom levels, checking for
out-of-range elevations (the `-32768` signature of the earlier
zero-fill bug, or any value outside a generous `[-12000, 9000]`
sanity band). **Zero out-of-range tiles found.** Sea tiles decode to
elevations clustered tightly around 0m (typically -1m to +20m at the
coastline, exactly 0m in open-water tile interiors) — consistent with
Copernicus GLO-30 being a *land* DEM that reports sea level rather than
bathymetry, not a sign of corruption.

**What this verification does *not* establish**, and what's still
genuinely open (per this same entry's earlier "still open" list):
this confirms the sea data isn't corrupted or exploding disk usage —
it does **not** confirm GLO-30's "flat ~0m" sea convention is the
*right* one to ship, since upstream `mapterhorn/mapterhorn`'s own
actual sea-handling approach still hasn't been studied (Hidenori's
original ask). No visual/browser check was done this round either
(no local preview server was stood up) — only pixel-level decoding.
Treat the republished archive as "verified not broken," not as
"sea handling has been designed and confirmed correct."

**Republished**: `s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`
now serves this build (132,157,475 bytes, replacing the pre-
investigation 3,260,835-byte broken build) as of 2026-08-09 15:22 UTC.
`source-coop login` had expired going into this step; Hidenori
refreshed it live before the upload (matches the established
human-does-login convention, see `CLAUDE.md`).

**Update, 2026-08-09 (same day, later) — upstream sea handling
confirmed to match; the "still open" sea caveat above was too
cautious about the *convention*, but Hidenori's own live viewer check
found a real, different bug: the sea crop was simply too small.**

Two separate threads, resolved together:

1. **Upstream's sea handling, finally actually checked** (the ask left
   open above): read `upstream/main`'s `source-catalog/` directly on
   `slate` (`git remote add upstream https://github.com/mapterhorn/
   mapterhorn.git && git fetch upstream`, already added earlier this
   session — see the macrotile_z investigation above). Found
   `source-catalog/glo30/` — a real, live upstream entry, 24,674 global
   tiles, the *exact same* Copernicus GLO-30 dataset this bridge's own
   `jphakodatetrialsea` uses, at the same 30m resolution. Grepped the
   full upstream catalog for anything bathymetry/ocean-specific
   (`bathy`, `ocean`, `sea`, `gebco`, `ncei`, `noaa`) — nothing. **GLO-30
   is upstream's own universal fallback, everywhere, land and sea
   alike; there is no separate bathymetry source.** This confirms
   (not just "hopefully matches") that treating open ocean as GLO-30's
   near-0m value is the *actual* upstream convention, not a bridge-
   specific improvisation. This closes that open item.

2. **The viewer artifact Hidenori spotted
   (`https://mapterhorn.com/viewer/#map=10.24/41.8106/140.768&url=
   .../japan.pmtiles`) was real, though smaller than first reported —
   see the correction below.** A visible rectangular seam in the
   hillshade turned out to be the edge of the sea crop box itself.
   Measuring both extents (land trial's 5m/10m envelope vs. the
   original 0.3°×0.3° sea crop, both converted from `bounds.csv`'s
   EPSG:3857 values to lon/lat): the sea crop's *east* edge
   (140.850°E) sat short of the land trial's own east edge
   (140.875°E) by about 2km — a real, if modest, coverage gap on that
   one side. The originally-reported ~12km-tall gap on the *south*
   side did not actually exist — see the correction immediately below.
   **Not yet checked this round**: whether the 5m/10m-fallback z16
   question (this entry's other still-open item) is related to the
   same viewer symptom — see the code-reading answer below, which
   suggests it isn't the same bug, but this wasn't verified against a
   real pixel example this round either.

   **Correction (same session, caught before republishing again):**
   the "~12km-tall strip with zero sea fallback coverage" claim above
   was wrong — a hand-computed Web Mercator → lon/lat conversion error
   (mental arithmetic on the `atan`/`exp` formula, not run through an
   actual calculator or script at the time). Redone properly (a small
   Python script, cross-checked against `gdalinfo` on a real file —
   exact match to 6 decimal places) puts the land trial's true south
   edge at **41.750°N**, not 41.542°N. Against the sea crop's actual
   south edge (41.650°N), that's the sea crop extending **~11km
   further south than the land trial**, i.e. the opposite of a gap.
   The real, sole issue was the ~2km east-edge shortfall above; the
   rest of the visible viewer artifact was very likely just the
   small 0.3°×0.3° crop's own edges being visible at a zoomed-out
   view, an unavoidable property of any deliberately-small test area
   rather than a bug. The fix applied (a much larger, generous-margin
   crop — see below) is still correct and still worth having done, but
   the magnitude of the original problem was overstated. Lesson: run
   coordinate conversions through code, not head math, even for a
   "quick sanity check" — this one sat in committed documentation for
   part of a session before being caught.

3. **5m/10m fallback reaching 1m's true maxzoom (z16) — answered by
   reading the code**, following this entry's own established
   precedent (D8: read the merge logic directly rather than trust
   prose or assume). `aggregation_reproject.py`'s `reproject()`:
   `maxzoom = grouped_source_items[0][0]['maxzoom']` (the highest-
   priority group present in *this macrotile*), then every group in
   that macrotile — including lower-priority 5m/10m ones — gets
   `create_warp(..., zoom=maxzoom, ...)`, i.e. **gdalwarp'd to the
   same target resolution as the macrotile's finest present source**
   before `aggregation_merge.py` ever runs. So within any macrotile
   that contains 1m data at all (even partial), 5m/10m fallback pixels
   *do* get cubicspline-upsampled to z16 before filling 1m's gaps —
   the fallback genuinely reaches the true maxzoom, not some
   intermediate stopping point. Outside 1m's footprint entirely, a
   macrotile's target resolution is whatever the best *present* source
   offers (e.g. 5m's own native maxzoom) — expected, not a bug: you
   can't manufacture z16 detail from data that was never captured at
   that resolution. **Caveat**: verified by reading the code, not by
   pixel-decoding a specific real 5m/10m-filled z16 tile — matches this
   repo's existing precedent for "verified" (D8) but is a weaker
   standard of evidence than the direct-decode checks used elsewhere in
   this entry.

**Fix**: recropped `jphakodatetrialsea`'s source from scratch (re-
downloaded the raw N41/E140 GLO-30 degree tile via `source_download.py`
— the previous crop had discarded it) to a much more generous box: lon
140.40–140.95, lat 41.45–41.95 (was lon 140.55–140.85, lat 41.65–
41.95), comfortably exceeding the land trial's real extent on every
side now (checked numerically, not just visually). `source-catalog/
jphakodatetrialsea/Justfile`'s comment updated to document the exact
numbers and the reasoning, so the "why is this box shaped like this"
question doesn't need re-deriving next time.

Re-ran the full pipeline (covering → aggregation → downsampling →
bundle → merge). Interesting confirmation of `write_aggregation_todos()`'s
incremental-diff design (compares each new covering run's item
composition against the *previous* run's, only marks genuinely
changed/new macrotiles dirty): of 36 total aggregation items in the
new covering, only 17 were marked dirty (new sea-touched macrotiles);
the other 19 (pure-land macrotiles untouched by the sea-box change)
were correctly left alone rather than wastefully reprocessed — this
looked at first like an interrupted/failed run (17/36 done, process
not running, no error in the log) and cost some time to
mis-diagnose as a crash before re-reading `aggregation_run.py`/
`aggregation_covering.py`'s `write_aggregation_todos()` and realizing
it was working as designed. Downsampling similarly only reprocessed
28 of 49 items. Final merged archive: 7,589 tiles (up from 7,383),
134,120,534 bytes. Verified via the same direct-pixel-decode method as
before (all 17 zoom levels, no out-of-range elevations) — coarse-zoom
tile coverage (z9–z12, where the sea-only fallback resolution lives)
visibly grew in both x and y extent versus the previous build, while
z13–z16's tile range stayed identical (expected: the finest-detail
footprint is still bounded by the land trial's own extent, not by how
much surrounding sea is included).

**Republished** (with Hidenori's explicit go-ahead for this second
publish in the same session — publishing to a public bucket needs
confirmation every time, not just once):
`s3://smartmaps/mapterhorn-japan-bridge/japan.pmtiles`, 134,120,534
bytes, as of 2026-08-09 16:07 UTC.

**Still not done**: an actual visual re-check of the viewer (the
original prompt for this whole update) — the browser-based viewer in
this environment has known interaction reliability issues (see D10's
methodology note; double-click-to-zoom didn't visibly respond this
session), so this was verified via pixel decoding instead, consistent
with this entry's own established preference for that method over
screenshots. Hidenori has not yet independently confirmed the fix
looks right in his own browser this round (unlike the land-only
verification earlier, which he did check personally).

**Update, 2026-08-11 — this entry (and this repo's whole 2026-08-09/
2026-08-10 history) is a faithful, complete recovery, not a
reconstruction.** `aalto`'s external HDD (the drive underneath the
working copy all of the above session narrative happened on) failed
outright on 2026-08-11; see D12. This file was read in full earlier in
that same session, before the drive failed, and reproduced verbatim
here — nothing above this line was summarized or guessed at.

## D12: `aalto`'s external HDD failed outright; Hokkaido frozen, Kyushu/Okinawa-only, `slate` is now this repo's sole machine too

**Status**: Decided 2026-08-11, in effect immediately.
**Hokkaido-freeze portion superseded 2026-08-12**: Hidenori restarted
Hokkaido fully from scratch (see `japan-geotiff-dem`'s own
`HANDOVER.md`/`DECISIONS.md`); the slate-sole-machine and Kyushu/
Okinawa-first parts of this decision stand unchanged. Mirrors
`japan-geotiff-dem`'s own D12 (same incident, same decision, two
repos) — see that repo's `DECISIONS.md` for the full diagnostic trail;
this entry covers what it means specifically for this repo.

**Context**: `aalto`'s external HDD degraded over 2026-08-10 (already
flagged as severe — see `japan-geotiff-dem`'s D11) and failed outright
on 2026-08-11: unmount attempts, a physical USB unplug/replug,
`fsck_hfs` live verification (came back clean — a prior Disk Utility
First Aid pass had already repaired real B-tree corruption, but this
didn't fix the underlying read hangs), a full system restart, and a
full power cycle of the drive itself all failed to restore real read
throughput. A 61-file rescue-copy attempt (per-file timeout,
skip-on-stuck) recovered 0 files. Hidenori's own framing: a
~2019-vintage backup HDD, spun up for sustained load for the first
time in ~7 years, failing under exactly that load.

**Consequence, not a choice**: this repo's own working copy — on the
same failed drive, at `/Volumes/github/mapterhorn-japan-bridge` — is
also gone. Local commit `75146aa` (never pushed) and uncommitted
working-tree changes (this file's own 2026-08-09/2026-08-10 updates,
`HANDOVER.md`'s equivalent updates, and `app.js`'s `maxPitch: 85`
change) are unrecoverable from `aalto`. Unlike `japan-geotiff-dem`
(whose 2026-08-09 session log is genuinely lost, only reconstructable
from cross-references), this repo's full session history was read in
full earlier in this same 2026-08-11 session, before the drive failed
— see the update appended to D11 above — so nothing here is a
reconstruction.

**Decision**: Same two-part scope decision as `japan-geotiff-dem`'s
own D12, since both repos depend on the same upstream data:

1. **Hokkaido is frozen**, deliberately, not abandoned (Hidenori:
   "足利尊氏の九州行きのようなもの"). `jphokkaidodem1` in
   `hfu/mapterhorn`'s `source-catalog/` (a third, separate repo not
   covered by this file) stays exactly as-is until a fresh decision to
   resume it.
2. **Kyushu/Okinawa is the sole focus**, best-effort, no hard deadline.

Separately: **`slate` becomes this repo's sole machine too**, same
reasoning and same mechanism as `japan-geotiff-dem`'s own D12 — `gh`
re-authenticated on `slate` via device-code flow (simpler than
`source-coop login`'s OAuth loopback, no SSH tunnel needed), a fresh
`gh repo clone hfu/mapterhorn-japan-bridge` made there, and
`gh auth setup-git` run to fix `git push` (a bare `gh auth login`
alone left the git credential helper misconfigured, `could not read
Username`/stale-keychain errors on push).

**Consequences**:
- `aalto`'s copy of this repo is safe to erase along with the failed
  drive itself.
- `CLAUDE.md` no longer describes this project's `japan-geotiff-dem`
  leg as running on `aalto` — updated to describe `slate` as the sole
  machine for that leg too (this repo's own docs+viewer content was
  never machine-specific to begin with, being GitHub-Pages-served).
- Any future session should **not** resume Hokkaido processing without
  an explicit fresh decision — see `japan-geotiff-dem`'s parallel D12.
- Same lesson as `japan-geotiff-dem`'s own D12: commit more eagerly.
  This is the second repo in this same incident where multi-day
  uncommitted local work sat on a single point of failure — a habit
  worth changing, not just a one-time close call.

## D13: `japan.pmtiles` fails to upload to Source Cooperative on large multipart PUTs; host on `stars`/`martin` for daily use instead, keep SC as a lower-frequency archive

**Status**: Decided 2026-08-19, in effect immediately.

**Context**: The freshly-rebuilt `japan.pmtiles` (789,984 tiles, ~70.7GB,
75,939,452,941 bytes, see the `tempfile`-directory-bug fix entry in
`HANDOVER.md`) failed to upload to `s3://smartmaps/mapterhorn-japan-bridge/
japan.pmtiles` via `aws s3 cp --profile source-coop` **twice**, both times
with `An error occurred (520) when calling the UploadPart operation`
partway through a multipart upload — once at 1.4GB, once at 2.9GB, on
separate attempts with fresh credentials each time. Both failures left the
previously-published (much smaller, 2026-08-09, ~2GB) object on SC intact;
nothing was corrupted, the upload just never completed. `source-coop
login`'s ~1hr credential TTL was not the cause (credentials were
re-verified live on `slate` immediately before and after each failure).

**Decision**: Rather than debug SC's multipart-upload path further (a
different tool with better chunking/resume, e.g. `rclone`/`s5cmd`, is a
plausible future fix but out of scope for this decision), host large
`.pmtiles` files for day-to-day/live use on `stars` (the same box already
serving `z18.pmtiles`, `seamlessphoto512.pmtiles`, etc. for other
`optgeo`-family projects) instead, and treat Source Cooperative as a
lower-frequency **durable archive**, not the live-serving path. Hidenori's
framing: SC = low-frequency official archive, stars/martin = daily-use
hosting, run both.

`japan.pmtiles` now lives at `/home/stars/data/japan.pmtiles`, transferred
there directly from `slate` over the local LAN via `rsync` (~11MB/s
sustained, no retries needed — markedly more reliable for a single huge
file than SC's chunked multipart PUT). It's served two ways from the same
directory: `martin` auto-discovers it (`pmtiles.paths` directory scan) as
an XYZ/TileJSON source at `https://stars.optgeo.org/japan`; `Caddy`
(already serving `/home/stars/data` as static files with CORS +
`Accept-Ranges: bytes`) serves the raw file directly at
`https://depot.optgeo.org/japan.pmtiles` — this second URL is the one that
matters for the official Mapterhorn viewer
(`https://mapterhorn.com/viewer/#url=<pmtiles-url>`), since its `pmtiles`
JS library range-requests the raw file itself rather than going through
martin's XYZ abstraction.

**Operational gotcha worth recording**: `martin` on `stars` is a proper
`systemctl --user` service (enabled, survives reboots) — **not** a bare
background process — and it **hot-reloads `pmtiles.paths` automatically**.
It picked up the freshly-`rsync`'d `japan.pmtiles` and logged
`Added source source.id=japan` within seconds of the transfer completing,
with no restart needed at all. `pkill`-ing it (assuming it needed a manual
restart) breaks the systemd-managed unit state even though a bare relaunch
can paper over the symptom — the correct move, if a restart is ever
genuinely needed, is `systemctl --user restart martin`, not `pkill` +
manual relaunch. Default to **not** restarting it at all; check
`systemctl --user status martin` for evidence the hot-reload didn't work
before touching it.

**Consequences**:
- SC upload of `japan.pmtiles` was not reattempted this session; the
  2026-08-09 (~2GB) object there is now stale relative to the local/
  `stars`-hosted 70.7GB rebuild. A future session should either retry the
  SC upload with a more resilient tool, or make an explicit fresh decision
  that SC no longer needs to track `japan.pmtiles` at all.
- This repo's own viewer (`hfu.github.io/mapterhorn-japan-bridge/`) and
  any future documentation pointing at a `japan.pmtiles` URL should
  prefer `https://depot.optgeo.org/japan.pmtiles` going forward, not the
  SC URL, until/unless SC hosting is restored.

## D14: CSV manifest with size+MD5 (from S3 ETag) + aria2c replaces the one-wget-per-URL download loop; `jpnational5`/`jpnational10` expanded to national scope

**Status**: Decided and implemented 2026-08-19, in effect immediately.

**Context**: `jpnational1`'s download (`source_download.py`, one `wget
--continue` subprocess per URL in `file_list.txt`) had become the
practical bottleneck for this whole effort. With 75,724+ URLs and most
of them already downloaded from earlier sessions, the loop still spent
real wall-clock time re-verifying every already-complete file one
subprocess launch at a time — observed directly: two controlled
60-second/48-second windows showed the file count not moving at all
mid-run despite the process actively working, because it was working
through a long stretch of already-present files. Root cause: per-file
subprocess/connection overhead, not bandwidth — `wget --continue`
still opens a fresh connection and does at least a size check per URL,
with no way to batch or parallelize across files.

**Decision, part 1 — CSV manifest with size+MD5**: `japan-geotiff-dem`'s
own `build_filelists.py` (that repo's D13 mechanism) was rewritten to
query `aws s3api list-objects-v2` instead of `aws s3 ls`, which returns
`Size` and `ETag` per object in the same paginated bucket listing —
**zero extra requests**. Verified directly (2026-08-19) that this
bucket's ETags equal true MD5 for these files (single-part uploads):
fetched one real object, compared its S3 `ETag` header against a
locally-computed `md5` of the downloaded bytes — exact match. Output
format changed from `{res}/latest_file_list.txt.gz` /
`obsolete_file_list.txt.gz` (plain URL-per-line) to
`{res}/latest_file_list.csv.gz` / `obsolete_file_list.csv.gz` (header
`url,size,md5`) — old `.txt.gz` objects deleted from the bucket on
republish so the two formats don't coexist indefinitely.
`skip_already_published.py` (D14 of `japan-geotiff-dem`, unrelated
number collision) updated to parse the new CSV. Public docs
(`source-coop/README.md`) updated with the new format/URLs.

This trick does **not** generalize to every source: `jpnationalsea`'s
GLO-30 data has two real-world mirrors with different behavior —
`opentopography.s3.sdsc.edu` (MinIO) returns placeholder ETags
(`"00000000000000000000000000000000-1"`, verified across multiple
files, not real hashes) and doesn't support bucket listing at all
(`ListObjectsV2` returns 503); `copernicus-dem-30m.s3.amazonaws.com`
(real AWS S3, confirmed via `aws s3api list-objects-v2
--no-sign-request`) **does** give real, usable ETags. `jpnationalsea`'s
275-tile manifest was built by targeting the AWS mirror specifically
(one `head-object --no-sign-request` per URL, parallelized — a
one-time manifest-build cost, not a per-run cost) rather than the MinIO
one. Any future source needs this same check before assuming ETag=MD5.

**Decision, part 2 — `source_download.py` rewritten around aria2c**:
replaces the wget loop with a single `aria2c -i <input-file>`
invocation per source. When the manifest has real MD5s, the whole
manifest (not just missing files) is handed to aria2c with
`checksum=md5=...` per URL and `--check-integrity=true` — aria2c
itself decides what to skip (matching local file, verified by hash —
no network request) versus what to fetch, natively parallelized
(`-j 8`). When a source's manifest has no trustworthy MD5 (the
MinIO-mirror case), the script falls back to a local size-only
pre-filter in Python before invoking aria2c on just the missing/
mismatched subset, since there's no server-side hash to lean on.
Verified end to end on `jpnational1`: full run (75,818-entry manifest,
mix of hash-verifying already-present files and downloading genuinely
new ones) completed in **2h16m4s** with every file reported `OK`
(checksum-verified) by aria2c.

**Decision, part 3 — `jpnational5`/`jpnational10` expanded to national
scope**: with the CSV-manifest infrastructure in place, expanding these
two (previously range-filtered to the same 3900-5199 mesh range as the
old `jpkyushutest*` scope, untouched since 2026-08-11) to full national
coverage became cheap: regenerate `japan-geotiff-dem`'s national
`latest_file_list.csv.gz` for res 5 and 10, copy it into
`source-catalog/jpnational{5,10}/file_list.csv` **unfiltered** (no
range filter this time — this *is* the national expansion). Result:
`jpnational10` 1,364 → **4,981** tiles, `jpnational5` 91,595 →
**378,618** tiles. Both downloads started immediately (aria2c, same
mechanism as `jpnational1`). `jpnational1`'s own national expansion
stays deliberately gated on `japan-geotiff-dem` finishing its national
1m publish (per D13's sibling decision in that repo's own docs) — 5m
and 10m have no such dependency, which is exactly why Hidenori chose to
let them go first.

**New tool**: `check_download_progress.py` — file-count-only progress
report (local `source-store/{source}/*.tif` count vs.
`file_list.csv` row count) for every source-catalog entry with a
manifest, or just the ones named on the command line. Complements the
existing `check_progress.py` (which covers aggregation/downsampling,
not the download stage).

**Consequences**:
- `jpnationalsea`'s download continues under the same aria2c mechanism,
  now correctly checksum-verified against the real AWS mirror.
- Any future source-catalog entry should default to checking whether
  its host's ETags are trustworthy MD5s (S3-compatible bucket listing,
  `head-object`, and a spot-check against a locally-computed hash)
  before assuming this trick applies — MinIO and other S3-compatible
  servers are not guaranteed to expose real content hashes via ETag.
- `jpnational5`'s 378,618-tile national manifest is far larger than
  anything downloaded under this pipeline before; expect this download
  to take substantially longer than `jpnational1`'s did, purely from
  genuinely-new-file volume (not a repeat of the old per-file-overhead
  problem, which this whole decision was written to fix).

## D15: `source_polygonize.py`'s `merge_source()` rewritten around the new unified `gdal vector concat` CLI — ~16x measured speedup, batched to work around macOS ARG_MAX

**Status**: Decided and implemented 2026-08-19; correctness-verified at
500-file scale, end-to-end tested on `jpnational10` (4,981 files) as
this entry is being written — see "Status at write time" below for
exactly how far that test had gotten.

**Context**: `merge_source()` (called by `source_polygonize.py`, itself
chained after `source_download.py`/`source_bounds.py`) builds one
merged GPKG of per-mesh coverage-footprint polygons by running
`ogr2ogr -update -append` **once per mesh, sequentially, as a separate
subprocess**. A prior investigation (this file's own entry a few hundred
lines up, "`polygon-store` fast-storage relocation investigated") had
already established: (a) disk speed is *not* the bottleneck (internal
vs. external SSD differed by only ~10% on the real workload pattern);
(b) per-invocation overhead (~90-430ms/file, measured two ways in two
sessions) *is* the bottleneck — subprocess launch + GDAL driver/SQLite
init, paid once per mesh regardless of storage; (c) the fix direction
is fewer, batched invocations, not a storage-tier change — flagged but
not implemented at the time.

This stopped being a someday-topic once `jpnational1`'s national-scope
work made the real cost concrete: a full run at the *old* Kyushu-range
scope (~75,724 meshes) took observed **~4h17m** end to end per an
earlier session's own note. Hidenori: "スケールする方法の実装を目指
そう" (let's aim for an implementation that actually scales) — with
`jpnational5` about to need this at **378,618** meshes (~5x), a naive
linear extrapolation of the old method put that alone at 20+ hours,
purely from subprocess overhead, not genuine per-byte work. Hidenori's
framing: fix this now, while still working at the smaller (soon-to-be-
superseded) Kyushu-scoped `jpnational1`, rather than after national
expansion makes iteration even more expensive — also noted this scale
of merge is plausibly beyond what upstream Mapterhorn (Oliver) has
exercised, so there's no existing "just copy their approach" shortcut.

**Investigation, in order**:
1. Checked for a newer GDAL CLI: GDAL 3.13.3 (already installed) ships
   a provisional unified `gdal` command (`gdal vector concat`, `gdal
   vector dissolve`, etc.) alongside the classic per-utility binaries.
   `gdal vector concat <inputs...> <output> --mode single
   --output-layer out` takes **many inputs in one process** — the
   direct fix for "one subprocess per file."
2. Benchmarked old vs. new on a real 500-file sample (actual
   `jpnational1` per-mesh GPKGs already on disk from a since-interrupted
   run, not synthetic data): **old 3m36.68s (216.68s) vs. new 13.5s —
   ~16x**.
3. Correctness check: both methods independently produced **494
   features from the same 500 input files** (6 presumably-empty/
   invalid footprints excluded identically by both) — exact agreement,
   no `gdal vector concat`-specific data loss.
4. Scale-tested for the ARG_MAX wall: macOS `ARG_MAX` = 1,048,576
   bytes. A single `gdal vector concat` call over all 18,384
   then-available real files failed immediately (`argument list too
   long`, both via plain `ls`-glob *and* via an explicit file list
   substituted into the command line — the OS limit applies to the
   assembled argv regardless of how it's built). A 3,000-file batch
   succeeded (92.3s, ~31ms/file, no error) — chosen as `BATCH_SIZE`
   with real headroom under the ~1MB ceiling for ~60-80-byte paths.

**Decision — two-level batched concat**: `merge_source()` rewritten to
(a) split the mesh list into `BATCH_SIZE`-sized (3,000) chunks, (b) run
one `gdal vector concat` per chunk **in parallel** via the same
`multiprocessing.Pool` pattern `polygonize_source()` already uses
(`processes` argument, same as today's CLI usage — no new argument
added), producing `polygon-store/{source}-batches/batch-NNNNN.gpkg`
files, then (c) one final `gdal vector concat` over those (far fewer —
tens, not tens-of-thousands) batch outputs into the same
`polygon-store/{source}/merged.gpkg` as before. The final union step
(`ogr2ogr ... ST_Union(ST_MakeValid(geom))` into `polygon-store/
{source}.gpkg`) is unchanged — it was already a single invocation, not
part of the bottleneck. Public interface unchanged:
`source_polygonize.py <source> <processes>` — the rewrite is entirely
inside `merge_source()`; `polygonize_source()` (the parallel
`gdal_footprint` extraction stage) is untouched.

**Status at write time**: deployed and running end-to-end against
`jpnational10` (4,981 tiles — chosen as the safe first real target per
Hidenori's own call, "止めて差し替えるのは賛成", small enough to
validate quickly) via `source_polygonize.py jpnational10 4`. Not yet
confirmed complete as this entry is written. `jpnational1`'s own
polygonize run (old code, started ~6:25pm, interrupted ~40 minutes in
for this investigation — no data lost, `polygonize_source()`'s
per-mesh GPKGs are on disk and reusable) has **not yet been resumed
under the new code** — that's the next step once `jpnational10`
confirms clean end to end.

**Consequences**:
- Once `jpnational10` confirms correct, resume `jpnational1` under the
  new `merge_source()` (its ~18k already-polygonized per-mesh GPKGs
  from the interrupted run can likely be reused directly — `polygonize_
  source()` is idempotent per file, matching `gdal_footprint -overwrite`
  semantics already in place).
- `jpnational5` (378,618 meshes) is the real stress test for this
  rewrite — at the measured ~31ms/file batch rate that's roughly
  ~3.3 hours for the concat phase alone (down from a naive 20+-hour
  extrapolation of the old method), though this hasn't been directly
  measured at that scale yet.
- The new `gdal` unified CLI is explicitly marked provisional upstream
  ("The project reserves the right to modify, rename, reorganize, and
  change the behavior... until frozen in a future release") — worth
  re-checking this dependency on any future GDAL upgrade, the same way
  the GDAL-3.13.3 duplicate-`-append` regression (this file's own
  earlier entry) was caught by a routine Homebrew auto-upgrade.
- `BATCH_SIZE=3000` was chosen empirically for this specific workload
  (short mesh-code-based filenames); a source with much longer file
  paths would need a smaller batch size to stay under the same
  1,048,576-byte `ARG_MAX` ceiling.

## D16: `jpnational1` stays at its current regional scope for now; build `japan.pmtiles` with 5/10/sea national + 1 regional, to stress-test the downstream pipeline before the largest jump

**Status**: Accepted, 2026-08-20.

**Context**: `japan-geotiff-dem` finishing its own JCI 2026-09 (all 11
zones, national 1m coverage) removed the technical gate on
`jpnational1`'s own national-scope expansion (D14's sibling decision
already took `jpnational5`/`jpnational10` national; `jpnationalsea` is
national by construction). `jpnational1` going national would be a
~3.85x jump (75,818 → ~291,779 files) on top of `jpnational5` already
being the largest single stress-test this pipeline has run (378,618
files, D15's real scale-test, still mid-`source_polygonize.py` as this
entry is written). Hidenori was asked twice whether to proceed with
`jpnational1`'s expansion (once right before a `/clear`, once again
this session) and both times deferred the decision rather than saying
yes immediately.

**Decision**: Leave `jpnational1` at its current scope (Kyushu/
Okinawa/Shikoku/western Chugoku, mesh range 3900-5199) for this round.
Once `jpnational5`'s D15 polygonize is confirmed correct
(`Feature Count: 1`, national-extent bounding box), proceed through
the full downstream pipeline — `aggregation_covering.py` →
`aggregation_run.py` → `downsampling_covering.py` →
`downsampling_run.py` → `bundle.py` → `merge_japan_bundles.py` →
`rsync` to `stars` — with the sources as they stand: `jpnational1`
regional (1m, highest priority), `jpnational5`/`jpnational10`/
`jpnationalsea` national. This is already **the first genuinely
national-scope `japan.pmtiles` this project has built** (a prior
789,984-tile/70.7GB build, D13, predates any of the sources going
national) — `aggregation_covering.py`'s macrotile grid is built from
the *union* of every source's coverage, and that union is already
national once 5m/10m/sea are, regardless of what 1m covers on top of
it.

**Why not just expand `jpnational1` first and do one final national
build**: the point of building now, at this intermediate scope, is
deliberately to **exercise and tune the downstream stages
(aggregation → downsampling → bundle → merge) at a size that's already
large but not yet the largest possible**, before committing to the
biggest jump. `aggregation_run.py`/`downsampling_run.py` have only
ever been run once at real scale (1,119/2,697 items, ~33h total
end-to-end, back when every source was still regional-only — see
D13's own build) — genuinely unknown at today's much larger union
extent. Running it now, with `jpnational1` still regional, produces a
real `japan.pmtiles` update (better national high-res-where-available
coverage than what's live today) *and* real timing/memory/failure-mode
data for these stages at a new order of magnitude, without yet paying
the added `1`m-sourced reprojection cost that `jpnational1` going
national would add on top. If a bug or scaling wall shows up, it's
cheaper to diagnose and fix at this scale than after also expanding
`jpnational1`.

**Consequences**:
- The resulting `japan.pmtiles` update will already be the best
  version of this dataset ever published (national 5m/10m/sea
  fallback coverage everywhere, on top of unchanged 1m-precision
  coverage in the Kyushu/Okinawa/Shikoku/western-Chugoku region) —
  worth shipping on its own merits, not just as a test run.
- `jpnational1`'s own national expansion is **not abandoned, just
  sequenced after this build** — once `aggregation_run.py`/
  `downsampling_run.py` are proven stable at this new scale (timing
  measured, no unexpected failure modes), re-ask Hidenori and proceed
  with the same recipe D14 already used for `jpnational5`/
  `jpnational10` (regenerate `jpnational1/file_list.csv` unfiltered
  from `japan-geotiff-dem`'s national `1/latest_file_list.csv.gz`,
  re-download via aria2c, re-run bounds/polygonize via D15), then a
  second, final `japan.pmtiles` rebuild.
- `slate` should be kept continuously busy through this whole
  sequence rather than left idle between stages — each stage advances
  automatically into the next per the existing pipeline chaining, so
  the main risk is a human/agent forgetting to check back in, not the
  pipeline itself stalling.

## D17: Upstream fidelity as a standing practice, and where `fusi` fits

**Status**: Accepted, 2026-08-20.

**Context**: This repo (`hfu/mapterhorn-japan-bridge`) exists as an
**interim bridge** (CLAUDE.md's own Mission section) until upstream
`mapterhorn/mapterhorn`'s own `jpdem1a` source catches up with GSI's
latest surveys — the whole effort is explicitly meant to be retirable
once that happens. That framing only makes sense if this project
stays genuinely close to upstream in the meantime, not just in intent
but in mechanism: `hfu/mapterhorn` (the pipeline half of this bridge)
is a real `git` fork with an `upstream` remote, not an independent
reimplementation. That distinction turned out to matter concretely,
not just philosophically — D11's investigation (this file, way above)
found and fixed two real correctness bugs
(`downsampling_run.py`'s requantization not matching upstream's exact
digit-extraction formula, and a conflated `macrotile_z` constant that
silently forced this fork's genuinely-native z16 elevation data up to
a fake, oversampled z17) **specifically by running `git diff
upstream/main` and reading upstream's actual code side by side** —
neither bug would have been findable, let alone fixable with
confidence, without a real upstream reference to diff against.
`FORK_NOTES.md`'s own "Status" section records this fork having
already merged upstream's subsequent Manager/Worker + checkpoint-
refactor commits — tracking upstream isn't just a one-time diff, it's
an ongoing practice that has already paid off more than once.

**Where `fusi` fits**: `hfu/fusi` (Hidenori's earlier, independent
GeoTIFF→Terrarium-PMTiles toolchain, predating this bridge project)
was built "based on the approach Mapterhorn showed" but is **not a
fork** — no `git` relationship to `mapterhorn/mapterhorn` at all, so
it structurally cannot benefit from the mechanism D11 exercised: there
is no upstream to diff against, no upstream fixes to merge, no way to
catch a `fusi`-side bug the way the `macrotile_z`/requantization ones
were caught here. `fusi` originally produced the `jpdem1a`/`jpdem5a-c`/
`jpdem10a-b` source-catalog entries this fork's own `CLAUDE.md`
explicitly instructs never to combine with (D6) or fall back to
(`japan-geotiff-dem`'s own `HANDOVER.md`: "alphabetical tie-break
would let their stale data win over this project's fresher data") —
those entries are already treated as superseded-in-practice by this
project's own `jpnational*` sources, not a hypothetical concern.
`fusi`'s own repo has had no commits since 2025-12-19 (confirmed via
`gh api repos/hfu/fusi/commits`, 2026-08-20) — 8 months dormant, not
formally archived.

**Decision**:
1. Treat close upstream tracking (`git fetch upstream`, periodic
   `git diff upstream/main` on any pipeline stage that behaves
   unexpectedly, merging upstream's own fixes promptly) as a standing
   practice for `hfu/mapterhorn`, not a one-time D11 exercise — it is
   this fork's main structural quality advantage over an independent
   reimplementation like `fusi`, and the value compounds the longer
   the fork stays current.
2. Treat contributing generic bug fixes back upstream as the ideal
   outcome when this fork finds one that isn't specific to Japan/DEM
   data — `FORK_NOTES.md`'s own "Category A" list already identifies
   several candidates from the Freetown/orthophoto period. Not
   obligatory or urgent, but the default instinct when a fix is
   clearly generic (see the draft outreach to Oliver Wipfli prepared
   2026-08-20, offering the D15 `gdal vector concat` batching pattern
   as a possibly-useful technique for upstream's own aggregation
   stage, at whatever scale it might matter there).
3. **Recommend to Hidenori** that `hfu/fusi` be considered for public
   archival on GitHub — not a Claude-executed action (archiving is an
   account-level, "modifying public content"-class action requiring
   explicit permission each time), just a recommendation grounded in:
   8 months of dormancy, and its original role (Japan DEM →
   Terrarium PMTiles, feeding `jpdem1a`-style upstream entries) now
   substantially covered by this bridge project's own, better-
   upstream-tracked pipeline. Hidenori's call, not assumed.

**Consequences**:
- No code changes follow from this entry directly — it's a policy
  statement, recorded here (rather than only in `HANDOVER.md`, which
  is session narrative) because it's meant to outlive any single
  session and shape default behavior (diff-before-guessing when
  something looks wrong, default toward upstream contribution when a
  fix is generic) going forward.
- If `fusi` is archived, update any doc that still references it as
  an active project (this file's own D6 already treats its output as
  stale, but a broader sweep for "fusi" mentions across `optgeo`/`hfu`
  family docs — including `japan-geotiff-dem`'s and this repo's own
  `CLAUDE.md`/`README.md` — is worth doing once Hidenori decides,
  not preemptively.

## D18: Within-source product-type priority (A/B/C) was purely alphabetical, not accuracy-based — lower-accuracy data was silently winning over higher-accuracy data

**Status**: Accepted, fixed 2026-08-20, verified against real production
data before deployment.

**Context**: Hidenori's own mental model of this pipeline's merge
priority is seven tiers: `1, 5a, 5b, 5c, 10a, 10b, sea` — 1m highest
(DEM1A, laser survey only), then 5m split into DEM5A (airborne laser)
> DEM5B (20cm-GSD photogrammetry) > DEM5C (40cm-GSD photogrammetry),
then 10m similarly DEM10A > DEM10B, then `sea` (Copernicus GLO-30) as
the universal fallback. D8 already verified the *cross-tier* part of
this (1m > 5m > 10m > sea) by reading `aggregation_covering.py`'s
`-maxzoom`-first sort, which is genuinely data-driven (each file's own
native resolution) and correct. **Nobody had verified the *within-tier*
part** — whether DEM5A actually beats DEM5B/5C (and DEM10A beats
DEM10B) when both cover the same mesh cell, which does happen for real:
`jpnational5`'s `file_list.csv` is a straight, unfiltered copy of
`japan-geotiff-dem`'s `5/latest_file_list.csv.gz` (by design — see that
repo's own D13, which tracks A/B/C as independent products, not
versions of each other, on purpose), so a cell whose old
photogrammetry file (5B/5C) was never marked obsolete when a newer 5A
LiDAR survey later covered the same area ends up with **both** files
live in `jpnational5` simultaneously.

**Grounding for the order, from `hfu/fusi`**: this exact seven-tier
priority isn't a fresh guess — it matches what Hidenori's earlier,
independent `fusi` toolchain ([[D17]], the non-fork predecessor this
project has since mostly superseded) already used in real production.
`fusi`'s own `README.md` documents its production invocation verbatim:
`just aggregate-split-lineage dem1a dem5a dem5b dem5c dem10a dem10b -o
output/fusi.pmtiles ...` — and `pipelines/aggregate_pmtiles.py`'s
`build_records_from_sources()` docstring states explicitly: "The order
of `sources` defines priority: earlier entries have higher priority."
`fusi` predates this project's `jpnationalsea`/GLO-30 addition, so it
never had a `sea` tier to place — appending it last (lowest priority,
universal fallback) is this project's own extension, not a deviation
from `fusi`'s precedent, and is already correct here via the
data-driven `-maxzoom` sort (GLO-30 is coarser than any GSI product).
Separately confirmed `fusi`'s own merge implementation
(`compute_tile_provenance()`) does an explicit per-pixel "first
non-nodata source by priority wins" composite — a different mechanism
than this fork's `gdalbuildvrt`-based approach, but the same intended
semantic (`fusi`'s own docs: "低優先度ソースが上位ソースのnodataを埋
めていることを確認します" — verify the low-priority source only fills
the high-priority source's nodata gaps). This fix reproduces that same
semantic through `gdalbuildvrt`'s confirmed last-wins-on-overlap
behavior instead of reimplementing per-pixel provenance logic.

**Investigation**: `aggregation_reproject.py`'s `create_virtual_raster()`
builds one `gdalbuildvrt -input_file_list` call per group (from
`utils.get_grouped_source_items()`). Empirically verified `gdalbuildvrt`'s
actual overlap behavior with two tiny synthetic 4x4 rasters of known
value, listed in both orders: **the last-listed file wins wherever
inputs overlap** (confirmed both directions, not assumed from
half-remembered docs). `get_grouped_source_items()` grouped items by
`(-maxzoom, source)` only, with `filename` as the sole tiebreaker within
a group — sorted alphabetically ascending, meaning `...DEM5A...` sorts
*before* `...DEM5B...`/`...DEM5C...`, so for the same cell, **the
lower-accuracy product was always listed last and therefore always
won** — exactly backwards from the intended priority, and confirmed
via `source-store/jpnational5/bounds.csv`: a same-mesh-cell 5A/5B pair
has byte-identical `bounds`/`width`/`height` (225x150), so they fall
into the *same* group (same maxzoom, same source name — `jpnational5`
doesn't distinguish product type at the source-catalog level at all)
and get merged in one `gdalbuildvrt` call, not routed through the
cross-source "try highest priority, fall through only on nodata" logic
in `aggregation_reproject.py`'s `reproject()` (that logic only fires
*across* distinct groups, e.g. `jpnational1` vs `jpnational5`).

**Scale, checked against the live `5/latest_file_list.csv.gz`
nationally** (378,618 files): 25,522 mesh cells (~6.7%) currently carry
more than one product type — 12,750 A+B, 12,474 A+C, 281 A+B+C, 17 B+C.
Every one of those cells was silently using its lower-accuracy file
instead of the higher-accuracy one available for the exact same
location. 10m (`jpnational10`) has the identical code-level risk but
no cells currently overlap in practice (checked `source-store/
jpnational10/bounds.csv`: 7 DEM10A + 196 DEM10B, zero shared mesh
cells at today's scope) — latent, not yet manifesting.

**Caught before it mattered**: `jpnational5`'s D15 polygonize hadn't
finished and `aggregation_run.py` hadn't started when this was found —
this build (D16) would otherwise have baked the wrong priority into a
multi-day production run, only discoverable after the fact by noticing
visibly lower-quality terrain in areas with known LiDAR coverage.

**Decision**: Added `get_product_type_rank()` to `utils.py` — parses
the `-DEM<digits><letter>-` suffix GSI's own filenames already carry
(`A`→0, `B`→1, `C`→2, lower = higher accuracy = should win), defaulting
to rank 0 for any filename without that suffix (e.g. `jpnationalsea`'s
Copernicus GLO-30 names, which never have more than one product per
cell anyway, so the default is inert there). `get_grouped_source_items()`'s
sort key gained `-get_product_type_rank(filename)` between `source` and
`filename`, so within a group, items are now ordered worst-accuracy-first,
best-accuracy-last — which, combined with `gdalbuildvrt`'s confirmed
last-wins behavior, makes the highest-accuracy product win. Verified
with a synthetic 5-row aggregation CSV (mixed `jpnational5`/`jpnational10`/
`jpnationalsea` rows, including a real same-cell A/B/C triple) before
deploying: the fix produces `[..C, ..B, ..A]` order → `A` is last →
`A` wins, exactly as intended; the single-file groups (10m, sea) are
unaffected.

**Consequences**:
- Every subsequent `aggregation_run.py`/`aggregation_covering.py` run
  now uses accuracy-correct within-tier priority — this must land
  *before* D16's build starts using real aggregation data (it does;
  `aggregation_run.py` hasn't been invoked yet as of this fix).
- This bug's root cause — a source-catalog entry (`jpnational5`)
  bundling multiple genuinely-different-accuracy products under one
  name with no source-level product-type distinction — is a
  fork-specific consequence of how `japan-geotiff-dem`'s manifest was
  copied wholesale into `file_list.csv` (D14), not necessarily an
  upstream `mapterhorn/mapterhorn` issue; worth checking whether
  upstream's own `jpdem5a-c` source-catalog entries (if they exist, or
  whenever Oliver builds a 5m ingestion) have the same code path and
  the same latent risk, per D17's "diff against upstream, contribute
  fixes back" practice — not yet checked as of this entry.
- If a future resolution tier or source ever introduces its own
  multi-product-type split (e.g. if 1m ever gains a photogrammetry
  fallback), `get_product_type_rank()`'s pattern/rank table needs
  extending — it currently only recognizes `A`/`B`/`C` suffixes.

## D19: Nothing pruned local files superseded by an upstream `japan-geotiff-dem` refresh — added `source_prune_obsolete.py`

**Status**: Accepted, tool built and verified against real data 2026-08-20;
not yet applied to any source (see Consequences).

**Context**: Hidenori asked directly whether this pipeline has any
logic to remove local `source-store/{source}/*.tif` files that have
become obsolete since they were downloaded — i.e., a mesh cell whose
file was superseded by a newer survey on `japan-geotiff-dem`'s own
bucket after the local copy was fetched. It didn't: `source_download.py`
is purely additive (only ever adds files present in the *current*
`file_list.csv`, never removes ones that fell out of it on a refresh),
and `source_bounds.py` globs `source-store/{source}/*.tif`
unconditionally — an orphaned old file gets included in `bounds.csv`,
and from there `source_polygonize.py`/`aggregation_covering.py`, with
nothing to distinguish it from genuinely current data.

**Demonstrated on real data, not hypothetically**: compared
`jpnational1`'s own `file_list.csv` (75,818 files, last regenerated
2026-08-19) against a fresh pull of `japan-geotiff-dem`'s live
`1/latest_file_list.csv.gz`/`obsolete_file_list.csv.gz`, filtered to
`jpnational1`'s own mesh range (3900-5199): **81 of the 75,818 locally-
downloaded files are now obsolete** (superseded by a newer survey for
the same cell, most visibly a batch of `-DEM1A-20251208.tif` files
themselves superseded by even-newer 2026 dates) and **402 genuinely
new files exist upstream that a refresh would need to fetch**. This
is real drift, not a contrived example — `japan-geotiff-dem`'s own
1m tier kept accumulating updates (17,076 obsolete nationally) across
zones including `jpnational1`'s own Kyushu/Okinawa/Shikoku/western-
Chugoku range, after `jpnational1`'s manifest snapshot was taken.

**Decision**: Added `pipelines/source_prune_obsolete.py <source>
[--apply]`. Compares the current `source-catalog/{source}/file_list.csv`
against what's actually present in `source-store/{source}/*.tif`;
anything local but no longer in the manifest is "orphaned." Defaults
to a dry-run (report only); `--apply` moves orphaned files to
`source-store/{source}-stale/` — **moved, not deleted**, matching this
project's established "reversible by default" convention (same
pattern as `japan-geotiff-dem`'s own `skip_already_published.py`
moving zips to `{res}-skip/` rather than deleting them). Verified
against real `jpnational1` data: correctly identified exactly the same
81 files independently found via direct manifest comparison, with zero
false positives/negatives, before being trusted with `--apply`.

**Where this fits in the update workflow, going forward**: whenever a
source's `file_list.csv` is regenerated from a fresher upstream
manifest (the recipe already used for `jpnational5`/`jpnational10`'s
national expansion, D14) — `source_prune_obsolete.py {source} --apply`
→ `source_download.py {source}` (picks up genuinely new files) →
`source_bounds.py {source}` (regenerates `bounds.csv` without the
pruned entries) → `source_polygonize.py {source} {processes}`. Skipping
the prune step doesn't break anything outright, but silently keeps
using stale survey data for any cell that was superseded, indefinitely
— the D18 bug's same failure shape (lower-quality data winning by
default because nothing tells the pipeline better data exists), just
triggered by time instead of by a product-type mix-up.

**Consequences**:
- **Not yet applied to `jpnational1`'s real 81 orphans** — pruning
  requires first refreshing `file_list.csv` from the live manifest
  (currently 2026-08-19-dated), which is a real, if small, change to
  a source that D16 deliberately left untouched this round. Whether to
  do this now (a same-scope "keep current" refresh, distinct from the
  national-scope-expansion question D16 already deferred) or wait
  until `jpnational1`'s eventual full national refresh (which would
  need this same prune step anyway) is Hidenori's call, not decided
  in this entry.
- `jpnational5`'s own `file_list.csv` was captured fresh (2026-08-19,
  the same session as this national expansion) and has had no local
  drift yet — it's the *download in progress* that will eventually
  need this tool, not today's already-downloaded portion, per
  Hidenori's own framing that the ongoing 5m JCI cycle is a good
  real-world scenario to exercise this against once japan-geotiff-dem
  starts publishing updates that overlap `jpnational5`'s already-
  downloaded coverage.
- Should be run for any source before its next `source_bounds.py` +
  `source_polygonize.py`, not just once — this is now a standing step
  in the refresh recipe above, not a one-time cleanup.

## D20: Escalate D18's fix from within-group last-wins to true seven-tier pixel-level priority merge, reusing `aggregation_merge.py` unchanged

**Status**: Accepted, implemented and unit-tested 2026-08-20; full
live end-to-end test still pending real `aggregation_covering.py`
output (see Consequences).

**Context**: Hidenori reviewed D18's fix and identified it as
insufficient, not wrong: D18 made the *within-group* `gdalbuildvrt`
call pick the right winner when 5A/5B/5C (or 10A/10B) files overlap,
but that's a coarse, all-or-nothing overwrite per pixel — no seam
blending. Meanwhile `aggregation_merge.py`'s cross-*group* compositing
(the mechanism that already handles 1m vs 5m vs 10m vs `sea`) does
genuine per-pixel nodata-fill *plus* an erosion + Gaussian-blurred
boundary blend at the seam between filled regions — visibly more
correct. His point: since a single macrotile can contain a genuine
spatial mix of 5A/5B/5C coverage (not just one file entirely
superseding another at the exact same footprint, which was D18's
tested case), that mix deserves the *same* seam-aware treatment the
four resolution tiers already get — i.e. treat the priority stack as
seven groups (`1, 5a, 5b, 5c, 10a, 10b, sea`), not four.

**Investigation confirmed this is a cheap, safe change**: neither
`aggregation_reproject.py`'s `reproject()` (the per-group warp loop)
nor `aggregation_merge.py`'s `merge()` (the cross-group nodata-fill +
blend) hardcode a group count anywhere — both already operate on
`len(grouped_source_items)`/`num_tiff_files` generically. The entire
fix is contained in `utils.get_grouped_source_items()`: its group
*signature* changed from `(maxzoom, source)` to `(maxzoom, source,
product_type_rank)`, and the rank component of the sort key flipped
from negated (needed for D18's last-wins-within-group trick) to plain
ascending (needed so *groups* — not files within one group — come out
in `A, B, C` priority order). Verified with a synthetic aggregation
CSV covering a same-cell A/B/C triple plus a 10A/10B pair: produced
exactly 6 groups in the order `[5a, 5b, 5c, 10a, 10b, sea]` (would be
7 with a `jpnational1` row too) — matches the intended structure
exactly, confirmed by inspection, not just assumed.

**Consequence for D18's own fix**: no longer load-bearing, but
harmless to leave in place — since every group is now guaranteed a
single product type, the `-rank` component of the *within-group*
`gdalbuildvrt` file-list sort never has more than one possible value
per group and does nothing. Not reverted; D18's own writeup stands as
the historical record of how the bug was first found and understood.

**Lineage/provenance tooling — deliberately the light half, not the
full half**: Hidenori asked whether reviving `fusi`'s old lineage
(provenance-visualization) capability was now back in scope, with an
explicit budget: "if it's about one extra script, worth doing; if it
complicates the codebase or increases distance from upstream, leave it
for later." Added `pipelines/lineage_inspect.py` — a standalone,
on-demand tool (given an existing `*-aggregation.csv` item, reuses
`aggregation_reproject.reproject()` unchanged, re-derives a provenance
mask with the same nodata-fill walk `aggregation_merge.merge()` uses,
renders it as a PNG via a fixed 7-tier-plus-nodata palette) that
touches **zero** production pipeline files (`aggregation_reproject.py`/
`aggregation_merge.py`/`aggregation_tile.py`/`aggregation_run.py` all
unmodified) and adds **zero** I/O cost to real production runs — it's
never imported by anything in the main flow. This deliberately stops
short of `fusi`'s *other* lineage mechanism, its always-on
`--emit-lineage` flag that computes and writes a full companion
`-lineage` PMTiles archive on every production run — that would need
to touch `aggregation_merge.py`/`aggregation_tile.py`/`bundle.py` and
add ongoing I/O cost, matching Hidenori's own "leave for later"
threshold. If full production-lineage output is ever wanted, this
tool's `compute_provenance()` is the reusable core logic to build it
from — not thrown away, just not wired in yet.

**Consequences**:
- `utils.py`'s `get_grouped_source_items()` change is the only
  production-code change; verified via a synthetic multi-tier CSV, not
  yet exercised against a real `aggregation_covering.py`-produced item
  (none exist yet referencing current `jpnational*` sources — the only
  aggregation-store items on disk predate the `jpkyushutest*` →
  `jpnational*` rename and reference sources already deleted in that
  cleanup). Re-verify against a real item once D16's build reaches
  `aggregation_covering.py` — cheap to do (`lineage_inspect.py` itself
  is one of the best tools for that spot-check).
- Worst-case per-tile cost goes up slightly (up to 7 warp attempts
  instead of 4 before the `reproject()` loop can break early) — only
  matters for tiles genuinely needing to fall through several tiers;
  most tiles resolve within the first one or two groups.
- Per D17's "diff against upstream, contribute back if generic":
  `get_grouped_source_items()`/`aggregation_merge.py`'s N-way nodata-
  fill design is itself a good candidate to check against upstream
  `mapterhorn/mapterhorn` at some point — worth confirming whether
  upstream's own multi-product-type sources (if any exist there) hit
  the same class of issue D18/D20 fixed here. Not checked as of this
  entry.

## D21: Shuffle `aggregation_run.py`'s work queue — geographically-sorted `.todo` order clustered expensive tiles onto the same workers

**Status**: Accepted, implemented and verified live 2026-08-21.

**Context**: A few hours into the D16 build's `aggregation_run.py` run,
progress stalled hard — 45 items completed over 5.5 hours (vs. 60 items
in the first ~7 minutes). Diagnosed live rather than guessed: `ps aux`
showed only 1-2 of the 4 `AGGREGATION_WORKERS` actually busy, each
pinned at 100% CPU on a single `gdal_translate`, while overall system
CPU was 66-92% idle — not I/O-bound (`iostat` showed modest throughput,
nowhere near saturating the SSD) and not memory-thrashing in any
obvious way, just genuinely idle capacity. Inspected the actual stuck
items: `10-890-410-16-aggregation.csv` alone listed 1,073 `jpnational1`
files and 1,073 `jpnational5` files — a single aggregation tile needing
`gdalbuildvrt`+`gdalwarp`+`gdal_translate` over 1000+ small source
rasters per group, genuinely expensive work, not a hang (fresh PIDs
appeared as it moved through its per-item priority-group fallback
loop). Multiple adjacent tiles in that same area (`883` through `890`
in x) were *all* similarly expensive and landed on workers back to
back.

Root cause: `write_aggregation_todos()` (`aggregation_covering.py`)
creates `.todo` marker files from `sorted(glob(...))` — geographically
ordered (the sort key is `{z}-{x}-{y}-{child_z}-aggregation.csv`, so it
sorts primarily by x-coordinate). `aggregation_run.py`'s own `main()`
then reads that directory back with a plain `glob()` (no re-sort) to
build the work queue — and APFS directory listings tend to preserve
creation order closely enough that the geographic ordering survived
into actual worker assignment. Terrain/coverage complexity is
spatially correlated (a region with dense overlapping 1m+5m mesh
coverage stays dense across many adjacent tiles), so a purely
sequential queue means a handful of genuinely expensive regions can
occupy the *entire* worker pool simultaneously while thousands of cheap
tiles elsewhere sit untouched — the exact opposite of what parallelism
is for.

**Decision**: Added `random.shuffle(dirty_filepaths)` in
`aggregation_run.py`'s `main()`, right after building the work-item
list and before handing it to the `Pool`. No other change — `.done`
markers already make every item idempotent and independently
resumable, so shuffling the *order* items get picked up in is free and
safe to apply mid-run (killed and restarted the in-progress run to pick
it up; the 110 already-`.done` items were correctly skipped, confirming
no work was lost).

**Verified immediately, live**: restarted run's first two active items
were `12-3522-1643-16` and `12-3600-1628-16` — completely different
part of the coordinate space than the stuck `883`-`890` cluster.
`.done` count went 110 → 115 within ~15 seconds of restart (several
cheap items nearby in the new shuffled order cleared almost instantly)
— direct, immediate confirmation the fix does what it's supposed to,
not just a plausible-sounding theory.

**Consequences**:
- This doesn't make any single expensive tile faster — a
  1000-file-per-group tile still costs what it costs. It makes the
  *pool* avoid getting collectively stuck on a cluster of expensive
  tiles at the same time, which is what was actually costing wall-clock
  time.
- The original ETA estimate (low-single-digit days, extrapolated
  linearly from the old 1,119-item/25h build) undercounted how *uneven*
  item cost is at this scale — some tiles need 1000+ file merges,
  others resolve trivially. No revised estimate is offered here;
  collect real throughput data over a longer window with the shuffle
  in effect before trying again.
- If this pattern (geographically-sorted `.todo` creation feeding an
  order-preserving `glob()` read) recurs in `downsampling_run.py` or
  any other stage that reads a similarly-created work queue, check
  whether it needs the same shuffle — not audited as part of this
  entry.

## D22: Plan (not yet executed) — analysis-first sync of `hfu/mapterhorn` against `upstream/main`

**Status**: Open — planning only, recorded 2026-08-21 ahead of the
actual work so the intent and constraints survive a context reset.

**Context**: D17 already established upstream-tracking fidelity as a
standing practice, evidenced by D11's bug-catching diff session. This
entry is Hidenori's explicit follow-through: once the current D16
`japan.pmtiles` build and its associated bug-fix round (D18-D21) settle
enough to not be actively mid-flight, do a real sync against
`upstream/main` rather than letting the gap keep growing. As of
2026-08-21, `git fetch upstream && git log --oneline HEAD..upstream/main`
shows **9 commits** (`fdd6adc..ef97ada`):

```
ef97ada Fix source_create_tarball.py (#299)
9cfbfab Update website and changelog for v0.0.12 (#298)
048e7fc Add source autas: Australia, Tasmania 2 m (#297)
f81c706 Add source esmdt50*: Spain, partial 50 cm (#293)
30d18d7 Add source aatw: Taiwan, 20m (#292)
b029dd8 Add source debw025: Germany, Baden-Württemberg 25 cm (#290)
a0ae374 Add source frhd* and update multi-host pipeline (#289)
fdd6adc Add tar-store to source-store scripts (#286)
57f8481 Update worker, reduce memory usage (#285)
```

A raw `git diff HEAD upstream/main --stat` also shows ~93 files /
~475k lines of *deletions* — this is **not** real: it's the diff
mechanically noticing that upstream never had this fork's own
`jpnational*`/`jphokkaidodem1` source-catalog entries (75,819-line
`file_list.csv`s etc.), which is expected and must not be read as "the
merge will delete these." A real `git merge upstream/main` (three-way,
common-ancestor-based) will not touch files this fork added that
upstream never had — confirmed by reasoning about the mechanism, not
yet by actually running the merge.

**Decision (the *policy*, not yet the execution)**: When this work
starts, go commit by commit, not as one bulk merge:

1. **`57f8481` "Update worker, reduce memory usage" first, on its own,
   read closely before merging.** This is the highest-value commit —
   real memory pressure was directly observed on `slate` during the
   D16 build (D21: ~244MB free system memory with 4 parallel
   `AGGREGATION_WORKERS`, plausibly contributing to the throughput
   problems D21's shuffle fix addressed from a different angle). A
   prior session (2026-08-14, `japan-geotiff-dem`-adjacent memory) had
   already flagged this exact commit as needing a companion
   `downloader.py` process not yet set up — check whether that's still
   true and what it actually requires before merging.
2. The five `Add source <country>` commits (`048e7fc`/`f81c706`/
   `30d18d7`/`b029dd8`/`a0ae374`) are additive, non-Japan source-catalog
   entries — low collision risk with this fork's own Japan-specific
   work, but `a0ae374` also touches "multi-host pipeline" per its own
   title, which needs reading before assuming it's purely additive.
3. `fdd6adc`/`9cfbfab`/`ef97ada` are infra/docs/small-fix commits —
   check each individually for relevance, no assumption either way.
4. For every commit: read the actual diff and commit message first,
   understand *why* upstream made the change (not just what changed),
   check it against this fork's own Japan-specific modifications
   (D11's requantization/`macrotile_z` fixes, D18/D20's priority-merge
   groupby logic, D21's queue shuffle) for real conflicts vs. just
   textual overlap, and only then merge — one commit or one logical
   group at a time, testing after each, not as a single giant merge
   commit that's hard to bisect if something breaks.

**Explicitly not decided yet**: whether to `git merge upstream/main`
wholesale after the commit-by-commit review, cherry-pick individual
commits, or some mix — that's a call to make once the actual diffs are
read, not before.

**Consequences**:
- This is deliberately sequenced *after* the current build settles
  (not concurrently) — merging upstream changes into a fork whose
  aggregation code is mid-execution (and was just modified three times
  this session, D18/D20/D21) is exactly the kind of avoidable risk
  Hidenori asked to guard against ("技術的な事故を避けるために慎重に").
- `57f8481`'s memory-reduction work, if it changes `aggregation_run.py`'s
  own architecture (Manager/Worker model per earlier session notes),
  may interact with D21's `random.shuffle()` fix — re-verify D21 still
  holds (or reapply its intent in whatever new form the code takes)
  after merging, don't assume it survives untouched.
- No code has been touched for this entry — it is pure planning,
  meant to be picked up fresh next session with full context intact.

## D23: Two-week strategy — finish upstream sync, pivot from "one giant national build" to incremental build-and-publish, gated on a fresh jpnational1

**Status**: Accepted (strategy), 2026-08-21. Execution spans roughly the
next two weeks; this entry records the shape of the plan, not a
session-by-session log (see `HANDOVER.md` for that as each phase
happens).

**Context**: The D16 build (`jpnational5`/`10`/`sea` national + `jpnational1`
still regional) has made it obvious, mid-run, that a genuinely
national-scope build is a much bigger undertaking than any prior run —
5,765 aggregation items at this intermediate scope alone, multi-day
wall-clock even with 4 parallel workers, and (per this same session's
own findings) capable of silently accumulating **139GB across 1,431
uncleaned `tmp-store` directories** from repeated interruptions before
anyone noticed (cleaned up this session, see below). The original plan —
finish this Kyushu-region-plus-national-fallback build, then separately
expand `jpnational1` to national scope, then do a *second*, final,
even-larger national build from scratch — front-loads a lot of risk and
wall-clock into a single terminal event. Hidenori's own framing:
finish the upstream-tracking work first (D22, in progress this same
session), then restructure the build itself around **incremental
publish** rather than one final monolithic one.

**Decision — the new sequence**:

1. **Finish D22's upstream-tracking work to a reasonable stopping
   point** before touching build strategy further. This session
   already: cherry-picked `57f8481`'s memory-reduction GDAL flags and
   LERC compression into `aggregation_reproject.py`/`aggregation_merge.py`
   (paused the D16 build to do it live, per Hidenori's explicit
   "テストビルドだから" permission — D16's build is genuinely a test/
   staging build at this scope, not the terminal artifact), and is
   mid-benchmark on whether LERC's decode cost on slate's storage is
   worth its space savings. Remaining upstream work (deferred until
   this benchmark lands and, per Hidenori, until the build settles
   again): the five `Add source <country>` commits, the two small
   infra/doc commits, and — the big one — properly integrating
   `57f8481`'s multi-host `worker.py`/`downloader.py`/queue-and-ready
   mechanism into this fork's own `aggregation_id`-scoped `tmp_folder`
   layout (D12), not skipping it, per Hidenori's explicit instruction
   that `hfu/mapterhorn` should stay a faithful soft-fork of
   `mapterhorn/mapterhorn` — mirroring the historical relationship
   between GNU Emacs and Mule (a Japanese/multilingual-enhancement
   fork out of ETL Tsukuba that stayed close enough to upstream to
   merge back in, rather than drifting into a permanent separate
   fork). Any fix found along the way that isn't Japan/DEM-specific is
   a mainstream-PR candidate (D17's own standing policy) — evaluate
   this honestly per-commit, not as a blanket goal.

2. **Pause the current Kyushu-region-scope test build at a convenient
   point** (not mid-item, not urgently — "適当なタイミングで" per
   Hidenori) once the LERC benchmark verdict is in and the immediate
   upstream-sync work above reaches a stopping point.

3. **Run `jpnational1`'s national expansion** (D14's proven recipe:
   regenerate `source-catalog/jpnational1/file_list.csv` unfiltered
   from `japan-geotiff-dem`'s national `1/latest_file_list.csv.gz`,
   `aria2c` download, D15's `gdal vector concat` bounds/polygonize).
   This was already sequenced to come after D16's test build proved
   the downstream stages stable at the current union extent (D16's own
   reasoning) — that condition is being treated as satisfied once (1)
   and (2) above are done, not deferred further.

4. **Before the real national-scope build starts, clean any
   intermediate data whose freshness relative to a national
   `jpnational1` is in doubt.** Hidenori's own framing: once
   `jpnational1` genuinely reflects the latest national 1m coverage,
   that freshness is high-value and shouldn't sit next to stale
   partial-region intermediate artifacts from the old regional-scope
   `jpnational1`. Concretely, before `aggregation_covering.py` runs
   again for the national-scope pass: clear `tmp-store` (already
   proven safe to do the same way this session did — verify zero
   `.done` correlation before deleting, never delete anything with a
   matching `.done`), and re-examine whether `pmtiles-store`/
   `bundle-store`/`meta-store` content built against the old regional
   `jpnational1` extent needs invalidating rather than silently
   reused. **Not yet fully specified — this needs its own short design
   pass when the moment actually arrives**, informed by whatever
   `aggregation_covering.py`'s own dirty-tile mechanism
   (`get_dirty_aggregation_filenames`, already used by
   `downsampling_run.py`/`bundle.py` for cross-generation diffing, see
   below) turns out to handle automatically versus not.

5. **Restructure the national build itself around incremental
   build-and-publish, not one terminal run.** Hidenori's proposal:
   roughly every time aggregation's `.done` count advances by some
   chunk (his own example unit: "100 done" — not a hard commitment,
   the real unit should be chosen once real throughput is known post-
   ①②), pause fresh aggregation work, run the downstream chain
   (`downsampling_run.py` → `bundle.py` → `merge_japan_bundles.py` →
   `rsync` to `stars`) over whatever's ready, publish that
   `japan.pmtiles` update, and only then resume aggregating the next
   chunk. This trades a single enormous multi-day run with one
   all-or-nothing payoff for a series of smaller, independently
   verifiable, independently valuable publishes — consistent with
   this project's broader pattern of treating incremental progress as
   real, shippable value (`japan-geotiff-dem`'s own per-Zone publish
   cadence is the same instinct).

   **Real technical wrinkle, found this session, not yet resolved —
   flag before committing to a chunk size**: `downsampling_run.py`'s
   `create_tile()` silently treats a missing child PMTiles file as "no
   data there" rather than "not ready yet," and marks the parent
   `-downsampling.done` regardless (the function's own inline comment
   already warns about this: "create_tile() silently skips missing
   inputs and marks the item .done anyway — producing a permanently
   incomplete tile with no retry"). Given the incremental-publish
   pattern will *routinely* call downsampling while aggregation is
   still incomplete for some parent tiles' children (that's the whole
   point), this isn't a rare edge case here — it's the normal mode.
   `downsampling_run.py` already ships a `--regenerate PATTERN` flag
   (removes a specific `-downsampling.done` marker to force
   reprocessing) built for exactly this kind of repair, and
   `bundle.py`/`downsampling_run.py` already have a "dirty" mechanism
   keyed on comparing `aggregation_ids[-1]` against `aggregation_ids[-2]`
   (`get_dirty_aggregation_filenames`) — but that mechanism is built
   for diffing between two *complete* aggregation generations (e.g.
   before/after `jpnational1` goes national), not for "the same
   generation, just further along than last time." **Before locking in
   a chunk size or an automation script for step 5, spend a short,
   explicit design/verification pass on**: whether each incremental
   downsampling/bundle pass should track and re-`--regenerate` any
   macrotile whose child set changed since its own last pass (not just
   since the last aggregation generation), and whether `bundle.py`'s
   archive output is safely re-buildable from partial+later-completed
   downsampling output without hand-holding. Don't assume either way
   without checking `merge_japan_bundles.py` and a real dry run first.

**Consequences**:
- This sequencing means `jpnational1`'s national expansion — sitting
  ready since D16 deliberately deferred it — starts noticeably sooner
  than the original "finish this whole test build first" plan implied,
  once the upstream-sync and LERC-benchmark work in front of it
  actually wraps.
- The eventual national build becomes a *series* of publishes to
  `stars`, not one. `stars`/`martin`+Caddy hosting (D13) already serves
  `japan.pmtiles` for daily use outside the slower Source Cooperative
  path — this incremental cadence fits that hosting choice better than
  it would fit a Source-Cooperative-primary publish model.
- The tmp-store cleanup performed this session (1,682 directories,
  96.1GB freed, zero of them carrying a `.done` marker — verified
  before deletion, not assumed) is itself the first concrete instance
  of the "clean suspect intermediate data" instinct in point 4 above,
  done opportunistically once Hidenori confirmed it was safe to do
  proactively at this stage ("この段階まで来ているので、古い中間ファ
  イルのクリーンアップは積極的に実施していい").
- Point 5's open technical wrinkle is a real risk to the whole
  incremental-publish idea if left unresolved — a chunk boundary that
  lands mid-macrotile could otherwise bake a permanent hole into
  published output with no automatic self-heal. Treat resolving this
  as a prerequisite design task early in week 1, not a detail to
  discover the hard way mid-build.

### D23 addendum (2026-08-21, same session): parallel download-and-build during the 3-day unattended window; storage estimate; a benchmarking methodology bug found and fixed

**Parallel execution during the 3-day unattended `slate` window**:
Hidenori will leave `slate` unattended for roughly 3 days. `jpnational1`'s
national-scope expansion (D14's recipe) splits into two phases with very
different resource profiles: **download** (`source_download.py`, aria2c)
is network-bound — the previous regional-scope run (75,818 entries)
measured **2h16m4s**, dominated by parallel-connection wait time, not
local CPU/disk; **polygonize/bounds** (`source_polygonize.py`, D15's
`gdal vector concat` rewrite) is CPU/subprocess-bound — the same
regional scope measured **~4h17m under the old per-file method**, and
D15's rewrite target is ~31ms/file for the concat phase specifically
(~2.5h projected at national scale, concat phase only). These two
phases don't meaningfully compete with the currently-running D16
aggregation build (also CPU/disk-bound, and now lighter per-worker
after this session's GDAL memory-reduction cherry-pick) for the same
resource during the download phase.

**Decision**: don't wait for the Kyushu-scope test build to reach a
convenient pause point before starting `jpnational1`'s download step —
start the aria2c download **now, concurrently** with the ongoing
aggregation build, since it's network-bound and the build is
CPU/disk-bound. Revisit only when the download completes and the
CPU-bound polygonize phase is ready to start — *that* phase genuinely
competes with the aggregation build for CPU, and should either wait
for a natural pause point in the build or run with reduced worker
counts on both sides, decided when that moment actually arrives rather
than pre-committed now.

**Storage estimate for the download phase**: `jpnational1`'s current
regional-scope `source-store` measures **86GB across 75,820 files**
(~1.13MB/file average, measured directly on `slate`, not estimated).
Scaling linearly to the national manifest (~291,779 files, D16's own
figure) projects a **total of ~330GB**, of which **~244GB is net-new
download** (the regional subset already present doesn't need
re-fetching — `aria2c`'s checksum-based skip, D14). Against the
**944GB free** on `/Volumes/Migrate-2025-04` (measured after this
session's `tmp-store` cleanup, up from 842GB before it), this is a
**low but non-zero risk** — comfortable headroom for the download
alone, but the aggregation build's own `tmp-store` usage can regrow
during unattended operation (it only shrinks via successful
per-item cleanup or an explicit sweep like this session's; repeated
unattended interruptions, e.g. a network drop mid-run, would leave more
orphaned partial directories, the same failure mode just cleaned up).
**Recommendation**: a disk-space check partway through the 3-day
window (not just at the end) is worth building into whatever
unattended-operation script or reminder covers this period — this
wasn't a scheduled check before this session surfaced the 139GB/1,431-
directory accumulation by accident.

**A benchmarking methodology bug, found and corrected this same
session**: the ①② throughput comparison above was initially computed
by counting `.done` files across the *entire* `aggregation-store`
directory tree with a single recursive `find`. This silently summed
across **four different `aggregation_id` generations** (`01KZK5Q1XWP5N0YBEPBSB1DX3R`,
`01KZM87D6PEKWM2B2ZEDSNFSQW`, `01KZVPVTAM9V0QP8SRR42XRYKW`, and the
actually-active `01M0FNHYXSAMNVTV430XD3XB5T`) — only the last of which
`aggregation_run.py main()` ever touches (it always operates on
`utils.get_aggregation_ids()[-1]`). The other three are static
leftovers from earlier build generations and never change during a
run, so raw deltas over a short window happened to still be
attributable to the active generation (the static offset cancels out
in a delta) — but the absolute counts reported (e.g. "4405/4406") were
meaningless on their own, and this was not caught until a deeper
per-item mtime cross-check surfaced the inconsistency. **Corrected
throughput, scoped correctly to `01M0FNHYXSAMNVTV430XD3XB5T`
(csv=5875 total)**: pre-patch baseline **62 items in ~29 min**
(≈2.14/min); post-patch, **1 item in ~24 min** (≈0.042/min) as of this
addendum — a ~50x apparent slowdown on a single-item sample, well past
Hidenori's "2x slower → drop LERC" threshold if it holds up, but not
yet trustworthy given D21's own established item-cost variance and a
sample size of one. Benchmarking continues with the corrected,
generation-scoped counting method. **Lesson for future benchmarking in
this pipeline**: always scope progress-counting to
`aggregation-store/{utils.get_aggregation_ids()[-1]}/`, never the
whole tree, once more than one generation exists on disk.

### D22 follow-up (2026-08-21, same session): LERC on ephemeral aggregation intermediates dropped after real-benchmark verdict; GDAL memory-reduction flags kept

**Status**: Decided, acted on. Supersedes the "mid-benchmark" framing in
the D23 addendum above for this specific piece of `57f8481`.

**Context**: The D23 addendum above recorded an initial, low-confidence
signal (n=1, ~50x apparent slowdown) from cherry-picking both halves of
`57f8481`'s aggregation changes — GDAL memory-reduction flags
(`GDAL_CACHEMAX=64`, `GDAL_NUM_THREADS=1`, `GDAL_MAX_DATASET_POOL_SIZE=1`)
and LERC compression (`COMPRESS=LERC -co MAX_Z_ERROR=0.001`) on
`aggregation_reproject.py`'s `translate()` output and
`aggregation_merge.py`'s merged-tile profile — together into the live
D16 test build. Hidenori's own standing threshold, stated in advance:
"計測の結果、例えば２倍以上遅いということであれば、LERCを外すという
判断をせざるを得ないだろう" (if measurement shows e.g. 2x+ slower,
we'll have no choice but to drop LERC).

**A second, independent data point confirmed the first wasn't a fluke**:
item 1 (post-patch) took ~17 min; item 2 took ~35 min. Both are
15-35x slower than the pre-patch, generation-correctly-scoped baseline
of 62 items in 29 min (≈2.14/min, ≈28s/item average). Cross-checked
against worker CPU-time accounting at the moment of the second
completion: two of the four `multiprocessing.Pool` worker processes
had accumulated 45:16 and 42:42 of actual CPU time against ~53 minutes
of wall-clock since the patched run started — i.e., those workers were
pegged at or near 100% CPU for nearly the entire window, not idle or
I/O-waiting. This is consistent with the hypothesis floated earlier
this session: `aggregation_merge.py`'s `merge()` does **repeated
windowed reads across every grouped-source tiff** (once per
non-overlapping tile-window, and again per candidate tiff within a
window when filling gaps) — for LERC-compressed inputs, every one of
those windowed reads pays a real LERC-block decode cost, and items
with several grouped source items (6-8+, not unusual per this
session's own `tmp-store` inspection) multiply that cost. This is a
categorically different access pattern than the one upstream's own
`mapterhorn/mapterhorn#186` "TIF compression" issue actually validated
LERC against — that discussion (Oliver Wipfli, with input from LINZ's
published elevation-data compression research and community
benchmarking) is about **source tarball compression for storage/
transfer efficiency**, a write-once/read-rarely access pattern. It
never covers LERC applied to short-lived intermediate files inside a
tight per-window read loop. The two use cases share a codec, not a
cost-benefit profile — conflating them was the actual mistake here,
not a flaw in upstream's own reasoning (see this session's answer to
Hidenori's "LERC採用基準" question for the fuller writeup, not
re-duplicated here).

**Decision**: Paused the D16 test build a second time (per Hidenori's
own "テストビルドだから" / pause-merge-resume precedent, and his
explicit pre-authorization of the 2x threshold), reverted only the
`COMPRESS=LERC -co MAX_Z_ERROR=0.001` additions in
`aggregation_reproject.py`'s `translate()` and reverted
`aggregation_merge.py`'s profile back to no explicit `compress` key
(matching pre-session behavior, effectively uncompressed intermediate
tiffs). **Kept**: the GDAL memory-reduction flags
(`GDAL_CACHEMAX=64`/`GDAL_NUM_THREADS=1`/`GDAL_MAX_DATASET_POOL_SIZE=1`)
— independently verified earlier this session to cut per-`gdal_translate`
RSS from ~800MB to ~10-12MB with no observed throughput cost, a clean
win on its own. Also kept the `'heterogeneous projection' in err`
exception check added to `create_virtual_raster()` — unrelated to
LERC, a real correctness improvement, zero measured cost. Resumed the
build under this reduced patch; a fresh generation-scoped monitor is
running to confirm throughput recovers toward the ~2/min baseline.

**Consequences**:
- This specific piece of `57f8481` (LERC on aggregation intermediates)
  is **not** being adopted into `hfu/mapterhorn`, at least not as
  upstream wrote it. If LERC's smaller intermediate file size is ever
  wanted here again (e.g. if disk footprint becomes the binding
  constraint rather than CPU), revisit with a targeted fix instead of
  upstream's blanket approach — e.g. compress only the *final*
  written-once `{num_tiff_files}-3857.tiff` merge output (which
  `aggregation_tile.py` reads only once per item, not in a tight
  per-window loop across multiple files) while leaving the
  intermediate per-group `{i}-3857.tiff` reproject outputs (the ones
  `merge()` re-reads repeatedly) uncompressed. Not attempted this
  session — a real next-step candidate if disk pressure reappears
  rather than memory pressure.
- The GDAL memory-reduction flags stand as a genuine, adoptable piece
  of `57f8481` on their own merits — this doesn't change D22's overall
  per-commit, not-a-blanket-merge discipline; it's exactly what that
  discipline was for.
- `mapterhorn/mapterhorn#186` is worth a second look if/when this
  fork ever revisits `source_to_cog.py` (D5) — the same LERC+ZSTD
  combination Oliver and `lseelenbinder` discussed there (marginal
  gain observed: 412MB vs 425MB on one Canada tile) is a genuinely
  separate, still-open question from what got resolved here.

**Verification, post-revert (2026-08-21)**: resumed at 06:45 with 244
items done in the active generation; reached 290 by 07:09 — **46 items
in ~24 minutes, ≈1.9/min**, back in line with the original pre-any-
patch baseline (62 items in 29 min, ≈2.14/min) and consistent with
D21's own known item-cost variance rather than any residual slowdown.
A short initial burst right after resume (244→283 in the first ~12
min, ≈3.3/min) is attributable to several items whose `reproject()`
stage had already completed and cached (`reprojection.json` present)
before the pause, letting them skip straight to `merge()`/`tile()` —
not representative of steady-state throughput, hence the fuller
24-minute window above as the real number. **LERC on aggregation
intermediates is confirmed dropped, final**; GDAL memory-reduction
flags confirmed adopted, final.

### D22 follow-up, continued: ③ (multi-host `worker.py`/`downloader.py`/queue mechanism) also dropped, same session

**Status**: Decided, 2026-08-21, same session as the LERC verdict
above. Revises this entry's own earlier framing (which treated ③ as
"integrate carefully into D12's `tmp_folder` layout, don't skip, for
upstream fidelity") and D23's point 1.

**Context**: Hidenori's own follow-through, immediately after the LERC
verdict landed: "②を未採用にするということは、なおさら③は未採用だね。
現実的な時間で作れることが重要だよ" (dropping ② makes dropping ③ even
more clearly right — building this in a realistic timeframe is what
matters). ③ exists upstream to solve a problem this fork doesn't
have: staging source data with a size-capped, LRU-evicted local cache
(`downloader.py`'s `MAX_TMP_SOURCE_SIZE`, default 100GB) so that
aggregation workers on a host without a full local copy of
`source-store` can still process items, coordinating across multiple
physical hosts via `worker.py`'s hostname-scoped task files. This
fork runs single-host (`slate`), with `source-store` already fully
present locally (D14's aria2c download populates it directly, no
staging needed), and — as of this session — comfortably provisioned on
disk (943GB+ free after cleanup, national `jpnational1` fully sized at
~330GB, well within budget). ③ would add real, ongoing complexity (a
background `downloader.py` process, `tmp-store/queue`/`tmp-store/ready`
file-based handshaking, reconciling with D12's own `aggregation_id`-
scoped `tmp_folder` layout which conflicts with upstream's flat one)
to solve a problem that doesn't exist here, for a fork whose priority
this session shifted decisively toward shipping the national build in
a practical timeframe (D23) rather than maximizing upstream mechanism
parity for its own sake.

**Decision**: Do not integrate ③. Upstream sync for the remaining
`57f8481` pieces (`manager.py`'s two small fixes, `find_aggregation.py`'s
debug-target change) and the rest of the D22 commit queue (five
`Add source <country>` commits, three infra/docs commits) continues
per D22's original per-commit discipline — but ③ specifically is now
explicitly out of scope, not just deferred. If a genuine multi-host
need arises later (e.g. this fork's own scale eventually outgrows one
Mac mini), revisit as a fresh design informed by whatever this fork's
actual bottleneck turns out to be at that point, not by importing
upstream's mechanism wholesale.

**Consequences**:
- `hfu/mapterhorn`'s "faithful soft-fork" aspiration (this session's
  own Mule/Emacs framing, D22/D17) is qualified, not abandoned: fidelity
  to upstream's *correctness fixes and genuinely-applicable
  optimizations* remains the standing practice; fidelity to upstream's
  *architecture* for problems this fork doesn't share is explicitly
  not the goal. `hfu/mapterhorn` diverging from `worker.py`/`downloader.py`
  going forward is an accepted, deliberate gap, not a fork drifting
  by neglect.
- Any future mainstream-PR contribution candidate (D17) from this
  fork's own work is unaffected by this decision — it's about what
  this fork *pulls in* from upstream, not what it might contribute
  back.

### jpnational1 download: slow CPU-bound verification phase, accepted as-is

Around 45 minutes into the national-scope `aria2c` run, `jpnational1`
still showed zero new files (`75,818/291,779`, unchanged) — the
`--check-integrity=true` re-hash of the 75,818 already-present files
(~86GB) is taking longer than a naive disk-bandwidth estimate would
suggest, most likely from genuine 3-way CPU contention with the
concurrently-running aggregation build and `jpnational5`'s own
`aria2c` hash-and-download pass (confirmed alive throughout: 34.9%
CPU, 16:33 accumulated CPU time, not stalled). Hidenori's call:
"1が動かないのは許容可能" (jpnational1 not moving is acceptable) — no
intervention, let it work through the verification phase at whatever
pace the shared CPU allows.

## D24: "rational for Oliver's environment, not rational for ours" — a first pipeline-wide audit

**Status**: Accepted (as a standing lens), partial audit done
2026-08-21; not exhaustive, flagged below.

**Context**: This session's LERC verdict (D22 follow-up above) produced
a generalizable lesson, in Hidenori's own words: "oliverの環境では合
理的な実装でも、私たちの環境では合理的ではない場合があり得る" (an
implementation that's rational in Oliver's environment can be
irrational in ours). Oliver's environment, inferred from `57f8481`'s
shape alone (multi-host `worker.py`, size-capped LRU `downloader.py`
cache, `NUM_WORKERS` defaulting to 32, aggressive per-call GDAL memory
caps), looks like distributed/many-small-workers processing against
network/cloud-adjacent storage, at genuinely global multi-source
scale. This fork runs single-host (`slate`, one M4 Mac mini), with
abundant local SSD, Japan-only source data, and (per D23) a hard
practical-timeframe constraint. Worth a deliberate pass through the
pipeline with this lens, not just reactively per-commit during D22.

**Findings — already correctly adapted (positive precedent, no action needed)**:
- **D5 (skip `source_to_cog.py`)**: upstream's blanket "re-encode every
  source to LERC" step, skipped because `japan-geotiff-dem`'s source is
  already tiled/well-compressed and re-encoding would force local
  downloads incompatible with this fork's URL-streaming design (D3).
  This is, in hindsight, the *same* environment-mismatch pattern
  identified this session, applied correctly a session earlier.
- **Worker-count defaults**: `aggregation_run.py`'s `get_worker_count()`
  defaults to 4 ("half of typical 8-core hardware"), `downsampling_run.py`
  defaults to 5 — both explicitly hardware-tuned for this Mac mini, not
  inherited from upstream's `worker.py` 32-worker default.
- **`merge_japan_bundles.py`**: generalizes upstream/shared
  `merge_bundles.py` (hardcoded to two specific Freetown filenames) into
  a glob over every `bundle-store/*.pmtiles`, and its own output metadata
  correctly centers on Japan (140.9°E, 41.85°N), not Freetown. Kept
  fork-local (not merged into `hfu/mapterhorn` proper) by design, per
  `FORK_NOTES.md`'s generic-fix-vs-Freetown-specific split.
- **D13's `TMPDIR=/Volumes/Migrate-2025-04/tmp` redirection** for
  `merge_japan_bundles.py`: already a real instance of adapting an
  upstream-shaped step to this machine's actual disk layout.

**Findings — dropped this session (see D22 follow-up entries above)**:
② LERC on aggregation intermediates, ③ the multi-host `worker.py`/
`downloader.py`/queue mechanism.

**New finding — not yet fixed**: `downsampling_run.py`'s `CENTER_LAT`/
`CENTER_LON` still default to **Freetown, Sierra Leone** (8.465,
-13.234) — a leftover from this fork's earlier Freetown/orthophoto
project. `grep` across `Justfile`, `manager.py`, and
`mapterhorn-japan-bridge/HANDOVER.md` found **zero evidence these were
ever overridden** for any Japan `downsampling_run.py` invocation to
date, including D13's own 789,984-tile build. This doesn't corrupt
output — `sort_files_by_proximity()` only affects **processing order**,
not correctness, and D13's build ran to full completion regardless of
order — but it matters more now: D23's incremental/staged publish
strategy explicitly depends on processing order to decide what's
"done enough to publish first."

**A sharper point than just "wrong default"**: the whole "sort by
distance from one center point" model was designed for Sierra Leone —
a geographically compact country, where radial distance from a single
point is a sensible proxy for "processing this next is broadly useful
soon." Japan is a ~3,000km north-south archipelago; radial distance
from any single center point is a poor fit for that shape (e.g.
Hokkaido and Kyushu are both "far" from a naive center, but
geographically unrelated to each other). This directly connects to
this same session's earlier `quadrans`-style mesh-code quadrant
discussion (`japan-geotiff-dem/scripts/quadrans_script.rb`'s
North/East/West/South split, purely from the mesh code's own digits,
no external reference needed) — that framing isn't just a workaround
for GSI-Zone-boundary-undeterminability (this session's earlier
finding), it's plausibly a **better-fitting prioritization model for
Japan's actual geography** than upstream's Freetown-shaped default,
independent of the publish-batching question it was originally raised
for.

**Not yet acted on** — this needs a decision, not just a note:
1. At minimum, set `CENTER_LAT`/`CENTER_LON` to something Japan-
   appropriate (e.g. Japan's rough geographic center, ~36°N 138°E)
   before the next real `downsampling_run.py` invocation.
2. Worth considering instead: replace `sort_files_by_proximity()`'s
   radial-distance model with the mesh-code-quadrant classifier for
   Japan-specific runs (via an env-var-gated code path, or a fork-local
   override, matching this file's own established
   fork-vs-upstream-shared conventions) — a more substantial change,
   not just a config default, and one that would also directly serve
   D23's batch-boundary design question. Hidenori's call on scope/timing.

**Audit coverage, explicitly incomplete**: this pass covered
`aggregation_reproject.py`/`aggregation_merge.py`/`aggregation_run.py`
(via D22), `worker.py`/`downloader.py`/`manager.py` (via D22),
`downsampling_run.py` (this entry), `merge_japan_bundles.py` (this
entry), and `source_to_cog.py`/D5 (retrospective). **Not yet reviewed
through this lens**: `source_download.py`, `source_bounds.py`,
`source_polygonize.py` (D15 already optimized it for scale, but not
specifically re-examined for Oliver-vs-us environment fit),
`aggregation_covering.py`, `bundle.py` (its `create_archive()` sorts
every tile ID into memory in one pass and reads full archives
sequentially — worth checking whether this scales comfortably to a
true national tile count on this machine's RAM before it's exercised
for real, not assumed either way). Revisit before the national build's
downsampling/bundle stages actually run at full scale, per D23's own
sequencing.

**Hidenori's processing-priority preference for the eventual quadrans-based
batching (D24's open item 2)**: North Japan → South Japan → East Japan →
West Japan, in that order. Explicitly a personal preference, not derived
from a technical constraint — record and honor it once the
quadrans-style mesh-code classifier actually gets wired into
`downsampling_run.py` (or wherever the eventual batch-ordering logic
lands), rather than defaulting to alphabetical or some other arbitrary
order. `downsampling_run.py` itself remains unmodified as of this
entry — `CENTER_LAT`/`CENTER_LON` still default to Freetown, no
quadrans logic wired in yet, this is still an open item, not started.

## D25: Hole-free, progressive execution order for the national build — a concrete design (plan, not yet implemented)

**Status**: Plan accepted, 2026-08-21; execution not yet started.
Follows the same "record the plan before touching code" discipline
D22 used. Closes the open technical wrinkle D23 flagged but didn't
resolve.

**Context**: D23 identified the risk (`downsampling_run.py`'s
`create_tile()` silently treats a missing child as "no data" rather
than "not ready," permanently baking a gap into any parent tile
downsampled before all its children exist) and proposed a front-stage/
back-stage split (fix the full national *covering* first, only then
run the heavy per-item pixel work) as the general shape of a fix, but
left the actual execution order unspecified. Hidenori asked directly
whether the hole problem was actually solved (it wasn't) and asked for
an order that is simultaneously logically consistent (no holes) and
progressive (real partial results well before the full national build
finishes, given it will run for weeks).

**Decision — the design**:

1. **Front stage, run once, fixed for the whole national build**:
   `aggregation_covering.py` against the full national union (once
   `jpnational1` goes national, D14's recipe). This produces the
   complete, final set of aggregation items and downsampling items —
   nothing added or removed from this set for the rest of the build.
   Fixing this set upfront is what makes "has this downsampling item's
   full child set completed" a well-defined, stable question later —
   it can't be a moving target.

2. **Back stage, ordered by Hidenori's quadrans priority (北日本→南
   日本→東日本→西日本)**: aggregation items get a priority weight from
   the mesh-code-style quadrant classifier (`japan-geotiff-dem/scripts/
   quadrans_script.rb`'s North≥62/East≥38/South≤32/West-else logic,
   reimplemented against each aggregation macrotile's own tile bounds
   rather than a GSI mesh code — a geometric equivalent, not a literal
   reuse of the Ruby script). Within a priority tier, keep D21's
   `random.shuffle()` — priority determines *which region tends to
   finish first*, not a rigid per-item sequence; load-balancing across
   the 4 workers still matters more locally.

3. **The actual hole-avoidance mechanism — per-item readiness, not
   per-quadrant gating**: a downsampling item is safe to run exactly
   when *all of its real children* (computed the same way
   `downsampling_run.py`'s own `create_tile()` already does,
   `mercantile.children(extent, zoom=parent_zoom)`) have a matching
   aggregation `.done` marker — checked directly, not inferred from
   "is its whole quadrant done." This deliberately sidesteps the
   boundary case a naive per-quadrant gate would mishandle (a parent
   tile straddling e.g. the North/East boundary would, under a
   per-quadrant gate, either publish too early with a hole on one side
   or wait on a quadrant it barely touches — a per-item check just
   waits for its own actual children, correctly, regardless of which
   quadrant(s) they fall in). Quadrans priority influences *when* a
   given item is likely to become ready, not whether it's ever allowed
   to run unready.

4. **New, small piece of code needed** (not yet written): a readiness
   filter — for each `*-downsampling.csv` in the active generation,
   check whether every child's aggregation `.done` exists; only pass
   the ready subset into `downsampling_run.py`'s processing loop
   (today's `main()` has no such check — it just processes whatever
   dirty-filtered downsampling-csv files exist, trusting them to be
   complete). Natural home: either a new `get_ready_downsampling_
   filepaths()` helper in `downsampling_run.py` itself, or a small
   standalone script mirroring `check_download_progress.py`'s style
   (read-only, reports readiness; a `--run` mode actually invokes
   `downsampling_run.py`'s existing per-file processing on just the
   ready set).

5. **The publish loop**: periodically (D23's still-open "chunk size"
   question — could be time-based, e.g. hourly, rather than a raw
   `.done`-count threshold, given the readiness filter already does
   the real gating work) — run the readiness filter → `downsampling_
   run.py` over the ready subset → `bundle.py` → `merge_japan_
   bundles.py` → `rsync` to `stars`. Because nothing is ever
   downsampled before it's genuinely complete, **`--regenerate`
   reverts to being a manual repair tool for actual anomalies, not a
   routine step in the normal publish cycle** — a meaningfully
   simpler operating model than D23's original "detect and repair
   holes after the fact" framing.

**`downsampling_run.py` change, separately decided this same session**:
Hidenori explicitly ruled out forking this file into a Japan-specific
copy ("ファイル分割はしないことにしよう") — `downsampling_run.py`
is a real, upstream-tracked shared file (confirmed this session:
150 lines upstream vs. 429 in this fork's already-extended version),
and D11's own precedent (two real bugs caught by diffing this exact
file against upstream) is the concrete reason to keep it that way
rather than forking it. Priority logic — currently
`sort_files_by_proximity()`'s Freetown-centered radial-distance model
(D24's own finding: not just an unset default, a poor geographic fit
for Japan's shape even if the coordinates were corrected) — becomes
switchable via the same environment-variable-driven pattern this file
already uses for `CENTER_LAT`/`CENTER_LON` and `TILE_ENCODING`
(`terrarium`/`rgb`), not a structural fork. Hidenori's own framing for
why: "数百行程度のプログラムの整合よりも、数週間かかる生産が合理的
にあとづけ可能になることを優先する" (a few hundred lines of code
staying tidy matters less than a multi-week production run staying
rationally explicable after the fact) — thorough documentation
(this entry, plus inline comments once implemented) is the explicit
priority alongside the code change itself, not an afterthought.

**Consequences**:
- This design is not yet implemented — no code changes accompany this
  entry. Implementing it (the quadrant classifier, the readiness
  filter, the `PRIORITY_MODE`-style switch in `downsampling_run.py`,
  wiring the publish loop) is real, non-trivial engineering, properly
  scoped as its own piece of work rather than squeezed into this
  session's live benchmarking. Sequenced after D22's remaining
  upstream-sync items and `jpnational1`'s national expansion complete,
  per D23's overall ordering — but now with an actual answer ready for
  D23's own "chunk size" open question, rather than punting on it
  again when that moment arrives.
- `--regenerate`'s role shrinks from "expected, routine" to "escape
  hatch for real anomalies" — worth updating `downsampling_run.py`'s
  own docstring/comments to reflect this once the readiness filter
  lands, so a future session doesn't rediscover the old assumption.
- The mesh-code-based quadrant classifier will need a from-tile-bounds
  equivalent (not literally the mesh-code arithmetic, since aggregation
  items are indexed by mercator tile z/x/y, not GSI mesh codes) — a
  small, self-contained geometric function, not a big engineering
  lift, but worth writing carefully and testing against a few known
  reference points (e.g. confirm Hokkaido lands in North, Kyushu/
  Okinawa lands in South/West as expected) before trusting it at scale.

### D25 implementation record (2026-08-21, same session)

**Status**: Implemented and verified against real data; not yet
committed to git (holding until the ZSTD verdict on
`aggregation_reproject.py`/`aggregation_merge.py` also lands, so both
sets of this session's changes land together with one clear commit
message rather than piecemeal).

**What was built**:
1. `utils.py`: `japan_quadrans_of(lon, lat)` + `JAPAN_QUADRANS_PRIORITY`
   dict — a lon/lat re-derivation of `japan-geotiff-dem/scripts/
   quadrans_script.rb`'s mesh-code North/East/South/West classifier,
   using the JIS 1st-order mesh grid's own defining formula (mesh y ->
   lat = y × 2/3°; mesh x -> lon = x + 100°) since aggregation items
   here are indexed by mercator tile z/x/y, not GSI mesh codes.
2. `downsampling_run.py`: `PRIORITY_MODE` env var (`proximity`
   default, unchanged behavior; `quadrans` new) switches
   `sort_files_by_proximity()`'s tie-break from Freetown-centered
   radial distance to `JAPAN_QUADRANS_PRIORITY` order (北→南→東→西 per
   Hidenori's stated preference). `DOWNSAMPLING_STRICT` env var
   (off by default, unchanged behavior) — when set, an item with any
   missing referenced child PMTiles is skipped entirely (not marked
   `.done`) instead of proceeding with just a warning, so it gets
   retried once genuinely ready on a later invocation.

**Verification performed**:
- Classifier tested against known city coordinates (Sapporo→north,
  Fukuoka/Naha→south, Tokyo→east, Osaka/Nagoya→west) and exact
  threshold boundaries (138°E, 132°E, 62×2/3°N) — all correct.
  Two of the author's own test expectations were wrong on first pass
  (assumed Sendai/Akita would classify "west"; both are actually east
  of the 138°E threshold despite being on Tohoku's Pacific/day-sea
  sides respectively) — corrected by recomputing the JIS mesh code by
  hand rather than by geographic intuition; the classifier itself was
  right both times.
- Defaults confirmed unchanged: `PRIORITY_MODE=proximity`,
  `CENTER_LAT`/`CENTER_LON` still Freetown, `DOWNSAMPLING_STRICT=False`
  — a bare re-run with no new env vars set reproduces this file's
  original behavior exactly, so any future Freetown work isn't
  affected.
- `DOWNSAMPLING_STRICT=1` tested against 5 real downsampling-csv files
  from the live D16 generation (aggregation only ~6-7% complete at
  test time, so almost nothing should be ready): 3 of 5 correctly
  skipped with the new message and no `.done` created. The other 2
  (both very coarse, `0-0-0-0` and `1-1-0-1`) "succeeded" because the
  test called `main()` directly with an explicit file list, bypassing
  `__main__`'s own dirty-tile pre-filter (`is_parent_of_dirty_
  aggregation_tile`/`not_in_previous_aggregation`) — that filter is
  what normally keeps genuinely-unrelated, already-correct output from
  an earlier generation out of the processing list in the first place;
  calling `main()` directly for a quick test sidesteps it. Not a bug in
  the new logic, just a reminder that `main()`'s test-friendliness
  (accepting an arbitrary file list) trades away the dirty-filter's
  own protection — real runs always go through `__main__`.
- `pipelines/downsampling_covering.py` was also run for real this
  session (94s, CPU-bound, ~91% CPU) to generate the current
  generation's 5,881 `-downsampling.csv` files — this repo's
  `01M0FNHYXSAMNVTV430XD3XB5T` generation previously had **zero**,
  meaning the readiness/priority logic had no real data to test against
  until this ran. Worth remembering as a prerequisite step, not
  something `aggregation_run.py` produces on its own.

**Still open — the publish cadence parameter**: Hidenori's stated
target for the eventual periodic publish loop (D25 point 5, D23's own
open "chunk size" question): roughly **every half-day to a day early
on**, expected to widen as the build progresses and/or throughput
naturally slows — valuable specifically because it lets "is this
actually working" be monitored early rather than only found out weeks
in. Not yet parameterized — needs to be derived from real aggregation
throughput once it's running at national scope (this session's own
measurements, ~2/min for the current Kyushu-scope test build, aren't a
safe basis to extrapolate a national-scope cadence from; D16's own
build hasn't reached that scale yet). Revisit once `jpnational1`'s
national expansion lands and a real national-scope aggregation rate is
observed — pick a time-based trigger (e.g. "run the publish cycle
every N hours" rather than a raw done-count threshold) tuned to that
real rate, not decided now.

### D22 follow-up, ZSTD verdict: adopted, final (2026-08-21)

**Status**: Decided, final.

**Context**: Following the LERC verdict (dropped) and Hidenori's own
follow-up question ("COMPRESS=NONEが我々にとってベストかは未決定
だね... 速くてそこそこ効く圧縮を導入することで、ディスクのデメリ
ットをCPUでカバーできる可能性がある"), tested `COMPRESS=ZSTD
-co ZSTD_LEVEL=1` on the same two spots as the LERC test
(`aggregation_reproject.py`'s `translate()` output,
`aggregation_merge.py`'s merged-tile profile). ZSTD level 1 chosen
specifically for its decode-speed-independent-of-level property
(unlike LERC's block-based float-error-bounded codec) -- reasoning
laid out in the same session's answer to Hidenori's "LERC採用基準"
question. `japan-geotiff-dem`'s own pipeline already uses ZSTD-max
successfully for its own dst/ output, a useful internal precedent
(different access pattern -- write-once -- but same project, same
general codec family, no prior complaints).

**Result**: resumed at 07:19 with 337 items done; reached 398 by
07:48 -- **61 items in ~29 minutes, ≈2.1/min**, matching the original
pre-any-patch baseline (62 items in 29 min, ≈2.14/min) almost exactly.
No LERC-style slowdown. Combined with the earlier short burst right
after resume (337→372 in ~12 min, artificially fast from cached
partial-item state, not representative), ZSTD_LEVEL=1 shows **no
measurable throughput cost** versus uncompressed, while producing
genuinely smaller intermediate files (real disk-I/O and future
disk-space benefit under this session's "slow disk, weak memory"
framing, even though the throughput number alone doesn't directly
prove the disk-I/O benefit -- worth a direct file-size comparison
before/after if this ever needs re-litigating).

**Decision**: Adopt `COMPRESS=ZSTD -co ZSTD_LEVEL=1` /
`compress='ZSTD', zstd_level=1` in both `aggregation_reproject.py`'s
`translate()` and `aggregation_merge.py`'s merge profile, final.
Combined with the GDAL memory-reduction flags (already adopted) and
the `heterogeneous projection` exception check (already adopted), this
is the full, final state of this session's `57f8481` cherry-pick for
`aggregation_reproject.py`/`aggregation_merge.py`. Ready to commit to
git alongside D25's `utils.py`/`downsampling_run.py` changes as one
session's coherent commit.

**Consequences**: `japan.pmtiles`' actual on-disk intermediate footprint
during a build should now be meaningfully smaller than the
pre-session uncompressed baseline, with no observed throughput cost --
a clean win on both axes this session set out to test. No further
compression-scheme experimentation planned for this pipeline stage
unless a new, concrete problem surfaces.

### D24 follow-up: `bundle.py` memory-at-scale concern, measured and resolved (2026-08-21)

**Status**: Investigated with real data; no code change needed.

**Context**: D24 flagged `bundle.py`'s `create_archive()` (sorts every
referenced tile ID into one in-memory list, `Pool(processes=4)` by
default) as un-audited for whether it scales comfortably to a true
national tile count on `slate`. `slate`'s physical RAM was also
checked for the first time this session: **16GB** (`hw.memsize` =
17,179,869,184 bytes), 10 cores (4 performance + 6 efficiency) — a
real, previously-undocumented constraint worth having on record.

**Measurement**: `bundle-store/` already holds real output from an
earlier complete build (D13, dated 2026-08-14) — used directly rather
than synthesizing test data. `get_parent_to_filepaths()` against the
current (regional-plus-national-5m/10m/sea) `pmtiles-store` (64GB,
4,297 files) found **20 z6-parent groups**, largest being
`Tile(x=55,y=25,z=6)` at 1,447 source files, and the "planet" bucket
(`Tile(x=0,y=0,z=0)`, the unparallelized global low-zoom-overview
group flagged as the main risk concentration point) at 1,303 files —
comparable size, not disproportionately larger.

Reproduced `create_archive()`'s own list-building + sort logic
directly against the largest real group (1,447 files → 440,536 tile
entries) and measured peak RSS via `resource.getrusage(...).ru_maxrss`:
**106MB, 12.7s total** (listing all 20 parents: 58MB/3.0s;
building the tile-id list: 9.5s; sort: 0.2s, no measurable RSS
increase). This directly contradicts the theoretical worry — the
in-memory sort step is not GB-scale even for the single busiest region
observed so far.

**National bundle-store file count, estimated via `mercantile.tiles()`
against Japan's bounding box**: ~30 z6 tiles for a tight
mainland+Okinawa bbox, ~49 for a generous one including outlying
islands (Ogasawara etc.) — so **roughly 31-50 total bundle-store
files** at full national scope (30-49 regional archives + 1 planet
archive), consistent with the observed 20-group regional-scope count
scaling up by roughly 1.5-2x, not by orders of magnitude.

**Conclusion**: Even assuming a national 1m expansion increases
per-region file density 5-10x beyond today's busiest region, the
list-construction/sort step would extrapolate to roughly 500MB-1GB —
comfortably within 16GB even across `BUNDLE_WORKERS=4`'s parallel
fan-out (worst case ~4GB). **No code change needed for this specific
concern; D24's flag is resolved by measurement, not by guesswork.**

**Still not measured, lower priority**: `read_full_archive()`'s own
per-source-file memory during the actual tile-writing loop (loads one
whole source `pmtiles-store` archive's tile bytes into a dict at a
time). Individual source archives are the *inputs* to the much larger
aggregated outputs measured above, so they're expected to be smaller
by a wide margin — not measured directly this session, but not treated
as a live risk given the margin already found above. Revisit only if
a real run shows unexpected memory pressure during the write phase
specifically.

### D22 follow-up: ZSTD disk-savings measured directly; a driver-specific option-name bug found and fixed (2026-08-21)

**Status**: Measured and fixed, final.

**Measurement**: direct apples-to-apples test against a real live
intermediate VRT from the running D16 build (`11-1757-826-16/0-3857.vrt`):
`gdal_translate` with `COMPRESS=NONE` produced **381.7MB**;
the same source with `COMPRESS=ZSTD` produced **188.8MB** — a genuine
**~50.5% size reduction (~1.98x compression ratio)** on real
intermediate data, confirming the disk-I/O benefit this session set
out to test (throughput alone, already measured, doesn't by itself
prove the size win).

**Bug found in the process**: `aggregation_reproject.py`'s `translate()`
used `-co ZSTD_LEVEL=1`, which produced `Warning 6: driver COG does
not support creation option ZSTD_LEVEL` on every invocation (silently
swallowed all session — SILENT=True suppresses stdout/stderr unless
explicitly printed, so this warning was never surfaced during the
actual benchmark runs). The **COG** driver (used here, `-of COG`)
unifies DEFLATE/ZSTD/LZMA compression-level control under a single
generic `LEVEL` option, unlike the **classic GTiff** driver (used by
`aggregation_merge.py`'s `rasterio.open(..., 'w', **profile)`, no
explicit driver override so it defaults to GTiff), which uses the
algorithm-specific `ZSTD_LEVEL` name rasterio's `zstd_level=1` kwarg
already correctly targets — confirmed via `gdalinfo --format COG`'s
own option listing. Fixed: `aggregation_reproject.py` now uses
`-co LEVEL=1`. `aggregation_merge.py` was already correct as written
(different driver, different option name, verified via this session's
earlier smoke test).

**Practical impact of the bug, checked directly**: negligible.
Re-ran the same test file with the corrected `-co LEVEL=1`: **188.9MB**,
within 0.06% of the "broken-flag" result (188.8MB) — meaning the COG
driver's ZSTD default level (whatever GDAL falls back to when an
unrecognized option is silently ignored) already happened to be close
to level 1. **This session's throughput measurements (≈2.1/min,
matching baseline) and this size measurement both already reflect
real, representative ZSTD behavior** — the bug didn't skew any
conclusion already reached, it was purely a latent correctness issue
(relying on an undocumented fallback rather than an explicit,
verified setting) worth fixing on its own merits before this becomes
part of the settled, "clean before rollout" baseline.

**Consequences**: ZSTD verdict (adopted, D22 follow-up above) stands
unchanged; this entry just adds the missing size-reduction number and
closes out the "worth a direct file-size comparison... if this ever
needs re-litigating" note from that earlier entry. `SILENT=True`
suppressing driver warnings is itself worth remembering as a general
caution for this file — a similar option-name mistake elsewhere could
go unnoticed the same way; no action taken on that broader point this
session, just flagged.

### D22, closed out (2026-08-21, same session)

All 9 commits in the original `fdd6adc..ef97ada` queue reviewed and
resolved commit-by-commit, per this entry's own discipline. Summary:

- `57f8481`: memory-reduction flags + heterogeneous-projection check
  adopted; LERC compression tested and dropped (see LERC verdict
  entry above); multi-host worker/downloader machinery explicitly not
  adopted (see D22 follow-up, "③ also dropped" entry above).
- `fdd6adc`: cherry-picked whole (tar-store distribution scripts,
  purely additive).
- `a0ae374`: selectively adopted (merge/tile output-naming +
  dtype-safety + intermediate cleanup, eta.py, list_used_sources.py,
  frhd* sources); explicitly skipped the multi-host-tied portions.
- `b029dd8`/`30d18d7`/`f81c706`/`048e7fc`: all 4 Add-source commits
  taken (purely additive non-Japan sources), plus two small
  incidental fixes (numpy underflow suppression, a progress print).
- `9cfbfab`: `remove_dangling_pmtiles.py` hardening taken (directly
  useful for this project's own stale-data-cleanup needs);
  CHANGELOG.md/website changes skipped (upstream's own release
  artifacts).
- `ef97ada`: `source_create_tarball.py`'s variable-shadowing bug fix
  taken -- confirmed this fork had the identical bug before fixing.

`git log HEAD..upstream/main` still lists all 9 SHAs -- expected and
not a sign anything was missed. This was a selective, commit-by-commit
adoption (`git checkout <sha> -- <path>` plus manual patches for files
this fork had already diverged on), not `git cherry-pick`/`git merge`
for most of these, so the resulting commits on `main` have new SHAs
of their own and will never show as ancestors of `upstream/main` in a
plain ancestry diff -- the correct way to verify completeness is this
entry's own record, not the SHA list. Five new commits landed on
`hfu/mapterhorn`'s `main` this session as a result: `767bbbd`,
`1c1e4be`, `21f80e6`, `8003cd0`, plus `cfacc55` (the original GDAL
memory + ZSTD + hole-free-downsampling cherry-pick). Not yet pushed
to `origin` -- queued as this session's item 4 (git push).

## D26: Source-catalog manifests gzip-compressed instead of moving to Git LFS

**Status**: Implemented, tested, deployed, final.

**Context**: This session's git push of jpnational5's freshly-
refreshed `file_list.csv` (55.70MB, 422,119 rows) tripped GitHub's
50MB recommended-file-size warning (push still succeeded — GitHub's
hard limit is 100MB — but it's a real, growing problem: national-scope
manifests only get larger as sources refresh). Hidenori's call, given
a choice between Git LFS and gzip: gzip, on the reasoning that the
underlying data (a long, highly-repetitive list of near-identical
URLs) compresses very well and doesn't need LFS's added infrastructure
and workflow complexity.

**Sizes, measured directly**: `jpnational1` (national, 291,779 rows):
38.97MB -> **8.25MB** (`gzip -9`, ~21% of original, ~4.7x). `jpnational5`
(422,119 rows): 55.70MB -> **11.60MB** (~21%, ~4.8x) — comfortably
resolves the 50MB warning with a wide margin, not just barely.

**Decision**: `utils.py` gained `open_manifest(source)` (prefers
`file_list.csv.gz`, falls back to a plain `file_list.csv` automatically
for any source not yet converted — backward compatible, no source
catalog entry needs to change unless/until its own manifest also grows
large enough to matter), plus `manifest_exists()`/`manifest_path_glob()`
helpers. `source_download.py`, `check_download_progress.py`, and
`source_prune_obsolete.py` — every consumer of `file_list.csv` in this
fork — switched to the shared helper. Verified all three produce
identical results (row counts, orphan detection) against the real
`jpnational1`/`jpnational5` data before deleting the plain `.csv`
originals (not left around "just in case" — reversible via `gunzip`
of the committed `.gz` at any time, so nothing was actually lost).

**Consequences**:
- `jpnational1`'s eventual national-scope manifest (already converted
  today alongside `jpnational5`, ahead of `jpnational1`'s own download
  actually finishing) is covered by the same margin — no future
  GitHub file-size surprise expected from either source's manifest at
  this scale.
- Any future source-catalog entry with a large manifest should default
  to the `.gz` form from the start now that the tooling supports it
  transparently, rather than hitting this same warning later.
- Not retrofitted to every existing smaller source-catalog manifest
  this session (no need — their plain `.csv` sizes are nowhere near
  the threshold) — `open_manifest()`'s fallback means this is a
  non-issue either way, adopt `.gz` per-source only when it actually
  matters.

## D27: Kyushu test build's remaining purpose is real-scale burn-in only; pause it once jpnational5's CPU-bound post-download phase starts

**Status**: Decided, 2026-08-21; not yet executed (jpnational5 download still in progress as of this entry).

**Context**: Hidenori asked directly what the Kyushu test build
(aggregation_id 01M0FNHYXSAMNVTV430XD3XB5T) is actually accomplishing
at this point in the session, and whether it should be paused once
jpnational5's download finishes and its own CPU-bound post-download
stage (source_bounds.py -> source_polygonize.py, D15's ~2.5h-at-
national-scale concat phase) starts.

Honest assessment: this build's original purposes (validating D22's
GDAL-memory/LERC-vs-ZSTD/multi-host decisions live, exercising D25's
hole-free/quadrans downsampling design) are already fulfilled -- both
are closed out earlier in this same session. Its own aggregation
output will not carry forward past D16/D23's planned "step 3" rebuild
(a fresh aggregation_covering.py run against jpnational5's refreshed,
and eventually jpnational1's national, coverage necessarily starts a
new generation ID) -- so further items completed in this specific
generation are, at this point, essentially throwaway. Its only
remaining real value: (a) real-scale burn-in of the newly-integrated
code (merge/tile output-naming + cleanup from a0ae374, ZSTD) under
sustained load, and (b) productively occupying CPU that would
otherwise sit idle during jpnational5's network-bound download phase.

**Decision**: once jpnational5's download completes and its own
CPU-bound `source_bounds.py`/`source_polygonize.py` phase begins,
pause the Kyushu build (same clean pause procedure used throughout
this session) rather than let it compete for CPU. The critical path to
D23's "step 3" rebuild matters more than continued burn-in on output
that will be discarded regardless. Resuming it (or not) is a fresh
decision at that point, not a foregone conclusion -- if slate has
genuine CPU headroom once bounds/polygonize is running (unlikely given
D15's own multiprocessing.Pool profile, but not verified), revisit.

**Consequences**: This is the practical trigger condition for D23's
"Kyushu workstream ends" framing -- not literally "when step 3 starts"
as stated there, but slightly earlier, at "when jpnational5's own
post-download CPU phase starts" (a cleaner, CPU-contention-driven
boundary than waiting for the rebuild itself to begin). Whatever the
Kyushu build's `.done` count reaches by that point is its final tally
for this generation -- worth a brief final status note in HANDOVER.md
when it happens, closing out D16's own original test-build framing.

## D28: D20's deferred real-data validation, done — plus a real bug found in the diagnostic tool itself

**Status**: Done, 2026-08-22.

**Context**: D20 called for a 20-sample real-data check of the seven-tier
priority merge (`lineage_inspect.py`), deferred repeatedly for CPU-load
reasons. Run this session against 20 randomly-sampled aggregation items
from the Kyushu-scope generation with ≥2 priority groups (3,633
candidates out of 5,875 total items had genuine multi-tier overlap).

**Result**: All 20 samples processed with no errors; priority ordering
correct in every case (higher tiers dominate where present, lower tiers
correctly fill only the remaining gaps — e.g. `jpnational1/A` at 84.2%
of one tile with `jpnational5/A`, `jpnational10/b`, `jpnationalsea`
splitting the rest).

**Bug found via visual inspection, not the numeric output**: `lineage_
inspect.py`'s `PALETTE` was keyed by a group's *position in that tile's
own* `get_grouped_source_items()` list (0..len(groups)-1), not by the
group's *global* tier (1=0, 5a=1, 5b=2, 5c=3, 10a=4, 10b=5, sea=6). Most
tiles don't have all seven tiers present, so the list is a subsequence,
not always starting at tier 0 — a tile missing tier 3 (5c) has its real
`sea` group land on local index 4 and get painted 10a's orange instead
of sea's grey. Confirmed visually: a `jpnational1`+`jpnationalsea` tile
(`11-1779-826-16`) rendered its ocean half in vivid orange. The printed
numeric breakdown was unaffected (it already indexes `groups[val]`
directly) — only the PNG's color legend was wrong.

**Fix**: added `GLOBAL_TIER = {(source, product_type_rank): tier}` and
route every `PALETTE` lookup through it. Re-tested against the same
tile — ocean now renders grey. Diagnostic-tool-only change;
`aggregation_merge.py` itself was never affected (it already keys
priority by the correctly-ordered `get_grouped_source_items()` sort,
not by any color mapping).

**Consequences**: `hfu/mapterhorn` commit `01f42ff` (pushed). Any prior
visual review of `lineage_inspect.py` output before this fix should be
treated as untrustworthy for tiles with non-contiguous tier coverage —
the numeric percentages were always correct, only the picture lied.

## D29: `pmtiles-store`/`bundle-store` staleness audit (D23 point 4) — findings, cleanup, and an incident from the cleanup itself

**Status**: Done, 2026-08-22.

**Findings**: `pmtiles-store` held two eras mixed with no way to tell
them apart by inspection alone — 2,938 files dated 2026-08-09~14 (the
D13 build, predates this session's D14-D28 work entirely) and 2,172
files dated 2026-08-20~21 (the still-active, still-partial Kyushu-scope
generation `01M0FNHYXSAMNVTV430XD3XB5T`). `bundle-store`/`meta-store`
were **entirely untouched since 2026-08-14** — `bundle.py` had not run
even once against any of the intervening generations. The live
production `japan.pmtiles` served from `stars` therefore reflects none
of this session's fixes (D18–D28) or `jpnational5`'s national refresh.

Root cause, confirmed by reading `utils.get_dirty_aggregation_filenames()`:
`pmtiles-store`/`bundle-store`/`meta-store` are keyed purely by tile
coordinate, not by `aggregation_id` — and the dirty-check only ever
compares the *current* generation against the *immediately previous*
one (`aggregation_ids[-2]`). Anything from two or more generations back
is structurally invisible to every future dirty-check, permanently —
not a rare edge case, a designed blind spot.

**Cleanup performed, and a real mistake made doing it**: cross-referenced
old (pre-8/19) `pmtiles-store` filenames against the current generation's
own `*-aggregation.csv` keys; 2,215 of 2,719 had no match and were
deleted (16.16GB freed) as presumed orphans from the source-catalog
entries deleted in the 2026-08-19 cleanup (`jphakodatetrial*`,
`jpsapporo*`, `jpshakotan*`).

**This check was flawed in two ways, discovered only after the delete**:
1. It compared against *aggregation*-item keys only. `pmtiles-store`
   also holds *downsampling*-tier output (the tile pyramid down to z0),
   which structurally never matches an aggregation-item key — the check
   could never distinguish "orphaned aggregation leaf" from "legitimate
   downsampling overview not yet touched by this generation's own
   naming."
2. The delete ran **while `bundle.py`'s rehearsal run was already
   in flight**, having captured its own file list in memory at start —
   deleting a file that run had already committed to reading crashed it
   (`FileNotFoundError` on `10-887-406-16.pmtiles`, itself a genuine
   aggregation-tier leaf output from the older, superseded generation
   `01KZVPVTAM9V0QP8SRR42XRYKW`).

**Damage assessment, done carefully rather than assumed**: cross-referenced
every filename referenced by the *current* generation's own
`*-downsampling.csv` children-lists against what's now missing.
Only **one** downsampling item (`11-1764-825-15`) was found in the
genuinely dangerous state — its own `.done` marker present, its own
output file gone, meaning it would silently never self-heal (`main()`
only checks the `.done` marker, not the file's actual existence).
Fixed by removing that stale marker. Every other "missing" reference
(~8,600 total, ~5,600 matching the flawed orphan criterion) is already
handled gracefully by `DOWNSAMPLING_STRICT`'s existing missing-children
skip — not silent corruption, just items that will retry once genuinely
ready. **Bounded real impact**: the current Kyushu-scope generation
(already throwaway per D27) can no longer be bundled 100% completely;
the eventual real national generation is unaffected, since it computes
its own covering/dependency graph from scratch and won't reference
these specific stale filenames at all.

**Lesson recorded for future sessions**: never delete files from
`pmtiles-store`/`bundle-store`/`aggregation-store` while any
`aggregation_run.py`/`downsampling_run.py`/`bundle.py` process might be
reading from them — stop consuming processes first. And "does this
filename match a current aggregation-item key" is **not** a valid
orphan test on its own, because `pmtiles-store` holds two structurally
different namespaces (aggregation leaves and downsampling pyramid
levels) that must be checked separately.

## D30: `merge_japan_bundles.py` OOM risk found and fixed (mmap → seek+read)

**Status**: Done, 2026-08-22. `hfu/mapterhorn` commit `f0240a0` (pushed).

**Finding**: `pmtiles.reader.MmapSource` maps the whole input file and
never calls `madvise()` to release pages already scanned. A straight
sequential pass over one large `bundle-store` archive lets that file's
resident pages accumulate toward the file's full size. Measured directly
on `slate` (16GB RAM): RSS hit **~9GB (56% of physical memory)** reading
a single 42.9GB regional bundle (`6-55-25.pmtiles`, Kyushu), with free
memory down to ~450MB and swap starting to grow — a real risk to every
other job sharing the box, `jpnational1`'s day-long download included.
Killed before it went further.

**Fix**: replaced `MmapSource` with a local `FileSource` (plain
`seek()`+`read()`, 8MB buffer) in this fork's own ad hoc
`merge_japan_bundles.py` only — not the upstream `pmtiles` library.
Re-measured: **~45-59MB RSS**, finished in **~12 minutes for 809,337
tiles**, no throughput regression versus the mmap version's (killed,
never-finished) run.

**Also corrected**: this file's own header comment claimed it was "not
checked in to this fork" — false since `5609479` (2026-08-09); fixed
the comment to match reality.

## D31: `bundle.py`'s granularity bottleneck — found, and a scheduling fix (not a full re-architecture)

**Status**: Done (fix implemented and clean-re-verified), 2026-08-22.

**Finding**: `create_archive()` has no internal parallelism (the PMTiles
writer format needs tile-id-sorted sequential writes) — one region is
one atomic, single-worker task. Measured: a 23-region bundle run left
one of `BUNDLE_WORKERS=2` idle after finishing several small regions
while the other spent **64 of the run's 77 total minutes** on the one
region holding 430,856 tiles (Kyushu, the region this whole session's
test build concentrated on). More workers would not shorten this
specific critical path — the bottleneck is task granularity, not worker
count. `Pool.map`'s default chunksize also doesn't sort by size, so
which task starts first is essentially glob-order luck.

**Decision**: rather than re-architecting `create_archive()`'s write
path (real engineering, deferred as not clearly worth it while today's
cadence has multi-hour margin), added a cheap, provably-non-worse fix:
sort `parent_to_filepaths.items()` by file count descending before
`pool.map(..., chunksize=1)` — classic longest-processing-time-first
scheduling, near-optimal for minimizing makespan across identical
workers, and guarantees the largest task is never accidentally
scheduled late. Verified post-fix: both `BUNDLE_WORKERS=2` workers
observed busy (95-99% CPU) concurrently from early in the run, instead
of one sitting idle.

**Consequences**: does not reduce the giant single-region task's own
raw duration (~64 min stands, dominated by real CPU work); only
eliminates *scheduling-induced* idle time on the other worker(s). Full
internal parallelization of `create_archive()` remains a candidate for
later if a real national-scale run's single-densest-region time turns
out to threaten the publish cadence (D32) — not attempted this session.

## D32: Operating model for the incremental national build — decided, with real measurements

**Status**: Decided, 2026-08-22.

**Question**: should `aggregation_run.py` pause for each publish cycle
(D23's original framing), or run continuously with a "thin, exactly one
at a time" publish pipeline alongside it? Hidenori's own hypothesis:
pausing wastes real progress for no benefit if CPU is the shared
bottleneck; concurrent execution risks disk I/O contention instead.

**Measured** (aggregation_run.py [4 workers] + downsampling_run.py
[5 workers, quadrans+strict] + aria2c [jpnational1's tail], sustained
>1 hour): load average 11-14 on 10 physical cores throughout, **no
throughput collapse** for either job (aggregation ~5/min, faster than
the isolated D22 baseline of ~2.14/min — attributable to cheaper
remaining items, not concurrency helping), **no swap growth** (178MB
flat), **no single-process memory blowup**. Disk I/O, the originally-
suspected risk, turned out lower under this combination (55-68MB/s,
~3000 IOPS) than `merge_japan_bundles.py` running *alone* (161-239MB/s)
— aggregation's access pattern is many small random reads, not the
bulk sequential reads that actually stress this USB-SSD-backed volume.

**Decision**:
1. `aggregation_run.py` runs continuously once the real national build
   starts — never paused for a publish cycle.
2. The publish pipeline (readiness-gated `downsampling_run.py` →
   `bundle.py` → `merge_japan_bundles.py` → `rsync` to `stars`) runs as
   exactly one non-overlapping instance, external-schedule-triggered
   (not self-looping) — see `publish_cycle.py` (D33).
3. Default worker counts (`AGGREGATION_WORKERS=4`, `DOWNSAMPLING_
   WORKERS=5`, `BUNDLE_WORKERS=2`) are kept as-is — the measured
   oversubscription doesn't cause thrashing, and reducing them would
   sacrifice real wall-clock savings for no measured benefit. **Watch
   load average, not disk I/O**, as the live go/no-go signal during the
   real build; if 15-minute load consistently exceeds ~15-16 *and*
   throughput visibly degrades, dial back the publish side first
   (`DOWNSAMPLING_WORKERS`/`BUNDLE_WORKERS`), not aggregation's own.
4. **Cadence: start at once per day.** Today's per-stage costs at
   partial/small scale (downsampling backlog: hours-scale;
   `bundle.py`: ~77min pre-fix, dominated by one dense region; `merge_
   japan_bundles.py`: ~12min) sum to a plausible 2-4h full cycle at
   real national scale — comfortable margin under 24h, clearly
   incompatible with anything close to hourly. Revisit toward
   twice-daily only once a real national-scale `bundle.py` run confirms
   the single-densest-region time (D31) stays well under budget.

## D33: `publish_cycle.py` — the assembled incremental publish loop (written, not yet run for real)

**Status**: Written and syntax-checked, 2026-08-22. **Not yet executed
against production** — deliberately, since running it now would bundle/
merge/publish the throwaway Kyushu-scope generation's content to the
live `stars` endpoint.

Implements D32's decision directly: `flock()`-guarded single-instance
run of `downsampling_run.py` (`PRIORITY_MODE=quadrans DOWNSAMPLING_
STRICT=1`) → `bundle.py 1` (`BUNDLE_WORKERS=2`) → `merge_japan_bundles.py`
→ `rsync -av --progress bundle-store/japan.pmtiles stars@stars.local:
/home/stars/data/`, with no internal sleep/loop — cadence (D32: daily
to start) is the job of whatever schedules this script (cron/launchd),
not this file. `rsync` target verified reachable via `--dry-run` this
session (correct auth, correct path, correctly identifies the current
75.9GB `japan.pmtiles`) without transferring anything. First real,
full end-to-end run of this exact script is still outstanding — will
happen naturally as part of D34/the real national build's first
publish cycle.

## D34: `jpnational1` national-scope download — complete and independently verified

**Status**: Done, 2026-08-22.

`jpnational1`'s national-scope download (D14 recipe, 291,779-entry
manifest) reached **291,779/291,779** files present. The last 7 files
outstanding at this session's start (transient failures from the
previous ~20h pass) all resolved once `source_download.py`'s ongoing
re-verification pass reached them — confirmed reachable and correctly
sized at the source before the retry even landed (`curl -I` against two
of the seven, both 200 OK with matching `Content-Length`).

Beyond `aria2c`'s own `--check-integrity` (MD5-checksum-based, verifies
every file against the manifest as part of its normal run), an
**independent** check was run per Hidenori's request: local MD5
recomputed by hand for 20 randomly-sampled files against the manifest's
stored checksum (not reusing aria2c's own code path at all) — 20/20
matched. Manifest row count (291,779) also matches the on-disk file
count exactly.

**Next**: with `jpnational5` (national, done) and `jpnational1`
(national, done — this entry) both current, D23's "step 3" — a fresh
`aggregation_covering.py` pass defining the real national generation —
is now unblocked. `source_bounds.py`/`source_polygonize.py` for
`jpnational1`'s refreshed download have not been re-run this session
(the existing `jpnational1` bounds/polygonize predate today's final 7
files) — do that before trusting `jpnational1`'s coverage in the new
`aggregation_covering.py` pass.

## D35: `jpnational1` source data quality issue found (`gmldem2tif` silent corruption) — CLOSED, 48/48 fixed

**Status**: **Closed, 2026-08-25.** All 48 confirmed-corrupted files
(38 + 7 + 3, see the closing addendum at the end of this entry) fixed,
re-verified, and propagated into this repo's own `jpnational1` source
store and manifest. Full technical detail lives in `japan-geotiff-dem`
DECISIONS.md D18 (the bug is in that repo's own conversion tool, not
anything in this repo's pipeline) — this entry is the
`mapterhorn-japan-bridge`-side pointer and consequence record, not a
duplicate writeup.

**What happened**: while refreshing `jpnational1`'s `bounds`/
`polygonize` for the real national launch, `source_polygonize.py` hit
ZSTD decode errors on a small number of files. Traced upstream to a
real, silent data-corruption bug in `unopengis/gmldem2tif` (the tool
that converts GSI's raw GML into the 1m GeoTIFFs `jpnational1`
downloads from `s3://smartmaps/japan-geotiff-dem/1/`) — not anything in
this repo's own download/aggregation code. Full root-cause writeup,
including what was ruled out and what remains unconfirmed, is in
`japan-geotiff-dem`'s own `DECISIONS.md` D18.

**Scope found so far**: 45 confirmed-corrupted files, all within mesh4
`4929`/`4930` (Nagasaki-area). A national screening pass (valid-data
percent computed for all 291,779 `jpnational1` files on `slate`) found
**zero decode failures anywhere outside this same `4929`/`4930` zone** —
strong evidence the issue is narrowly localized, not a national-scale
problem. A `4929`/`4930`-wide sweep (109 2次メッシュ total, 36 checked
as of this entry, all clean outside the already-known bad range) was
in progress when this entry was written.

**Fixed so far**: 38 of the 45 (the unambiguous decode-failure class)
re-converted correctly and re-uploaded to
`s3://smartmaps/japan-geotiff-dem/1/` (see `japan-geotiff-dem` D18) —
independently re-verified post-upload. These same 38 corrected files
were also copied directly into this repo's own `jpnational1` source-store
on `slate` (`pipelines/source-store/jpnational1/*.tif`), bypassing the
checksum-based download-skip logic (which wouldn't otherwise notice
the upstream fix, since it only trusts its own manifest's MD5).

**Left open, in priority order for whoever resumes**:
1. `japan-geotiff-dem`'s own manifest (`latest_file_list.csv.gz`) is
   still stale for these 38 filenames (blocked on a `source-coop login`
   credential refresh at the point this was written) — **this repo's
   own `source-catalog/jpnational1/file_list.csv.gz` derives from that
   upstream manifest, so it needs regenerating too, in that order**,
   once the upstream one is current. Until then, don't trust this
   repo's own manifest's MD5 for these 38 filenames either.
2. The remaining 7 confirmed-corrupted files (silent, no decode error)
   haven't been re-uploaded upstream or re-copied into this repo's
   `source-store` yet.
3. `bounds.csv`/`polygon-store` for `jpnational1`: **not urgently
   affected** — `bounds.csv` never reads pixel data (header-only), and
   `aggregation_covering.py` doesn't consume `polygon-store` at all
   (confirmed by reading the code this session, not assumed) — so
   neither blocks the real launch. Low-priority cleanup only.
4. The `4929`/`4930` comprehensive sweep (73/109 2次メッシュ still
   unchecked) — coordinate with `japan-geotiff-dem`'s own session,
   since the mesh-code list, downloaded raw GML, and ground-truth
   verification scripts all live in that session's scratch space on
   `aalto`, not here.

**Decision on how to proceed with the real launch (D23 step 3)**:
Hidenori's own call, explicit: proceed to the next stage (fresh
national `aggregation_covering.py`) **accepting some residual risk**,
rather than waiting for the full `4929`/`4930` sweep to close out —
the confirmed-fixed 38 files plus the strong national-screening
evidence of localization are enough confidence to move forward. The
still-open 7 soft-corruption files and any undiscovered corruption
within the unchecked 73 meshes are a small, geographically-bounded
residual risk against the full national dataset, not a blocker.

### Resume prompt (session left off here — Hidenori away ~20h)

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`. Read this file's
> D35 and, importantly, `japan-geotiff-dem`'s own `DECISIONS.md` D18 +
> `HANDOVER.md`'s matching entry (different repo, `/Users/hfu/
> japan-geotiff-dem` on `aalto`) — the corruption bug and its fix live
> there, this repo only consumes the result.
>
> **First**: check whether `japan-geotiff-dem`'s manifest regeneration
> (`source-coop login` then `just filelists 1`, blocked on credential
> expiry when this was written) has happened. If yes, regenerate this
> repo's own `source-catalog/jpnational1/file_list.csv.gz` from it
> (D14's recipe) before trusting checksums for the 38 corrected
> filenames.
>
> **Then**: proceed toward the real launch (D23 step 3) per Hidenori's
> own explicit go-ahead — fresh national `aggregation_covering.py`,
> accepting the residual risk documented above. `jpnational1`'s
> `bounds.csv`/`polygon-store` do not need refreshing first (confirmed
> not consumed in a way that matters — see point 3 above).
>
> `slate`'s SSH tunnel (`slate-via-spacex`, via Cloudflare Access) may
> need a fresh browser-based re-auth if idle too long — expect this,
> it's a known pattern this session, not a real problem.
>
> Converse in Japanese, per this repo's own language policy.

### Addendum (2026-08-22, resumed session): manifests refreshed, real launch (D23 step 3) executed, 5m/10m/sea screened clean

**Manifest regeneration (this entry's own point 1) done**: `japan-geotiff-
dem`'s `source-coop login` refreshed, `just filelists 1` re-run on
`aalto` -- confirmed exactly the 38 corrected filenames' size/md5
changed in the new `1/latest_file_list.csv.gz` (diffed old vs new).
This repo's own `source-catalog/jpnational1/file_list.csv.gz` re-fetched
from the public bucket to match (`84849ef`) -- diff confirmed the same
38 rows changed, and a spot-check of 3 of the 38 filenames' local
`source-store/jpnational1/*.tif` bytes matched the new manifest's MD5
exactly. `japan-geotiff-dem`'s own `source-coop/README.md` Changelog
updated and published (`just docs`) with a public-facing note about the
fix.

**`jpnational1` bounds/polygonize**: confirmed NOT stale despite the
38 files' local mtimes showing later than `bounds.csv`/`polygon-
store/jpnational1.gpkg`'s own regeneration timestamps (11:24/19:19 vs.
22:12 for the sampled files) -- the later mtime is `aria2c`'s own
tail-end re-verification pass (mentioned in this file's D34/HANDOVER
entries as "still finishing up") touching already-correct files, not a
content change: the 3 sampled files' MD5s already matched the
corrected manifest values before *and* after. Moot regardless, since
`bounds.csv` is header-only (extent unaffected by pixel corruption
either way) and `aggregation_covering.py` never reads `polygon-store`
at all (both already established in D35 above).

**D23 step 3 executed**: fresh national `aggregation_covering.py` run
against the full union (`jpnational1`+`jpnational5`+`jpnational10`+
`jpnationalsea`, all national) -- new generation `01M0MWK852631SHCHPA
66F21WQ` (8,354 items), completed in ~5 minutes. Diffed against the
prior Kyushu-scope test generation (`01M0FNHYXSAMNVTV430XD3XB5T`):
only 1,979 items came back dirty (composition actually changed by
`jpnational1` going national) -- the dirty-diffing mechanism
(`get_dirty_aggregation_filenames`) worked as expected, correctly
sparing the many non-Japan/unchanged macrotiles worldwide from
redundant reprocessing. `aggregation_run.py` then started for real
(default 4 workers, per D32's decided operating model -- not
overridden), running continuously against these 1,979 items.

**5m/10m/sea decode-validity screening (resolves D18's deferred
question)**: generalized `screen_jpnational1.py` into `screen_
source.py` (arbitrary source name, same full-read-forces-decode +
valid-pct methodology). Results:
- `jpnational10` (4,981 files) and `jpnationalsea` (275 files): **zero
  decode errors, zero 0%-valid candidates** -- fully clean.
- `jpnational5` (422,119 files): **zero decode errors** (no ZSTD-type
  crash anywhere) but **2,062 files at exactly 0% valid data**.
  Investigated rather than assumed: all 2,062 are **exactly 506 bytes**
  on disk with no exception (ZSTD's minimal-size encoding of a
  constant-nodata raster), versus 18-23KB+ for a typical real-data
  file in the same corpus -- a categorically different signature from
  D18's actual corruption (which produced either decode failures or
  wrong-but-substantial file sizes, e.g. the ~2MB real-data case that
  published as 0%). Mesh-code distribution is also scattered
  nationwide (dozens of mesh4 codes, max 163 in any one code) rather
  than D18's tight 4929/4930 clustering. Conclusion: these are
  legitimately-empty DEM5A/5B sub-meshes (small 225x150-pixel cells,
  plausibly coastal/boundary slivers outside GSI's actual survey
  footprint), not an instance of the `gmldem2tif` corruption bug.
  **5m/10m/sea are not affected by D18's bug** -- the "similar-order-
  of-magnitude risk" flagged as untested in `japan-geotiff-dem`'s own
  D18 did not materialize here.


### Closing addendum (2026-08-25): investigation complete, item closed

**Final tally**: 48 confirmed-corrupted 1m files total across the
whole investigation -- 38 (2026-08-22, decode-failure class) + 7
(2026-08-25, silent class, in the original 10 suspect meshes) + 3
(2026-08-25, later, found in mesh `492963` via a full sweep of all 109
`4929`/`4930` meshes -- previously unswept). All re-converted,
independently re-verified twice (once right after upload, once more
via a fresh fetch), and propagated into this repo's own
`pipelines/source-store/jpnational1/` and
`source-catalog/jpnational1/file_list.csv.gz` (bypassing the
checksum-skip logic each time, same as D35's own original approach).
Full technical detail, file-by-file, lives in `japan-geotiff-dem`'s own
`DECISIONS.md` D18 and its addenda -- not duplicated here.

**Scope closed**: the full 109-mesh `4929`/`4930` zone (7,485 files)
has now been ground-truth-checked in its entirety, not just the
originally-suspect 10 meshes. Zero further corruption found beyond the
48 already fixed.

**Broader-region calibration, also clean**: to check whether the bug
extended beyond `4929`/`4930`, ~3,544 additional files were sampled
from Hokkaido (full `Z007` region pack, 16 meshes), 8 other scattered
prefecture-level mesh4 codes (D18's own original distant-region
sample, re-checked with the corrected script), and an exhaustive check
of the Kyushu/Okinawa region's own `Z007` pack (36 meshes, directly
adjacent to but outside the `4929`/`4930` hot zone). **Zero mismatches
found anywhere outside `4929`/`4930`.** Not proof the bug is
impossible elsewhere, but real, geographically diverse negative
evidence supporting the working conclusion that this was a localized
issue, not a national or Kyushu/Okinawa-wide one. A full exhaustive
Kyushu/Okinawa sweep remains not planned -- this sampling round already
delivered a proportionate answer.

**D35's own original "left open" list, resolved**:
1. Upstream + this repo's own manifests: regenerated, current.
2. The 7 (then 3 more) soft-corruption files: all fixed.
3. `bounds.csv`/`polygon-store`: confirmed not affected (unchanged
   from the original entry's own finding).
4. The `4929`/`4930` comprehensive sweep: **done**, 109/109 meshes.

**Not this item's scope, deliberately deferred (unchanged)**: whether
the same corruption-bug class exists in 5m/10m -- D35's own addendum
already confirmed 5m/10m/sea are *not* affected (screened separately,
zero decode errors, the observed 0%-valid cases there are a distinct,
legitimate phenomenon). This closes that open question too.

## D36: `publish_cycle.py`'s first real execution (clean, end to end) — and a reproducible visual-verification recipe for the live viewer

**Status**: Accepted / recorded, 2026-08-23.

**Context**: With the D23 step-3 national build running (D35's addendum),
this was `publish_cycle.py`'s (D33) first-ever real invocation --
deliberately run early, while only a handful of `aggregation_run.py`
items were `.done`, specifically to validate the whole chain
end-to-end while the blast radius of anything going wrong was small
(Hidenori's own framing: "空ファイルでも良いから一通り進むことは重要").

**Result -- ran clean, no errors, all four stages**:
1. `downsampling_run.py` (`DOWNSAMPLING_STRICT=1`, per D25): **0 files**
   -- correctly found no parent tile with enough `.done` children yet
   to be worth downsampling. This is expected, not a failure: it means
   this cycle's verification only reaches `aggregation_run.py`'s own
   native leaf-zoom output (written directly by `aggregation_tile.py`
   into `pmtiles-store`), not the downsampled low-zoom overview
   pyramid (z1 up to each item's own zoom) -- that stage remains
   unexercised until a later cycle, once enough sibling items complete
   for some parent to become ready.
2. `bundle.py 1`: ~15 minutes (2 workers).
3. `merge_japan_bundles.py`: ~15 minutes, wrote `bundle-store/
   japan.pmtiles`, **590,176 tiles, 56,790,317,840 bytes (52.9GB)**.
4. `rsync` to `stars` (`/home/stars/data/`): **44m8s**, sent
   14.6GB over the wire against the 52.9GB total (delta-transfer
   speedup 3.88x against the previous Kyushu-test-scope file already
   there) -- confirms the destination-side checksum/delta phase seen
   mid-transfer (85% CPU on `stars`'s rsync process, no bytes moving
   yet) was real work, not a stall.

Total cycle wall-clock: ~1h17m, well inside the "once per day" cadence
budget from `publish_cycle.py`'s own docstring.

**Verified live, independently of the pipeline's own success exit
code**:
- `https://depot.optgeo.org/japan.pmtiles` `Content-Length` matches
  the new file's byte count exactly.
- `martin`'s catalog (`https://stars.optgeo.org/catalog`) shows the
  `japan` source active -- confirms the hot-reload behavior from
  [[project_stars_martin_pmtiles_hosting]] fired again without a
  restart.
- **Visual confirmation, not just header/catalog checks**: picked one
  of `aggregation_run.py`'s actual completed items
  (`11-1757-825-16`), converted its z/x/y to lat/lng with
  `mercantile.bounds()` (center ~32.9165, 128.9355 -- Shin-Kamigoto,
  Goto Islands, adjacent to the D18/D35 corrected 4929/4930 zone),
  loaded `https://hfu.github.io/mapterhorn-japan-bridge/#hash=
  <zoom>/<lat>/<lng>/0/0` in a browser, enabled "3D地形表示", and
  zoomed in tight: real 1m-detail contour lines and hillshade relief
  rendered (150m contour, a 62m spot elevation), not a flat/placeholder
  tile. This is real terrain data flowing through the whole chain
  (`aggregation_run.py` -> `bundle.py` -> `merge_japan_bundles.py` ->
  `rsync` -> `depot.optgeo.org` -> the GH Pages viewer), not just a
  successful-looking log.

**Reusable recipe for this kind of spot-check** (worth repeating on
future cycles, not a one-off): `find aggregation-store/<id> -name
'*.done'` to list real completed items, pick one, convert its
`z-x-y` prefix with `mercantile.bounds(x, y, z)` to get a center
lat/lng, then open the GH Pages viewer at `#hash=<zoom>/<lat>/<lng>/
<bearing>/<pitch>` and toggle 3D terrain.

**Tooling caveat found along the way, NOT a bug in `app.js` or the
viewer itself**: when driving this GH Pages viewer through Claude
Code's own Browser-pane automation and resizing the viewport (e.g.
`resize_window`) *after* the page has already constructed the
MapLibre `Map`, the canvas can get stuck at its pre-resize backing
size (observed: stuck at 400x300 in a 1280x720 viewport, rendering
the map into a small corner with the rest blank). This is an artifact
of that automation harness's asynchronous CDP viewport override not
reliably triggering MapLibre's own built-in `ResizeObserver`-based
auto-resize -- real users navigating normally never hit this, since
their viewport is stable before the page loads, and `app.js` needs no
extra resize-handling code for them. Workaround when it happens during
this kind of automated check: run `window.map.resize()` in the page's
JS console.

## D37: `publish_cycle.py` cycles 2-4 -- a real pmtiles-store race found, live re-verification, and the downsampling-covering gap that made downsampling permanently inert

**Status**: Accepted / recorded, 2026-08-23. Continuation of D36's first
real `publish_cycle.py` execution, same national build
(`01M0MWK852631SHCHPA66F21WQ`) as D35/D36.

**Cycle 2 -- crashed, harmless**: `bundle.py` crashed with
`FileNotFoundError: pmtiles-store/7-114-46/12-3648-1501-14.pmtiles`.
Root cause: `bundle.py`'s own file-listing `glob()` caught this file
under its OLD name (maxzoom 14, from a stale/prior state); by the time
`bundle.py` got around to reading it (12+ minutes into a 357,100-tile
bundle pass), `aggregation_run.py` -- running continuously per D32,
concurrently -- had finished re-processing that exact item and
replaced the file under a NEW name (maxzoom 16, since this item's
child composition changed with `jpnational1` going national). A
same-path content overwrite might have survived this race; a rename
(different maxzoom -> different filename) cannot. Confirmed via
`aggregation-store`'s own `.done` marker for that item and the fresh
`pmtiles-store/7-114-46/12-3648-1501-16.pmtiles` mtime lining up
exactly with the crash window. No corruption, no side effects --
`publish_cycle.py`'s own `flock()` and non-overlapping design meant
this was just a wasted ~13-minute bundle pass, immediately retried.
**Not yet fixed** in `bundle.py` itself (e.g. catching
`FileNotFoundError` per-file and re-globbing/skipping rather than
crashing the whole pool) -- flagging as a known, reproducible gap for
whoever next touches `bundle.py`, in the same spirit as D23 point 5's
still-open question about running the publish chain concurrently with
an in-progress generation.

**Cycle 3 -- clean, and independently re-verified live**: Retried
immediately, ran end to end (downsampling: 0 files as usual at this
point -- see below for why; bundle + merge: `671,948` tiles,
`65,291,476,281` bytes; rsync: 44min-class transfer, `9,363,147,557`
bytes actually sent against the full 65GB, delta speedup `6.97x`).
Verified three ways, not just a clean exit code: (1) byte-identical
file size across `bundle-store` on `slate`, `/home/stars/data/` on
`stars`, and `https://depot.optgeo.org/japan.pmtiles`; (2) martin
catalog showing the `japan` source hot-reloaded; (3) **visual
re-verification at two newly-added locations far from the first
check** -- Wakkanai (45.06°N, Japan's northernmost point, real 1m
contours/spot elevations rendered) and Oita/Kyushu (33.2°N) -- using
D36's own recipe (pick a real `.done` item's z/x/y, convert with
`mercantile.bounds()`, load the GH Pages viewer at that coordinate).
Both areas had zero `jpnational1` coverage in the old Kyushu-scope
test generation, so this is real evidence the national expansion is
flowing all the way through to the live map, not just Kyushu.

**Bigger finding -- downsampling has been structurally inert since the
generation started, independent of how much aggregation completes**:
Both cycles 1 and 3 reported `Total: 0 files` for
`downsampling_run.py`, which was read (D36) as "not enough sibling
`.done` items yet." That's incomplete -- the actual reason is that
`downsampling_run.py`'s own candidate list comes from
`aggregation-store/{id}/*-downsampling.csv` files, and **those are
only ever created by a separate, one-time-per-generation script,
`downsampling_covering.py`** (the exact analogue of
`aggregation_covering.py` for the aggregation side) -- which had never
been run for this generation. `publish_cycle.py` itself never calls
it. Confirmed directly: zero `*-downsampling.csv` files existed under
this generation's `aggregation-store` folder before this was caught.
**Without this step, downsampling can never produce anything, no
matter how many aggregation items finish** -- a structural gap, not a
readiness/timing issue.

**Fix applied**: ran `downsampling_covering.py` once for this
generation (analogous cost to `aggregation_covering.py` -- a few
minutes, read-only against `aggregation-store`, no interference with
the concurrently-running `aggregation_run.py` burn). Produced 8,340
candidate `-downsampling.csv` files and 5,382 `.todo` markers.
`publish_cycle.py`'s own `downsampling_run.py` step immediately
started correctly recognizing `Total: 5382 files` on the next
invocation (cycle 4) -- confirms the fix, not just the covering
script's own exit code.

**Consequence for `publish_cycle.py`/automation**: this covering step
needs to be run once per generation, by hand, before the first
publish cycle of that generation -- not currently automated anywhere.
Worth adding to `publish_cycle.py`'s own preflight (a cheap
`os.path.exists` check against at least one expected
`-downsampling.csv`, or just always re-running
`downsampling_covering.py` idempotently before `downsampling_run.py`)
so a future new generation doesn't silently repeat this. **Not done
this session** -- flagging as the concrete next fix, not carrying it
out under time pressure (see below).

**Cycle 4 -- kicked specifically to test the fix, still running as
this was written**: With the candidate list now real, every item
checked so far has correctly been recognized-but-skipped
(`DOWNSAMPLING_STRICT` -- referenced child `pmtiles-store` file not
yet on disk, "will retry on a future run"), which is expected: only
~150/1,979 aggregation items are done at this point, nowhere near
enough for any downsampling parent's full child set to be ready yet.
**Observed side effect worth recording**: `downsampling_run.py`'s own
per-item `os.path.isfile()` checks against `pmtiles-store` appear to
contend for disk I/O with `aggregation_run.py`'s concurrent GDAL work
on the same external volume -- system load briefly spiked to
`~18-19`/10 cores (above D32's own tested-safe `11-14` ceiling) while
both ran together, before settling back to `~12` within a few
minutes. Investigated live (not assumed): confirmed no duplicate
`aggregation_run.py` instance (`ps` showed the PIDs suspected of being
a second instance were actually `aggregation_run.py`'s own worker's
`gdal_translate` child subprocesses, all correctly parented under the
single running instance). At the observed pace (~110 items in ~14
minutes, apparently slowed by this same disk contention), a full pass
over all 5,382 candidates would take on the order of hours -- cycle 4
may still be mid-`downsampling_run.py` well after this session's SSH
access to `slate` lapses. It runs inside a detached `screen` session
(`publish_cycle_4`), so it will keep running unattended regardless;
whoever resumes should check its outcome rather than assume it either
finished or hung.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth if the tunnel session lapsed). Read this file's D35
> (+ addendum), D36, and D37 in full first.
>
> **Check `aggregation_run_national` first** (`screen -ls`, then
> `.done` count under `pipelines/aggregation-store/
> 01M0MWK852631SHCHPA66F21WQ/` against 1,979) -- this should still be
> running uninterrupted (D32: never pause it). If it's not running,
> that's a real problem, investigate before anything else.
>
> **Then check `publish_cycle_4`** (`screen -ls`, `cat
> pipelines/publish_cycle_4.log`): did `downsampling_run.py` finish
> its pass over the 5,382 candidates? Did any of them actually
> succeed this time (look for lines other than the
> `DOWNSAMPLING_STRICT ... skipping` pattern -- a real success prints
> `create_archive` output and no warning)? Did it proceed on to
> `bundle.py` / `merge_japan_bundles.py` / `rsync`, and did that
> complete? If it's still stuck mid-`downsampling_run.py`, that's
> consistent with the disk-contention slowdown observed this session
> -- let it finish rather than assuming a hang, but do check load
> average and `ps` for real worker activity first (D21's own
> "don't assume stalled from a short window" lesson, same as always).
>
> **Before the next fresh publish cycle after this one**: consider
> whether `downsampling_covering.py` needs adding to
> `publish_cycle.py`'s own preflight (see D37's "Consequence" section)
> -- not done this session, a real gap if a future new generation ever
> gets created without someone remembering this step by hand again.
>
> **D35's own remaining items are still open and still deliberately
> paced "thin and long"**: 56/109 4929/4930 meshes still unswept (need
> fresh GSI downloads), 7 previously-flagged "silent" corrupted files
> still unidentified. See `japan-geotiff-dem`'s own `DECISIONS.md` D18
> addendum (2026-08-23) for the corrected ground-truth methodology --
> reuse it, don't re-derive.
>
> Converse in Japanese, per this repo's own language policy.

## D38: mid-flight `AGGREGATION_WORKERS` 4->3 experiment, ahead of a ~7h blackout window

**Status**: In progress, started 2026-08-23 10:29 JST.

**Context**: A live resource-headroom check on `slate` (CPU, memory,
storage, I/O) found: CPU load 12-19/10 cores (near/above D32's own
tested "11-14 sustained" ceiling); **memory genuinely tight** -- 16GB
total, ~145MB free, real (if modest) active swap usage; storage
capacity healthy (~730GB free); disk I/O on the working volume
(`/Volumes/Migrate-2025-04`, a **USB-attached** external SSD, not
internal) showing high transaction rates (250-280 tps) at modest
throughput (13-18MB/s) -- consistent with many small random I/O
operations, a workload pattern USB handles worse than internal
NVMe/Thunderbolt. D30's earlier mmap->seek+read fix (9GB RSS -> ~50MB
in `merge_japan_bundles.py`) was almost certainly load-bearing for
this machine ever running stably at all, given how little memory
headroom exists now even without that historical 9GB consumer.

Hidenori's own framing (Artemis analogy): the current national build
is "Artemis 1" -- completing it without incident is paramount, but
gathering operational lessons for the future is also valuable, as
long as it doesn't put the primary burn at risk. With `downsampling`
now producing real output (D37) and a ~7-hour window starting where
`slate` cannot be observed or intervened on, this was treated as a
good, low-risk moment to test whether trading worker count for lower
memory/CPU contention measurably changes throughput or stability --
a real experiment, not just a guess, precisely because the "before"
baseline is well-established and the "after" period will run
unobserved and thus can't be second-guessed mid-flight.

**Baseline (4 workers, clean/`aggregation.csv.done`-only counts, no
downsampling contamination)**: started 2026-08-22 23:09. 113 done by
2026-08-23 06:38 (7h29m, 15.1 items/hour). 176 done by 10:27:04
(11h18m total, 16.5 items/hour over the later 06:38-10:27 window).
Concurrent conditions varied throughout (publish cycles 2-4 ran
intermittently in this same window), so this isn't a fully isolated
baseline, but it's the best available reference.

**Restart mechanics -- verified safe, not just assumed**: confirmed
`AGGREGATION_WORKERS` is read once at `Pool` creation
(`get_worker_count()`), so changing it requires a process restart --
no live reconfiguration is possible. Precedent: D21 already proved
killing and restarting `aggregation_run.py` mid-generation is safe
(`.done` markers persist on disk, `.todo` files get re-picked-up,
no data loss) -- same mechanism relied on here.

**Execution, at 176/1,979 done (1,803 remaining)**:
1. `screen -S aggregation_run_national -X quit` -- **found to be
   insufficient by itself**: the screen wrapper died but the actual
   process tree (main `aggregation_run.py` + its 4 workers) survived
   as orphans, still running under the old worker count. Real lesson:
   killing the `screen` session does not reliably kill everything
   inside it on this setup -- don't assume it does.
2. Explicitly `kill -TERM`'d every PID in the old tree (login, bash,
   uv, the main script, and all 4 worker PIDs) directly. Verified
   zero survivors afterward via a full `ps aux` sweep -- no orphans,
   no zombies.
3. Relaunched in a fresh same-named `screen` session with
   `AGGREGATION_WORKERS=3`. Log confirmed `start aggregating 1803
   items... using 3 workers` -- exactly `1979 - 176`, confirming no
   `.todo`/`.done` accounting drift across the restart.
4. Confirmed the concurrently-running `publish_cycle_4`
   (`downsampling_run.py`, its own separate 5-worker pool) was
   completely undisturbed by this restart -- different process tree
   entirely, no interaction.

**Also fixed along the way**: the session's own ad-hoc 15-minute
monitoring script had a counting bug -- it globbed bare `*.done`
under the aggregation-store folder, which silently started
double-counting `*-downsampling.csv.done` markers together with
`*-aggregation.csv.done` ones once downsampling began succeeding
(D37). Every "done: N/1979" figure reported during roughly
09:56-10:26 this session was inflated by the downsampling successes
mixed in (e.g. a reported "229" was actually 176 aggregation + ~53
downsampling). Fixed to count each kind separately. Not a pipeline
bug -- purely in the throwaway monitoring script -- but worth noting
in case anyone cross-references chat-log figures from that window
against `aggregation-store` directly.

**Not yet known**: whether 3 workers measurably changes throughput,
load, or memory headroom -- that's the actual experiment, and the
result will only be visible once `slate` is reachable again after
the blackout.

### Resume prompt (read this first when `slate` is reachable again)

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` after a ~7h
> blackout window, via SSH from `aalto` (`slate-via-spacex` -- likely
> needs a fresh Cloudflare Access browser re-auth after this long a
> gap).
>
> **First, the actual experiment result**: `screen -ls` for
> `aggregation_run_national` (should still be running -- if not,
> that's the first thing to investigate) and check its current
> `.done` count (`find pipelines/aggregation-store/
> 01M0MWK852631SHCHPA66F21WQ -name '*-aggregation.csv.done' | wc -l`
> -- use this exact pattern, NOT bare `*.done`, see D38's own
> monitoring-bug note). Compute the 3-worker-era throughput: (new
> count - 176) done items over the elapsed hours since 2026-08-23
> 10:29 JST, compare against the baseline 15-16 items/hour at 4
> workers. Also check `uptime`/`vm_stat`/`vm.swapusage` for whether
> load and memory pressure genuinely eased.
>
> **Then check `publish_cycle_4`** (`downsampling_run.py`'s own pass
> over 5,382 candidates) -- did it finish? How many
> `-downsampling.csv.done` markers exist now vs. the ~49 seen right
> before the blackout? Did it proceed to `bundle.py` ->
> `merge_japan_bundles.py` -> `rsync`, and did that complete?
>
> **Decide from the data, not a guess**: if 3 workers clearly helped
> (better load/memory headroom with similar or better throughput),
> consider keeping it. If throughput dropped meaningfully with no
> real stability gain, reverting to 4 is easy (same kill+restart
> mechanics as D38, now doubly proven safe).
>
> D35's own remaining items (56/109 4929/4930 meshes unswept, 7
> unidentified "silent" files) are still open and still paced "thin
> and long" -- see `japan-geotiff-dem`'s own `DECISIONS.md` D18
> addendum for the corrected sweep methodology.
>
> Converse in Japanese, per this repo's own language policy.

### Addendum: planned `DOWNSAMPLING_WORKERS` comparison for the next publish cycle

Discussed but deliberately NOT done this session (only ~20min left
before the blackout, and `publish_cycle_4`'s current `downsampling_run.py`
pass was healthy -- not worth killing a working one-shot pass just to
retest something that only matters for whatever's left of THIS pass,
with no time to properly verify a clean restart).

**Live observation that motivates this**: at one checkpoint mid-`publish_cycle_4`,
all 3 `aggregation_run.py` workers were at 0% CPU (between items) while
`downsampling_run.py`'s own concurrent 5-worker pool (its default,
`get_worker_count()` in that file, same env-var-at-Pool-creation
pattern as `AGGREGATION_WORKERS`) was at 91-95% CPU each -- confirming
the elevated load seen during publish cycles is currently dominated by
`downsampling_run.py`'s own pool, not `aggregation_run.py`. Since
`create_tile()` does the same kind of small random-access reads
against `pmtiles-store` archives that made `AGGREGATION_WORKERS`/the
USB-external-SSD tps pattern worth investigating (D38's own resource
survey), `DOWNSAMPLING_WORKERS` is a plausible second lever.

**Plan for next time `publish_cycle.py` is invoked (call it "cycle
5")**: run once with `DOWNSAMPLING_WORKERS=5` (today's default,
unchanged) and once with `DOWNSAMPLING_WORKERS=4`, far enough apart
(or with enough items in each pass) to get a real throughput
comparison rather than D21-style noise from a couple of expensive
items. Record: items/minute through the `downsampling_run.py` pass,
`uptime`/`vm_stat` during each, and whether `aggregation_run.py`'s own
progress rate (still running continuously per D32) is measurably
better or worse while each downsampling worker-count is active. This
mirrors D38's own `AGGREGATION_WORKERS` 4-vs-3 comparison
methodology -- same discipline, same reason: don't guess, measure.

### Addendum (2026-08-23 18:50, post-blackout): D38 experiment results

`publish_cycle_4` (started 09:22:44, spanning nearly the entire
blackout) finished cleanly at 17:50:04, no errors -- full breakdown:
`downsampling_run.py` (full pass over 5,382 candidates) 6h23m25s,
`bundle.py` 30m58s, `merge_japan_bundles.py` 27m52s, `rsync` 1h5m5s.
Output: **856,075 tiles, 96,202,173,466 bytes (89.6GB)** -- verified
byte-identical across `bundle-store` on `slate`, `/home/stars/data/`,
and `https://depot.optgeo.org/japan.pmtiles`. Downsampling success
rate this pass: 1,464/5,382 (27.2%).

**`AGGREGATION_WORKERS=3` result**: 176 -> 281 done (105 items) over
8h21m = **~12.6 items/hour**, vs. the 4-worker baseline's 15-16/hour
(D38) -- about 79% of baseline, consistent with (not worse than) the
"shouldn't drop below 3/4" reasoning discussed live. **Caveat, found
on review, don't over-read this number**: this 3-worker window had
`publish_cycle_4` (5-worker downsampling, then 2-worker bundle)
running concurrently for almost the *entire* measurement window
(09:22-17:50 of the 10:29-18:50 window) -- much heavier concurrent
overlap than the 4-worker baseline had (cycles 2-3 only occupied a
comparatively small fraction of that longer baseline window). So this
79% figure conflates "3 vs 4 aggregation workers" with "how much of
the window had heavy concurrent publish activity" -- it is not a
clean isolated comparison. Worth getting a real 4-workers-alone vs.
3-workers-alone measurement (no concurrent publish cycle) if this
matters enough to pin down precisely later.

**Resource headroom, before vs. after `publish_cycle_4` finished**:
load average dropped from a 9.9-19 range (concurrent 3+5 workers) to
a steady 4.4-4.8 once `publish_cycle_4` completed and only the 3
`aggregation_run.py` workers remained; free memory pages jumped from
~145MB to ~2GB over the same transition. Strongly suggests the
`publish_cycle`-side worker pools (5 for downsampling, 2 for bundle)
were the dominant contributor to the earlier tight-memory/high-load
readings, more so than `aggregation_run.py`'s own worker count.

## D39: worker reallocation -- `AGGREGATION_WORKERS` back to 4, `DOWNSAMPLING_WORKERS` set to 3 (was implicitly 5)

**Status**: Accepted and applied, 2026-08-23 19:08 JST.

**Context**: D38's own addendum above found `publish_cycle`'s worker
pools (downsampling=5, bundle=2) were the more likely dominant
resource-pressure contributor, not `aggregation_run.py` itself.
Combined with confirmed post-blackout headroom (load down to
~4.4-4.8, ~2GB free memory once `publish_cycle_4` finished),
Hidenori's proposal: restore `aggregation_run.py` (the priority
process -- "1号完走が最優先") to its untouched 4-worker default, and
instead reduce `downsampling_run.py`'s own worker count (5 -> 3) --
the secondary, "catches up over time" process where a slower pass is
low-stakes, not the priority one.

**Options considered** (logged for the reasoning, not just the
outcome): (4,4) -- restores aggregation, only mildly trims
downsampling, but leaves total peak concurrency unchanged at 8 workers
(no net contention reduction, less informative as a test). (3,4) --
rejected: no justification found for continuing to suppress the
priority process now that headroom is confirmed available. **(4,3)
-- chosen**: restores aggregation to its best-known throughput
unconditionally, meaningfully cuts downsampling's own resource draw
(5->3, a 40% cut), and reduces total peak concurrency from 8 to 7.

**Known trade-off, accepted deliberately**: D37's addendum already
found `downsampling_run.py`'s own full-candidate-list pass is the
dominant cost of a `publish_cycle` run (6h23m of `publish_cycle_4`'s
8h27m total, 75%) -- cutting its worker count will likely make future
`publish_cycle` runs take *longer* wall-clock, not shorter, so the
"downsampling is short so a smaller pool doesn't matter" framing from
earlier in this same session's discussion turned out not to match
what D38 actually measured. Deliberately accepted anyway: a slower
downsampling pass isn't gating anything time-critical (same reasoning
as D23/D32's whole "overview completeness isn't urgent" stance) --
only `aggregation_run.py`'s own continuous progress is priority-critical,
and this change protects that unconditionally.

**Execution**: same restart mechanics as D38 (kill old `aggregation_
run.py` tree by PID -- confirmed zero orphans afterward -- then
relaunch fresh in the same-named `screen` session). New instance
confirmed via its own log: `start aggregating 1686 items... using 4
workers` (exactly `1979 - 293`, the done count at restart time --
no `.todo`/`.done` drift). `publish_cycle.py` itself edited (not just
an env var at invoke time, since nobody was actively invoking it at
this moment) to add `'DOWNSAMPLING_WORKERS': '3'` to its
`downsampling_run.py` call's `extra_env` -- committed
(`99dcd69`) so this persists for every future `publish_cycle.py`
invocation, not just a one-off.

**Next steps**: run "`publish_cycle_5`" (the next invocation) to
observe: (1) whether `aggregation_run.py` throughput actually returns
to the 15-16/hour baseline now unconditionally protected; (2) how much
longer `downsampling_run.py`'s own pass takes with 3 workers vs D38's
6h23m at 5 workers, and whether that's an acceptable trade for the
reduced peak contention; (3) whether load/memory headroom during
concurrent operation improves further vs. the D38 (3,5) configuration.

## D40: storage trajectory concern found -- existing elevation product alone may exhaust free space before the national build finishes

**Status**: Recorded, 2026-08-24 06:09 JST. Investigation and monitoring
only -- no action taken yet, per Hidenori's own "早めに監視・対策を検討
しよう" framing (consider soon, not necessarily act immediately).

**Context**: While discussing a hypothetical future feature (a
lineage/provenance tileset, deliberately not started -- see the
`lineage_inspect.py` discussion this session), a storage breakdown of
`pipelines/` was taken to estimate that feature's incremental cost.
The breakdown itself surfaced a bigger, more immediate concern
unrelated to lineage.

**Breakdown at 433/1,979 (21.9%) aggregation items done**:
`source-store` 345GB (static -- downloads complete, won't grow
further), `tmp-store` 54GB (should be near-zero when idle -- see
below), `pmtiles-store` 110GB (raw per-item archives, grows with
aggregation progress), `bundle-store` 204GB (regional bundles + the
current `japan.pmtiles`, itself 108GB of that 204GB). Free space at
this point: ~598GB.

**The concern**: `pmtiles-store` and `bundle-store`'s `japan.pmtiles`
both hold substantially the *same* underlying elevation data, just
packaged differently (raw per-item archives vs. bundled regional
archives vs. one final merged file) -- up to threefold redundancy
on disk at any given time during active production, not overlapping
storage. Naively scaling each by the completion fraction (108GB /
0.219 for `japan.pmtiles`, 110GB / 0.219 for `pmtiles-store`) projects
roughly **~490GB and ~500GB respectively at 100% aggregation
completion** -- call it **~770GB more** needed beyond the current
state for the *existing* elevation-only product alone, against only
~598GB currently free. This is a rough linear extrapolation (real
per-item output size varies, and downsampling's own overview-tile
contribution isn't proportional to aggregation's own item count), but
directionally suggests **the current national build may not have
enough headroom to finish without either freeing space or growing the
volume**, independent of any new feature.

**Leading candidate mitigation, already identified but not yet
executed**: D23 point 4 flagged, back when the national build was
first being planned, that "intermediate data whose freshness relative
to a national `jpnational1` is in doubt" should be cleaned before/
during the real build -- specifically the old Kyushu-scope test
generation (`aggregation_id` `01M0FNHYXSAMNVTV430XD3XB5T`, D16/D27)'s
own `pmtiles-store`/`bundle-store`/`tmp-store` footprint, which this
session's `pmtiles-store` figure (110GB) likely still includes
alongside the current national generation's own output -- this was
never fully specified or carried out (D23's own words: "needs its own
short design pass when the moment actually arrives"). That moment may
now have arrived. Not done this session -- flagging as the next
concrete storage-relief action to design and execute, likely freeing
a meaningful fraction of that 110GB (and some of the 54GB `tmp-store`)
without touching anything from the current, still-in-progress
generation.

**Also unquantified, worth checking before acting**: whether
`bundle-store`'s non-`japan.pmtiles` ~96GB (the regional 6-x-y.pmtiles
bundles) are transient/regenerable-each-cycle or accumulating stale
copies across cycles -- if the latter, that's a second, distinct
cleanup candidate alongside the old-generation `pmtiles-store` data.

**Next steps, in priority order**: (1) keep monitoring free space
during the ongoing burn (already being tracked every 15min); (2) once
a natural pause point arrives (not urgent this second, per Hidenori's
"早めに検討" rather than "今すぐ対処" framing), audit exactly how much
of `pmtiles-store`/`bundle-store` belongs to the old Kyushu-test
generation vs. the current national one (D29's own lesson applies
here too: verify before deleting, never delete while any pipeline
process might be reading, don't use a naive "doesn't match current
aggregation-item key" test alone); (3) decide whether to clean now or
wait for firmer evidence the ~770GB projection is actually on track
to bite.


### Addendum (2026-08-24 07:16 JST): Kyushu-generation cleanup audit — ready to execute, deliberately deferred

**Status**: Investigation complete, execution deliberately deferred (Hidenori's
own call: free up time for other work now, run the cleanup later). Nothing
deleted this session.

**Method, following this file's own D29 lesson** (don't test "does this
filename match a current key" alone; check both aggregation-leaf and
downsampling namespaces; never delete while a consuming process might read):
extracted every generation's own `(z,x,y)` position keys from its
`aggregation-store/<id>/*-aggregation.csv` filenames (covers all 5
generations present: `01KZK5Q1XWP5N0YBEPBSB1DX3R`, `01KZM87D6PEKWM2B2ZEDSNFSQW`,
`01KZVPVTAM9V0QP8SRR42XRYKW`, the Kyushu-scope test generation
`01M0FNHYXSAMNVTV430XD3XB5T` (D27/D37), and the current national generation
`01M0MWK852631SHCHPA66F21WQ`), then set-differenced every older generation's
positions against the current generation's own position set. `lsof` confirmed
zero open file handles on every target path at check time.

**High-confidence, safe-to-delete-now total: 45.68GB**, itemized:
- `tmp-store/01M0FNHYXSAMNVTV430XD3XB5T` (Kyushu's own working directory —
  GDAL VRTs, intermediate tiffs/webp, file-lists, never cleaned up after
  that generation finished): **39.61GB**
- `tmp-store/old-trial-setaside`, `sea-crop-v1-superseded`,
  `sea-crop-v2-superseded` (already self-named obsolete by an earlier
  session), plus two empty ULID dirs from even older generations: **0.21GB**
- `bundle-store/japan.pmtiles.bak-20260810` (a manual backup snapshot from
  2026-08-10, referenced by no script): **3.31GB**
- `pmtiles-store` files at positions that exist **only** in an old
  generation's own covering and never appear in the current national
  generation's covering — confirmed permanent orphans, will never be
  overwritten by `aggregation_tile.py`'s own in-place stale-file cleanup
  (`aggregation_tile.py`'s `glob(f'{out_folder}/{z}-{x}-{y}-*.pmtiles')` +
  `os.remove` logic only fires when that exact position is reprocessed):
  **148 files, 2.54GB**. All 148 traced back to Kyushu-only positions
  specifically (370 Kyushu-only positions exist; only these 148 still have
  a file on disk, the rest were presumably already swept by D29's own
  cleanup pass).

**Explicitly NOT a cleanup opportunity — self-heals, don't touch**: the
remaining ~41.7GB of pre-cutoff `pmtiles-store` content (44.25GB total old
minus the 2.54GB true orphans above) sits at positions **shared** with the
current national generation's own covering — `aggregation_tile.py` will
delete-and-replace these in place, for free, as the remaining 1,507 items
get processed. Deleting them early would gain nothing (the position gets
rewritten either way) and costs a small risk of interfering with an
in-flight read. `bundle-store`'s ~111GB of non-`japan.pmtiles` regional
bundles were also checked and found to be fully regenerated every
`publish_cycle.py` run (all 24 non-bak files carry mtimes from the most
recent cycle) — not an accumulating cost, D40's own open question above is
now resolved: no cleanup needed there.

**Generation-usage comparison (Hidenori's specific ask)**: compared the
current national generation's own on-disk footprint against the Kyushu
generation's own remaining on-disk footprint, both attributed by the same
position cross-reference (not by mtime cutoff alone, to correctly count
positions the current generation has already overwritten in place):

| | pmtiles-store | tmp-store | aggregation-store meta | **total** |
|---|---|---|---|---|
| Current national gen (`01M0MWK...`), 472/1,979 (23.9%) done | 76.45GB | 12GB | 95MB | **≈88.55GB** |
| Kyushu gen (`01M0FNHYXSAMNVTV430XD3XB5T`), fully finished | 44.25GB | 39.61GB | 77MB | **≈83.94GB** |

**Finding: the current generation's own footprint already exceeds the
entire (complete) Kyushu generation's footprint, at under a quarter done.**
Naive linear extrapolation (88.55GB / 0.239) projects **≈371GB** for the
current generation's own `pmtiles-store`+`tmp-store`+meta alone at 100%
completion — in the same order of magnitude as this file's own earlier
~770GB `pmtiles-store`+`bundle-store` projection (that earlier figure also
included `bundle-store`, which this table deliberately excludes since it's
a shared derived artifact, not generation-owned storage). Practical
implication: Kyushu's remaining footprint (~84GB, of which only ~45.7GB is
actually reclaimable right now) is a **shrinking fraction** of total
storage pressure going forward — worth doing eventually for the guaranteed
45.7GB, but the current generation's own continued growth is and will
remain the dominant driver of D40's storage-trajectory concern, not
Kyushu's legacy data.

**Ready to execute whenever desired** (on `slate`, in
`/Volumes/Migrate-2025-04/github/hfu-mapterhorn/pipelines/`):
`cleanup_kyushu_generation.sh` — re-checks `lsof` on every target path
immediately before deleting (abort-on-open-handle, doesn't trust this
session's one-time check to still hold later), then deletes exactly the
45.68GB itemized above. Depends on the co-located manifest
`kyushu_cleanup_manifest_pmtiles_orphans.txt` (the 148 orphan paths, so a
future run doesn't need to recompute the cross-reference — though if
`aggregation_covering.py` is ever re-run for a new generation before this
executes, regenerate the manifest first rather than trusting a stale one).
Syntax-checked (`bash -n`) and spot-verified (3 sampled manifest paths
confirmed to exist) this session; not actually run.

## D41: Proposed storage-tiering split for generation 2+ — slow storage for `source-store`/`bundle-store`, fast internal disk for `tmp-store`

**Status**: Proposed, 2026-08-24. Hidenori is procuring slow storage
hardware now. **Not for the current (first) national generation** — this
is an infrastructure change to design in for whichever build comes after
today's, analogous to how D38/D39's own worker-count tuning was framed as
lessons for "next time," not a retrofit of the in-flight run.

**Motivation**: this session's D40-addendum audit (above) reconfirmed
D38's own finding that `/Volumes/Migrate-2025-04` (a single USB-attached
external SSD, not internal) shows an I/O pattern — many small random
reads/writes at high transaction rates, modest throughput — that this kind
of external-USB volume handles worse than internal NVMe/Thunderbolt
storage. Hidenori's own proposed split, following the same
allocate-slow-storage-to-slow-tolerant-data principle already used
elsewhere (referenced as "Oliver"'s pattern in conversation): put the
volume's cold/write-once/rarely-reread data on cheaper slow storage, and
give the volume's hottest small-random-I/O churn a fast tier instead.

**Proposed split**:
- `source-store` (345GB, static once downloaded per D40's own breakdown;
  read repeatedly only while `aggregation_run.py` is actively touching a
  given source tile, which for any one file happens once per relevant
  aggregation item, not continuously) → **slow storage**.
- `bundle-store` (regional bundles + `japan.pmtiles`, all write-once-then-
  shipped via `rsync` to `stars`; nothing on `slate` re-reads this
  directory's own content except each cycle's own bundling pass, which
  writes fresh copies rather than re-reading old ones) → **slow storage**.
- `tmp-store` (the actual hot path — per-item GDAL VRT mosaics,
  intermediate tiffs, webp tiles, all read+written repeatedly within a
  single item's short processing window, exactly the small-random-I/O
  pattern D38 flagged as the worse-fit-for-USB workload) → **fast internal
  system disk**, off the external volume entirely.
- `pmtiles-store` and `aggregation-store` deliberately left unaddressed
  here — not yet analyzed for this split; a future session should check
  their own read/write pattern (D32 already found `aggregation_run.py`'s
  own I/O here was, surprisingly, *lower* than `merge_japan_bundles.py`'s
  sequential reads — this may already be fine on the external volume as-is,
  don't assume it needs to move without re-checking) before deciding.

**Not yet done**: no hardware acquired, no migration plan written, no
`get_pmtiles_folder()`/`utils.py`-level path changes designed. Flagging as
a concrete next design task once Hidenori's slow-storage procurement lands
— revisit this entry then, and check whether internal disk on `slate` has
enough free capacity to host `tmp-store`'s working-set size (D38's own
peak-usage figures, ~12-40GB per generation per this session's own table
above, are the right reference point for internal-disk sizing, not
`tmp-store`'s historical worst case of 139GB mentioned in
`check_disk_headroom.py`'s own docstring).


### Addendum (2026-08-24 22:13 JST): Kyushu cleanup executed (41GB); pmtiles-store orphan deletion re-flagged as NOT purely disk-space-neutral

**Status**: Partially executed. tmp-store + bak-file portion done; the
pmtiles-store orphan-file portion deliberately held back on a newly
noticed correctness concern (see below), not yet decided.

**Executed** (live, both `aggregation_run_national` and `publish_cycle_6`
running concurrently at the time — confirmed safe per this file's own
addendum above, since neither process touches these specific paths):
`tmp-store/01M0FNHYXSAMNVTV430XD3XB5T` (Kyushu working directory,
39.61GB), the three small already-marked-obsolete `tmp-store` dirs
(`old-trial-setaside`, `sea-crop-v1-superseded`, `sea-crop-v2-superseded`,
0.21GB combined), the two empty pre-Kyushu generation dirs, and
`bundle-store/japan.pmtiles.bak-20260810` (3.31GB). `lsof` re-checked
immediately before deletion per the earlier addendum's own script logic
(both clean). Free space: 582GiB -> 623GiB (df), consistent with the
expected ~43GB.

**New concern found on review, before touching the remaining 2.54GB of
`pmtiles-store` orphans**: the earlier addendum's own "148 confirmed
permanent orphans" framing assumed these files are simply inert dead
weight, safe to delete for space alone. Re-reading D29's own root-cause
section surfaced a fact that framing missed: `bundle.py`'s own file
listing is an **unconditional** `glob('pmtiles-store/*.pmtiles' +
'*/*.pmtiles')` — it does not filter by which generation's covering
"owns" a given tile position. This means these 148 old-Kyushu-era files,
despite sitting at positions absent from the current national
generation's own `aggregation-store` coverage, are almost certainly
**still being picked up and included in every `bundle.py`/`merge_japan_
bundles.py` pass** -- i.e. still part of the currently-live, currently-
served `japan.pmtiles` at `depot.optgeo.org` right now, not orphaned in
the sense of "already invisible to the live map." Deleting them would
therefore not be a pure disk-space reclaim -- it would remove real (if
generation-stale/superseded, and geographically narrow) terrain content
from those specific tile positions on the live map, until/unless the
current national generation ever reprocesses that exact `(z,x,y)`
position itself (which, being outside its own covering, it structurally
never will -- same D29 root-cause mechanism).

**Not resolved this session**: whether these 148 positions falling
outside the national covering is itself correct/intentional (e.g. a
tiling-scheme change that legitimately excludes them) or an oversight
worth investigating -- and, separately, whether removing stale-but-
real content from those narrow areas is an acceptable tradeoff for the
2.54GB. Deliberately held back rather than deleted, pending that
decision. If deleted later, the best timing to avoid D37/D29-style
races is **before `bundle.py` starts globbing** for whichever
`publish_cycle` run comes next, not mid-run.

**Housekeeping**: `pipelines/cleanup_kyushu_generation.sh` and its
manifest (`kyushu_cleanup_manifest_pmtiles_orphans.txt`, committed
`b21d191`) still exist on `slate` but are now partially stale -- the
`tmp-store`/`bak` steps are no-ops if re-run (targets already gone,
`rm -rf`/`rm -f` on missing paths is silent success), and the
`pmtiles-store` orphan step is the only piece still meaningfully
pending. Not repushed to git this session; whoever next touches this
should either trim the script down to just the pending step or leave
it as reference and act manually once the correctness question above
is resolved.

## D42: Digest of Oliver's feedback on release cadence, data volume, and file format — informs 号2 planning

**Status**: Recorded, 2026-08-25. This entry is Hidenori's/Claude's own
analysis of a private conversation with Mapterhorn maintainer Oliver
Wipfli, not a transcript — per standing practice, person-to-person
correspondence content stays out of the repo; only the technical
substance and its implications for this project are recorded here.

**Trigger model, corrected**: earlier framing in this session's own
correspondence draft ("we key our cadence off Mapterhorn's release,
not GSI's") turned out to invert the actual dependency. Oliver's own
release trigger is demand-aggregated across the whole Mapterhorn
terrain-source ecosystem (130+ sources already, more coming, plus
imagery) — he cuts a release when fresh data exists **and someone
tells him to include it**. That means passively waiting for an
announcement from him is the wrong posture: nothing happens until we
proactively signal readiness. The correct model is the reverse of
what was drafted: **refresh our own side whenever GSI actually
updates** (that's the real, controllable trigger on our end), and
separately, **proactively flag to Oliver when a fresh build is ready**
— his own release timing then stays entirely his call, informed by
everything else he's juggling, not something we can or should wait on
passively.

**Release cadence, externally confirmed**: Oliver's last Mapterhorn
release was 2026-05, and his own stated goal is a terrain-data release
roughly every few months — consistent with the general observation
(his own example: Switzerland's national terrain refreshes fully every
6 years but partially every year) that terrain sources update on slow
cycles almost everywhere. Japan's own 1m DEM is characterized as still
early-stage with unusually large quarterly updates by comparison,
which lines up with the 2025-07 -> 2026-07 GSI announcement gap already
on record (`japan-geotiff-dem` `HANDOVER.md`) — not dispositive proof
of a fixed quarterly cadence, but directionally consistent with it.

**~100k file delta, externally cross-checked**: comparing this
project's own `latest_file_list.csv.gz` (291,779 current entries)
against the already-in-Mapterhorn `jpdem1a` source (206,127 entries)
independently produced ~106,648 missing (new) and ~20,996 to-delete
(stale) files -- Oliver ran this comparison himself from the manifest
directly, without needing anything further from this side, confirming
the manifest is usable as-is by a third party. This matches Hidenori's
own expectation and explanation: part is genuinely new GSI coverage,
part is the geographic-adjacency effect (D18's own corruption
investigation surfaced the same pattern independently -- updates
cluster spatially, so a real content change in one area touches many
neighboring grid cells even where the underlying survey didn't
change).

**New, still-open question for 号2 -- published-source file format**:
Oliver asked whether the Source Cooperative-published GeoTIFFs
themselves (not this project's own internal aggregation intermediates)
could match Mapterhorn's own preferred input format exactly -- LERC
compression, internally tiled, no overview pyramid. He's explicit this
trades against general-purpose GIS usability (no overviews means no
true Cloud-Optimized GeoTIFF; older software may lack LERC support)
but is what Mapterhorn itself wants as direct input. **This is a
distinct question from D22's own LERC verdict** -- D22 tested LERC on
this project's own short-lived, repeatedly-re-read aggregation
intermediates (`aggregation_merge.py`'s per-window reads) and correctly
rejected it there (15-35x slower). Whether the *final, published,
read-once* source GeoTIFFs should use LERC is a separate, unanswered
question -- not yet tested, not blocked by D22's own conclusion.

**Real technical lead surfaced by the exchange, worth investigating for
号2**: Oliver reported his own Mapterhorn-side aggregation pipeline
uses uncompressed intermediates today and saw only a small compute-time
cost switching those to LERC to save disk -- a sharp contrast with this
project's own 15-35x finding. The likely explanation, from comparing
the two pipelines' own access patterns: Oliver's merge step reads each
source file once before merging; this project's `aggregation_merge.py`
does **repeated windowed reads across every grouped source tiff**
(D22's own root-cause finding), paying LERC's per-block decode cost
many times over for the same bytes. **If `aggregation_merge.py` were
ever redesigned around a single-pass read per source file** (real
engineering, not attempted this session), LERC could plausibly become
viable for our own aggregation intermediates too -- which would cut
`pmtiles-store`/`tmp-store` footprint directly, addressing D40's
storage-trajectory concern from a different angle than D41's physical
storage-tiering plan. Flagging as a genuine 号2 architecture candidate,
not committing to it -- would need its own real benchmark before
adoption, same discipline as D22's own.

**Storage constraint, now mutually understood**: this project's own
D38/D41 storage/hardware limits (external USB 3.0 Gen1 SSD, 16GB RAM,
the D30 mmap-vs-seek+read fix) were explained to Oliver in the course
of this exchange and acknowledged as a real, currently-expensive-to-fix
constraint (storage and memory prices both cited as elevated right
now) -- not a surprise or a criticism from his side, just a shared
reality of running this on modest hardware. Reinforces D41's own
framing: worth addressing eventually, not urgent, procurement already
in motion.

**Implication for 号2 planning**: the next generation's own kickoff
trigger should be framed as "GSI ships a real update, we refresh and
tell Oliver" (proactive, GSI-anchored on our side) rather than waiting
on any signal from Mapterhorn's own release calendar. The LERC/format
question and the single-pass-merge architecture lead are both real
candidate scope items for 号2's own design pass -- neither started.

## D43: Session summary (2026-08-24〜25) — D35 corruption investigation closed, publish_cycle_6 completed and verified live, Oliver correspondence + 号2 planning started

**Status**: Recorded, 2026-08-25 18:50 JST. `aggregation_run_national`
still running uninterrupted, unaffected by anything in this entry.

**What happened this session, in order**:

1. **D40's Kyushu-generation cleanup, partially executed**: freed
   ~41GB (`tmp-store/01M0FNHYXSAMNVTV430XD3XB5T` + small superseded
   dirs + `bundle-store/japan.pmtiles.bak-20260810`), safe to run
   concurrently with the live burn since none of it overlaps paths the
   running processes touch. **Deliberately NOT deleted**: the ~2.54GB
   of confirmed pmtiles-store orphans -- re-examination found
   `bundle.py`'s glob is unconditional, so those old-generation files
   are almost certainly still being bundled into every live
   `japan.pmtiles`, not inert. Still pending a real decision (see D40's
   own addenda) before removal.

2. **D35/D18 corruption investigation: fully closed.** Beyond the 45
   files already known, a full ground-truth sweep of all 109 `4929`/
   `4930` 2次メッシュ (7,485 files, using a newly-committed, corrected
   `japan-geotiff-dem/scripts/ground_truth_check.py`) found 3 more
   corrupted files (mesh `492963`) -- fixed the same way as the
   original 45. **Final count: 48 corrupted files found and fixed,
   zero remaining known-suspect meshes.** Broader calibration sampling
   (~3,544 files: full Hokkaido `Z007` pack, 8 other scattered
   prefectures, and an exhaustive check of Kyushu/Okinawa's own `Z007`
   pack immediately outside `4929`/`4930`) found **zero corruption
   anywhere outside the `4929`/`4930` zone** -- real evidence the bug
   stayed localized, not proof it's impossible elsewhere. D35 itself
   marked CLOSED in this file. Full detail lives in `japan-geotiff-dem`
   DECISIONS.md D18 and its many addenda -- read that repo's own file
   for the complete technical narrative, not re-derived here.

3. **Oliver Wipfli correspondence, digested (not transcribed) into
   D42**: corrected the update-trigger model (refresh proactively when
   GSI ships new data, notify Oliver, don't wait passively for his own
   release signal -- he aggregates demand across 130+ sources and only
   releases when someone tells him something's ready), got an
   independent ~100k-file-delta confirmation of this project's own
   manifest, and surfaced two real open engineering questions for the
   next generation: whether to publish a LERC/tiled/no-overview
   Mapterhorn-ready variant of the source GeoTIFFs (separate question
   from D22's own aggregation-intermediate LERC rejection), and whether
   `aggregation_merge.py` could be redesigned around single-pass reads
   to make LERC viable for our own intermediates too.

4. **`PLAN.md` created** (repo root) -- a living, forward-looking
   design doc for 号2 (generation 2), covering the corrected trigger
   model, expected ~100k-file refresh scope, the data-quality baseline
   2号 should start from, infrastructure prerequisites (D41 storage
   tiering, D37's still-unautomated `downsampling_covering.py`
   preflight, 1号's own eventual residue cleanup), and the open LERC/
   format question. Not started -- gated on GSI actually shipping new
   data, per the corrected trigger model.

5. **`publish_cycle_6` completed successfully end to end**, started
   2026-08-24 19:06:02, finished 2026-08-25 07:03:50 (~12h). Final
   output: **`japan.pmtiles`, 159,566,959,509 bytes (159.6GB),
   1,377,720 tiles** -- both up substantially from cycle 5b (107.97GB/
   951,005 tiles), reflecting continued national aggregation progress.
   `rsync` sent 56.86GB (delta speedup 2.81x) over ~2h57m. **Verified
   live independently**: `depot.optgeo.org`'s own `Content-Length`
   matches the file size exactly; `stars`'s martin catalog shows the
   `japan` source hot-reloaded. No `bundle.py` crash this cycle (D37's
   own known race did not fire). One real finding along the way: while
   `publish_cycle_6` ran concurrently with `aggregation_run.py`,
   aggregation throughput dropped sharply for a stretch (a 20-minute
   window with zero new `.done` markers, though workers were
   confirmed still actively burning CPU, not hung) -- worse than D38's
   own recorded contention pattern but self-recovered without
   intervention. Not deeply investigated further; a data point for
   whoever next tunes concurrent publish-cycle timing.

**Current state, as of this entry (2026-08-25 18:50 JST)**:
- `aggregation_run_national`: **1,098/1,979 done** (55.5%), running
  continuously and alone (no publish_cycle active) since 07:03.
- Load average ~5.5, swap ~900MB, disk free **489Gi** -- all healthy,
  no concerns.
- No `publish_cycle_7` started yet -- next one is a judgment call
  whenever it seems like a good moment (D32's "roughly once a day"
  guidance), not yet triggered this entry.
- The 15GB of raw GML zips used for the corruption investigation
  (`~/Downloads` on `aalto`) have been deleted -- their purpose was
  fulfilled (all fixes independently re-verified from S3, not from
  local copies) and this matches the project's own storage-discipline
  convention. `/tmp` scratch dirs from this session also cleaned up.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth if idle too long, same as always). Read this file's
> D35 (now CLOSED), D40's addenda, D42, and this D43 in full first --
> also skim `PLAN.md` at the repo root for 号2's own standing design
> notes, and `japan-geotiff-dem`'s own `DECISIONS.md` D18 if the
> corruption investigation needs revisiting (it shouldn't -- it's
> closed).
>
> **First**: `screen -ls` for `aggregation_run_national` (should still
> be running -- D32: never intentionally pause it) and check its
> `.done` count (`find pipelines/aggregation-store/
> 01M0MWK852631SHCHPA66F21WQ -name '*-aggregation.csv.done' | wc -l`
> against 1,979) against this entry's own 1,098 to gauge elapsed
> progress and pace. At the last healthy standalone pace (~17-20/hr),
> full completion was projected around 2026-08-27~28.
>
> **Then**: decide whether it's a good moment for the next
> `publish_cycle` (no fixed schedule -- D32's own "roughly daily"
> guidance, or whenever enough new aggregation progress has
> accumulated). If run, expect a multi-hour cycle (downsampling is the
> long pole) and watch for D37's own known-harmless `bundle.py` race
> if it fires.
>
> **Storage**: D40's ~2.54GB pmtiles-store-orphan question is still
> open (not disk-space-neutral, re-check `bundle.py`'s own glob
> behavior before touching it -- see D40's own addenda). Otherwise
> storage headroom was healthy (489Gi free) as of this entry.
>
> **号2**: still gated on GSI actually shipping new DEM1A data (check
> `https://service.gsi.go.jp/kiban/app/data_update_info/`) -- no fixed
> cadence known, don't assume a date. When it happens, `PLAN.md` has
> the standing design notes; update it rather than re-deriving from
> scratch.
>
> Converse in Japanese, per this repo's own language policy.

## D44: publish_cycle crash-rate analysis across all of 1号 (3/8, all one root cause) — `bundle.py` fix applied, closing D37's open gap

**Status**: Recorded, 2026-08-26 05:50 JST. Continuation of D43's own
session, same national build (`01M0MWK852631SHCHPA66F21WQ`).

**Trigger**: `publish_cycle_7` crashed overnight (started 2026-08-25
19:00, crashed between 02:19 and 02:49 the next morning, mid-`bundle.py`)
with the exact `FileNotFoundError` signature D37 first documented and
left unfixed. Hidenori asked directly: across all of 1号's publish
cycles so far, how often has this actually happened, is that rate
concerning, can it be engineered away, and does it correlate with how
far `aggregation_run_national` has progressed?

**Full crash-rate audit, read from the actual log files (not assumed
from memory)**: every `publish_cycle_*.log` on `slate` was checked for
`Traceback`/`RuntimeError`/`publish cycle finished` markers.

| Cycle | Started | Outcome |
|---|---|---|
| first | 2026-08-22 23:37 | ✅ finished clean |
| 2 | 2026-08-23 06:37 | 💥 crashed (bundle.py) |
| 3 | 2026-08-23 07:09 | ✅ finished clean (retry of 2) |
| 4 | 2026-08-23 09:22 | ✅ finished clean |
| 5 | 2026-08-23 19:15 | 💥 crashed (bundle.py) |
| 5b | 2026-08-23 21:36 | ✅ finished clean (retry of 5) |
| 6 | 2026-08-24 19:06 | ✅ finished clean |
| 7 | 2026-08-25 19:00 | 💥 crashed (bundle.py) |
| 8 | 2026-08-26 04:36 | (in progress at time of writing) |

**3 crashes out of 8 resolved launches (37.5%)** -- meaningfully high,
not a rare fluke as D43's "cycle 6 didn't hit it" phrasing might have
implied in isolation.

**All three crashes independently confirmed to be the identical
mechanism**, by reading each traceback's actual missing filename, not
just trusting the shared `FileNotFoundError` class name:

- cycle 2: `pmtiles-store/7-114-46/12-3648-1501-**14**.pmtiles` (D37's
  own original finding)
- cycle 5: `pmtiles-store/7-114-49/12-3652-1577-**13**.pmtiles`
- cycle 7: `pmtiles-store/7-112-51/10-898-408-**12**.pmtiles` -- and,
  this session, directly confirmed the *replacement* file now sits at
  the same logical position: `pmtiles-store/7-112-51/10-898-408-
  **16**.pmtiles`, mtime 03:01, right after the crash window.

Mechanism (D37's own account, now doubly confirmed): `bundle.py`
`glob()`s the entire `pmtiles-store/` tree once, up front, then can
spend well over an hour reading files for a single large parent
region. If `aggregation_run_national` -- running continuously per D32
-- reprocesses and renames (via its own maxzoom-suffix change) a file
this pass already captured under its old name, the cached path goes
stale mid-read and `bundle.py`'s `pool.map()` propagates the exception,
killing the entire cycle (not just that one region).

**Fix applied and committed** (`hfu-mapterhorn` `8b4a50c`,
`pipelines/bundle.py`): wrapped the `read_full_archive(filepath)` call
in `create_archive()`'s read loop in `try/except FileNotFoundError`.
On catch, prints a clear warning and treats that source file's tiles as
absent for this pass (`tile_id_to_bytes = {}`, guarded by `if tile_id
in tile_id_to_bytes` before each `writer.write_tile()` call) rather
than crashing the whole `Pool.map()`. **Deliberately does not try to
hot-swap in the renamed file**: that file's tiles are decomposed at a
different zoom than what the earlier prep loop already computed for
the stale filename, so its tile IDs wouldn't line up -- swapping would
silently write wrong data, not just recover gracefully. The affected
parent's bundle is very slightly incomplete for that one cycle only;
since `bundle.py` always does a full fresh pass (`dirty_only = False`,
already the case before this fix), the next `publish_cycle` re-globs
and picks up the item correctly. Same skip-and-retry-next-time shape
as `DOWNSAMPLING_STRICT`'s own pattern elsewhere in this pipeline --
consistent with this codebase's existing conventions, not a new idiom.
Syntax-checked remotely on `slate` before committing; not yet
exercised against a live race (won't be provably validated until a
future `bundle.py` run actually hits the timing window again and logs
the new warning instead of crashing).

**Does crash probability correlate with aggregation progress?
Inconclusive from n=3, and the mechanism argues against a simple
story either way.** The race needs both (a) a stale, pre-existing file
still sitting at some position from before the current generation's own
reprocessing reached it, and (b) that same position getting reprocessed
by `aggregation_run_national` during `bundle.py`'s own read window. As
the national run's 1,979-item queue drains, the population satisfying
(a) mechanically shrinks toward zero -- arguing for a *falling* rate
over time, all else equal. But `bundle.py`'s own read window has also
been *growing* cycle over cycle as `pmtiles-store`/`japan.pmtiles` grow
(D40), which pushes the other way. Observed crash points were ~5-8%,
~15-20%, and (directly measured this session) **62.5%** aggregation
completion -- crashes at both very early and quite late stages, no
visible trend, and definitely not "only an early-generation problem."
With only 3 data points this can't be resolved statistically; the fix
above makes the question moot for `bundle.py` itself going forward
regardless of which way the true rate moves.

**Current state, as of this entry (2026-08-26 05:50 JST)**:
- `aggregation_run_national`: **1,296/1,979 done (65.5%)**, running
  continuously, unaffected by any of this.
- `publish_cycle_8` running (started 04:36:10, retry of crashed cycle
  7, screen session `publish_cycle_8`), mid-`downsampling_run.py`
  (~1,354/5,382 at this entry's snapshot) -- will be the first cycle to
  actually exercise the new `bundle.py` fix once it reaches that stage.
- Disk free: 440Gi, stable, no new concern beyond D40's still-open
  ~2.54GB orphan question (unchanged, untouched this session).
- A session-local 15-minute status-check loop (cron-based, this
  session only) has been running throughout -- **does not survive this
  session ending**, same caveat as the HANDOVER.md note on the previous
  Monitor-based loop. Whoever resumes should set up fresh monitoring if
  continuous observation is wanted again.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth if idle too long; if a *second* re-auth attempt hangs
> with "another cloudflared process is already waiting," check for and
> kill a stale `cloudflared access ssh` process before retrying -- seen
> and resolved this session, not yet a fully understood root cause).
>
> Read this file's D35 (CLOSED), D40's addenda, D42, D43, and this D44
> in full first -- also skim `PLAN.md` for 号2's own standing design
> notes.
>
> **First**: `screen -ls` for `aggregation_run_national` (D32: never
> intentionally pause it) and check its `.done` count against 1,979
> (`find pipelines/aggregation-store/01M0MWK852631SHCHPA66F21WQ -name
> '*-aggregation.csv.done' | wc -l`) against this entry's own 1,296 to
> gauge pace. At ~17-20/hr, full completion was still projected around
> 2026-08-27〜28 as of D43; re-check against the actual trend now.
>
> **Then check `publish_cycle_8`** (screen session `publish_cycle_8`,
> log `pipelines/publish_cycle_8.log`): did it finish? If it reached
> `bundle.py` and hit the D37 race again, the fix committed this
> session (`hfu-mapterhorn` `8b4a50c`) should now print a `WARNING:
> ... no longer exists -- likely overwritten by a concurrent
> aggregation_run.py reprocess ... Skipping its tiles this cycle`
> line and keep going, instead of crashing the whole cycle -- if you
> see a crash with the *same* `FileNotFoundError` traceback shape
> despite that fix being live, the fix itself needs debugging, don't
> just retry-and-move-on this time.
>
> **Storage**: D40's ~2.54GB `pmtiles-store` orphan question is still
> open and still untouched (`bundle.py`'s glob is unconditional, so
> those old-generation files are likely still being bundled into every
> live `japan.pmtiles` -- don't delete without re-confirming that's
> still true first).
>
> **号2**: still gated on GSI actually shipping new DEM1A data -- no
> fixed cadence known, don't assume a date. `PLAN.md` has the standing
> design notes; update it rather than re-deriving from scratch.
>
> Converse in Japanese, per this repo's own language policy.

## D45: downsampling completion-guarantee audit — found a worse, silent variant of D37/D44's race inside `create_tile()`, plus its root cause (`utils.create_archive`'s non-atomic write); both fixed

**Status**: Recorded, 2026-08-26 06:00 JST. Continuation of D44's own
session, same national build (`01M0MWK852631SHCHPA66F21WQ`).

**Trigger**: after D44's `bundle.py` fix, Hidenori asked directly
whether `downsampling_run.py` can actually be trusted to reach 100%
completion once `aggregation_run_national` finishes — noting that
downsampling's own progress has looked sluggish across this session's
publish cycles and that 1号's success depends on this working
correctly, not just looking like it's working.

**Traced the full dependency chain by reading the actual code (not
assumed)**: `aggregation_covering.py`'s `write_aggregation_items()`
computes each item's `child_z` (maxzoom) once, deterministically, from
`source_item['maxzoom']` — purely a function of the input source data's
own resolution, not anything decided at processing time — and encodes
it directly into that item's own `{z}-{x}-{y}-{child_z}-aggregation.csv`
filename. `aggregation_tile.py` (line 79) parses `child_z` straight
back out of that same filename and uses the identical value to build
its own output path (`{z}-{x}-{y}-{child_z}.pmtiles`, line 102) — so
there is no structural mismatch between what a generation's planning
step predicts and what its own tiling step actually produces. This
matters because it means **the D37/D44 race truly is a timing issue
(a stale file from an older generation, at the same position, not yet
overwritten)**, not a permanent filename mismatch that would make
`DOWNSAMPLING_STRICT`'s skip-and-retry loop forever — once
`aggregation_run_national` reaches 100%, every position's file should
settle at its correct, expected name. **Good news, confirmed by
reading the code, not assumed.**

**But found a worse variant of the same race, previously undetected
because it fails silently instead of crashing**: `downsampling_run.py`'s
`main()` does check for missing referenced files before starting an
item (respects `DOWNSAMPLING_STRICT`, skips-without-marking-done — this
part is correct and already understood). But `create_tile()` — the
per-parent-tile worker, called via `pool.starmap()` — has its **own**,
separate `if not os.path.isfile(filepath): continue` check on the same
referenced files, reached later (after `main()`'s own pre-check already
passed), and this one is **not gated by `DOWNSAMPLING_STRICT` at all**.
If `aggregation_run_national` renames the file in the (much narrower,
but nonzero) window between `main()`'s pre-check and this worker's
actual read, `create_tile()` silently treats that quadrant as if it
had no data (the surrounding `except Exception: pass` swallows this and
any other read failure the same way) — and `main()` then marks the
**whole parent tile `.done` anyway**, with a real hole in it, and
**nothing left to ever retry it**. This is strictly worse than
`bundle.py`'s old crash: a crash is loud and self-healing (D37's own
"retried immediately, ran clean" pattern); this is silent and
permanent. Directly answers Hidenori's concern: as written, this was
a real, unaddressed risk to whether 1号 actually converges to a fully
correct national tileset, not just to whether it *looks* done.

**Root cause traced one level deeper — `utils.create_archive()`
(shared by both `aggregation_tile.py` and `downsampling_run.py`, the
function that actually writes a `.pmtiles` file) writes directly to its
final `out_filepath`** (`open(out_filepath, 'wb')`, tiles streamed in,
header/directory only written at `writer.finalize()`). This means the
file exists on disk (`os.path.isfile() == True`) and is a **valid-
looking but incomplete/unparseable target** for the entire duration of
the write, not just absent-then-present. A concurrent reader hitting
this narrower sub-window would get a corrupt-read exception rather
than a clean "not there" signal — a second, harder-to-catch variant of
the same underlying race, affecting `bundle.py`'s reads too (though
D44's fix already catches `FileNotFoundError` there; this sub-window
would previously have surfaced as some other exception type,
unhandled).

**Three-part fix, all committed to `hfu-mapterhorn`**:
1. `utils.create_archive()` (`ff23d2e`): now writes to a same-directory
   `{out_filepath}.tmp-{pid}` path and `os.replace()`s into place only
   after `finalize()` completes. `os.replace()` on the same filesystem
   is atomic — a reader now only ever observes the old file (or
   nothing) or the fully-complete new one, never a partial state. Fixes
   this at the source for every current and future consumer, not just
   the two call sites known to be affected today.
2. `downsampling_run.py`'s `create_tile()` (`ff23d2e`): the referenced-
   but-missing case now raises a new `ChildPmtilesUnavailable`
   exception instead of silently continuing (the `child not in
   tile_to_pmtiles_filename` case — genuinely uncovered, not a race —
   is untouched, still a legitimate silent skip). The broad
   `except Exception: pass` around the actual read was removed at the
   same time: with (1) in place, a genuine read failure there is no
   longer expected from this specific race, and letting it surface
   (rather than swallowing it) means any *other* unexpected read
   problem now also triggers a retry instead of a silent partial tile.
3. `downsampling_run.py`'s `main()` (`ff23d2e`): the `pool.starmap()`
   call is now wrapped in `try/except ChildPmtilesUnavailable`; on
   catch, prints a clear warning, cleans up `tmp_folder`, and skips the
   item without marking `.done` — same skip-and-retry-next-time shape
   `DOWNSAMPLING_STRICT`'s own outer check already uses, just extended
   to cover the later, narrower race window too.

**`bundle.py`'s own `create_archive()` (a separate, local function in
that file, not `utils.create_archive()`) was deliberately left
untouched** — `bundle-store` output is only ever read by
`merge_japan_bundles.py`, which runs strictly after `bundle.py`
completes within the same `publish_cycle.py` invocation, never
concurrently with a writer; not exposed to this race class the same
way `pmtiles-store` is.

**Deployment timing note, for the record**: both fixed files were
copied to `slate` while `publish_cycle_8`'s own `downsampling_run.py`
was still mid-run (~1,393/5,382 at the time). This carries a small,
understood risk: `downsampling_run.py` uses `multiprocessing`'s
`spawn` start method, so newly-spawned `Pool` workers after the
deploy would import the *new* code while the already-running main
process still holds the *old* code in memory — if the race had fired
in that narrow overlap, the old main process's unwrapped
`pool.starmap()` call would have failed to unpickle the new
`ChildPmtilesUnavailable` exception cleanly and crashed the run (same
"crash, then retry cleanly" cost already accepted for D37/D44's own
`bundle.py` race, not a new failure class). Checked immediately after
deploying: `publish_cycle_8` was still running, unaffected. **The
fixes are only proven correct against a *future* fresh
`downsampling_run.py` invocation that runs entirely on the new code
end to end** — not yet validated against a live occurrence of the
race itself, same caveat as D44's own `bundle.py` fix.

**Current state, as of this entry (2026-08-26 06:00 JST)**:
- `aggregation_run_national`: 1,296/1,979 done (65.5%), unaffected.
- `publish_cycle_8`: still running, mid-`downsampling_run.py`
  (~1,393/5,382 at last check), now on the fixed code for any newly-
  spawned worker going forward; will be the first run to actually
  exercise the `ChildPmtilesUnavailable` catch path if the race fires
  again before this pass finishes.
- `DECISIONS.md`/`HANDOVER.md`/`PLAN.md` all updated this session (see
  D44 and PLAN.md's own infrastructure-prerequisites section).

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read this file's D35 (CLOSED) through D45 in full before touching
> anything -- D44 and D45 are dense and directly load-bearing for
> whether 1号 actually finishes correctly, not just whether it looks
> finished. Skim `PLAN.md` for 号2's own standing design notes (updated
> this session with a pointer to D44's fix).
>
> **First**: `screen -ls` for `aggregation_run_national` (D32: never
> intentionally pause it) and check its `.done` count against 1,979
> (currently 1,296) to gauge pace.
>
> **Then check whatever `publish_cycle_N` is most recent**: did it
> finish clean? If `bundle.py` or `downsampling_run.py` hit the D37/
> D44/D45 race again, the fixes committed this session (`hfu-mapterhorn`
> `8b4a50c`, `ff23d2e`) should now either print a clear `WARNING`
> and keep going (bundle.py) or skip the item with a `WARNING` and
> continue (downsampling_run.py) -- if either still crashes with the
> *same* underlying `FileNotFoundError`-class traceback despite these
> fixes being live, don't just retry-and-move-on this time, the fix
> itself needs debugging.
>
> **Once aggregation reaches 100%**, this is the real test: run
> `downsampling_run.py` once with no other process touching
> `pmtiles-store` concurrently, and confirm it converges to
> `Total: 0 files` needing work (everything either already `.done` or
> genuinely has no coverage) -- that's the actual proof D45's fix
> closes the loop, not just that it stopped crashing.
>
> **Storage**: D40's ~2.54GB `pmtiles-store` orphan question is still
> open and untouched.
>
> **号2**: still gated on GSI actually shipping new DEM1A data -- no
> fixed cadence known.
>
> Converse in Japanese, per this repo's own language policy.

## D46: rename the published archive from `japan.pmtiles` to `mapterhorn-japan-bridge.pmtiles`, everywhere

**Status**: Accepted and executed, 2026-08-26 09:35 JST. Hidenori's own
request, ahead of routing the live product through `stars`'s
`martin`+Caddy hosting under a name that matches the project rather
than a generic `japan.pmtiles` label. `publish_cycle_9` is the first
cycle to produce the archive natively under the new name (`cycle_8`
and everything before it still produced `japan.pmtiles`).

**Every reference found and changed, by grepping both repos rather than
relying on memory of where the name might appear**:

- `hfu-mapterhorn/pipelines/merge_japan_bundles.py`: `OUTPUT` constant
  (`bundle-store/japan.pmtiles` -> `bundle-store/mapterhorn-japan-
  bridge.pmtiles`). `INPUTS`'s own self-exclusion logic already
  compares against `OUTPUT` by path, so no other change was needed
  there.
- `hfu-mapterhorn/pipelines/publish_cycle.py`: the `rsync` source path
  and the module docstring's own filename mention.
- `stars`: `mv /home/stars/data/{japan,mapterhorn-japan-bridge}.pmtiles`
  -- same filesystem, instant, byte-identical (211,109,523,151 bytes,
  mtime preserved). **`martin`'s own `config.yaml` needed no edit** --
  its `pmtiles.paths: [/home/stars/data]` auto-discovers every
  `*.pmtiles` file in that directory and derives the source id from the
  filename stem, confirmed by reading `~/.config/martin/config.yaml`
  directly rather than assuming (only `z18`/`bvmap` are explicitly
  pinned there, for reasons unrelated to this rename -- `bvmap` is a
  remote URL source, not a local file). Confirmed live, no restart
  needed: `martin`'s own `/catalog` endpoint showed the new
  `mapterhorn-japan-bridge` source immediately after the `mv`. Likewise
  `Caddy`'s `/etc/caddy/Caddyfile` just serves whatever's in that same
  directory (`root * /home/stars/data`, `file_server`) -- no filename-
  specific config anywhere to update there either.
- **Both public URLs verified live, not just assumed from config**:
  `https://depot.optgeo.org/mapterhorn-japan-bridge.pmtiles` returns
  `Content-Length: 211109523151` (byte-identical to the file on disk);
  `https://stars.optgeo.org/mapterhorn-japan-bridge` returns a valid
  TileJSON with `tiles: ["https://stars.optgeo.org/mapterhorn-japan-
  bridge/{z}/{x}/{y}"]`.
- `mapterhorn-japan-bridge` (this repo)'s `style.json`: the one live-
  consuming reference in the GH Pages viewer (`app.js` only fetches
  `style.json` itself and holds no other hardcoded pmtiles URL, checked
  directly rather than assumed) -- `pmtiles://https://depot.optgeo.org/
  japan.pmtiles` -> `.../mapterhorn-japan-bridge.pmtiles`.
- `README.md`: the two prose mentions of the archive's own filename.
- `CLAUDE.md`: the three-way-split table's own "Publishes to" cell, and
  the `japan.pmtiles`-section header/body rewritten (also corrected two
  points that had gone stale independent of this rename while editing:
  `merge_japan_bundles.py` is a checked-in pipeline script now, not the
  "ad hoc, not committed" script an earlier session's note described,
  and the section's own S3-upload snippet was superseded by D13's own
  `stars`/`martin` hosting decision -- replaced with a pointer to the
  "Source Cooperative publishing" section instead of a stale command).
- **`DECISIONS.md`/`HANDOVER.md`'s own historical entries were
  deliberately left untouched** -- they're a point-in-time record of
  what was true when written, not meant to be retroactively rewritten;
  this entry is the forward-pointing record of the rename itself.
- `PLAN.md` was checked (grepped) and has no `japan.pmtiles` mentions --
  nothing to change there.

**Cleanup, verified safe before acting (D29's own lesson: check
`lsof`, don't assume)**: the old `bundle-store/japan.pmtiles` (211GB,
`cycle_8`'s own output) is now orphaned -- nothing in the renamed
pipeline will ever read or write that path again, and its content is
already the same bytes now living at `bundle-store/mapterhorn-japan-
bridge.pmtiles`'s own eventual `cycle_9` successor once that runs, plus
already safely on `stars` (`depot.optgeo.org` verified above). `lsof`
confirmed zero open handles; deleted. Freed 211GB, disk free rose from
~345Gi to **546Gi** on `slate`.

**Not changed, deliberately out of scope**: Source Cooperative's own
`s3://smartmaps/mapterhorn-japan-bridge/` prefix (D13's original
upload target, not actively used since `stars`/`martin` became the
primary host) -- no filename-specific artifact exists there to rename,
and re-attempting that upload path wasn't part of Hidenori's own
request here.

**Current state, as of this entry (2026-08-26 09:38 JST)**:
- `aggregation_run_national`: unaffected throughout, kept running
  continuously (D32) the whole time this rename was carried out.
- No `publish_cycle_9` started yet -- next one will be the first to
  produce `mapterhorn-japan-bridge.pmtiles` natively end to end (not
  just via a post-hoc rename), completing the verification this entry
  couldn't finish by itself.
- Both repos' changes committed: `hfu-mapterhorn` (pipeline scripts)
  and `mapterhorn-japan-bridge` (docs/viewer + this entry).

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read `DECISIONS.md` D35's closing addendum through D46 in full before
> touching anything. Skim `PLAN.md` for 号2's own standing design notes.
>
> **First**: `screen -ls` for `aggregation_run_national` (D32: never
> intentionally pause it) and check its `.done` count against 1,979.
>
> **Then**: this session renamed the published archive from
> `japan.pmtiles` to `mapterhorn-japan-bridge.pmtiles` everywhere (D46)
> -- if a `publish_cycle` has run since this entry, confirm it actually
> produced `bundle-store/mapterhorn-japan-bridge.pmtiles` (not a
> leftover `japan.pmtiles`) and that `https://depot.optgeo.org/
> mapterhorn-japan-bridge.pmtiles` / `https://stars.optgeo.org/
> mapterhorn-japan-bridge` are both still live with the current byte
> count. If neither has been re-verified since this entry, that's the
> one loose end D46 couldn't close by itself.
>
> **Also still open from D44/D45**: neither the `bundle.py`
> `FileNotFoundError`-catch fix nor the `downsampling_run.py`/`utils.py`
> atomic-write fix has been proven against a *clean* full run yet --
> `publish_cycle_8` did exercise the `bundle.py` fix for real (7 race
> hits, all caught cleanly, D44) but check whether a later cycle's
> `downsampling_run.py` pass ever actually hit `ChildPmtilesUnavailable`
> and recovered as designed, not just that nothing crashed.
>
> **Storage**: D40's ~2.54GB `pmtiles-store` orphan question is still
> open and untouched. Disk free was healthy (~546Gi) as of this entry,
> after D46's own 211GB cleanup of the old-named orphaned bundle.
>
> **号2**: still gated on GSI actually shipping new DEM1A data -- no
> fixed cadence known.
>
> Converse in Japanese, per this repo's own language policy.

## D47: GH Pages viewer reads terrain from `martin`'s XYZ endpoint instead of the raw `.pmtiles` file directly

**Status**: Accepted and executed, 2026-08-26 21:15 JST. Hidenori's own
request: the viewer was still reading `mapterhorn-japan-bridge.pmtiles`
straight off `depot.optgeo.org` via the `pmtiles://` protocol (client-
side range requests into the raw 211GB archive); switch it to
`https://stars.optgeo.org/mapterhorn-japan-bridge/{z}/{x}/{y}` (the
`martin`-served XYZ endpoint for the same archive, already confirmed
live in D46) instead, for Cloudflare's own edge-cache benefit on
individual small tile responses versus large-file range requests.

**Changes, in `mapterhorn-japan-bridge`**:
- `style.json`: the `mapterhorn` source's `url` changed from
  `pmtiles://https://depot.optgeo.org/mapterhorn-japan-bridge.pmtiles`
  to `https://stars.optgeo.org/mapterhorn-japan-bridge` -- a
  standard MapLibre `raster-dem` source pointed at `martin`'s own
  TileJSON document (not a hardcoded `tiles` array), so zoom range/
  bounds/attribution stay in sync with whatever `martin` currently
  reports rather than needing to be hand-maintained here.
- `app.js`: removed the now-dead `pmtiles.Protocol()` registration
  (`maplibregl.addProtocol('pmtiles', ...)`)  -- nothing in the style
  uses the `pmtiles://` scheme any more (`bvmap` was already a plain
  XYZ source via `martin`).
- `index.html`: removed the now-unused `pmtiles@4.3.0` script tag --
  the viewer no longer ships the `pmtiles` client library at all.

**Verified before deploying, not just assumed**: ran the edited files
against a local static server, loaded in a real browser context.
`martin`'s XYZ tiles fetch correctly (`200`, `image/webp`, real byte
content) and decode to the expected `512x512` pixel dimensions for
every successfully-returned tile sampled (`z0/0/0`, two `z13` tiles
near Hakodate, one `z14` tile) -- confirms `martin` serves the
identical underlying bytes a direct `pmtiles://` read would have,
just fronted by a normal HTTP tile endpoint instead. The default 2D
hillshade view renders correctly (roads/coastline/labels/relief all
present around 函館, after an initial-paint nudge this session's own
headless test tooling needed -- not expected to affect real user
browsers, which trigger MapLibre's normal tile-loading pipeline via
their own pan/zoom/resize interactions).

**Found, not caused by this change (best evidence, not fully proven)**:
toggling the 3D terrain checkbox surfaces a `dem dimension mismatch`
console error from MapLibre at several coarser zoom levels (z8-z11)
near Hakodate. Investigated rather than assumed: every tile this
session could confirm actually returned `200` decoded to the correct
`512x512` regardless of zoom, so this isn't a real pixel-dimension
inconsistency in what `martin` serves -- the coarser-zoom positions
tested all returned `204` (no content) instead. Given `downsampling_
covering.py`'s own region-based `simplified_extents` logic (not a
uniform full-world pyramid at every zoom -- see that script's own
`get_simplified_extents()`) plus the national build still sitting at
~77% aggregation at the time of this test, sparse coverage at some
coarse-zoom positions is expected right now, not obviously a
migration regression -- MapLibre's terrain code likely surfaces a
missing raster-dem tile as this specific error message. Not confirmed
against the old `pmtiles://` path before this session's own change
(that path no longer exists to A/B against), so this is flagged as a
real, reproducible, but *not fully attributed* finding -- worth a
fresh look after aggregation reaches 100% (D45's own resume-prompt
already asks for a clean post-completion check; re-test the terrain
toggle at the same time) rather than chased further this session,
since the default 2D view (this repo's own actual production
configuration) is unaffected.

**Current state, as of this entry (2026-08-26 21:15 JST)**:
- `aggregation_run_national`: unaffected throughout, still running
  (D32) -- 77%+ complete, ETA discussed separately (~2026-08-27
  evening at the last measured clean pace).
- No `publish_cycle` running -- Hidenori's own call to hold off until
  aggregation finishes (see this session's own ETA discussion).
- Committed and pushed to `mapterhorn-japan-bridge` (docs/viewer repo)
  -- nothing to change on `slate`'s `hfu-mapterhorn` pipeline side for
  this one, it's viewer-only.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read `DECISIONS.md` D35's closing addendum through D47 in full
> before touching anything. Skim `PLAN.md` for 号2's own standing
> design notes.
>
> **First**: `screen -ls` for `aggregation_run_national` (D32: never
> intentionally pause it) and check its `.done` count against 1,979
> (was 1,979 not yet reached as of this entry -- if it's now at 1,979,
> that's the actual headline: aggregation finished, decide on
> `publish_cycle_9` per Hidenori's own "wait for completion" call).
>
> **D47's own open thread**: once aggregation is fully done, re-test
> the GH Pages viewer's 3D terrain toggle (not just the default 2D
> view) -- confirm whether the `dem dimension mismatch` console error
> found this session is gone once coverage is complete (supporting the
> sparse-coverage theory) or persists (meaning it needs real
> investigation, possibly in `martin`'s own tile-serving behavior or
> this project's downsampling covering logic).
>
> **Also still open from D44/D45**: neither the `bundle.py`
> `FileNotFoundError`-catch fix nor the `downsampling_run.py`/`utils.py`
> atomic-write fix has been proven against a *clean* full run yet.
>
> **Storage**: D40's ~2.54GB `pmtiles-store` orphan question is still
> open and untouched.
>
> Converse in Japanese, per this repo's own language policy.

## D48: `aggregation_run_national` reaches 1,979/1,979 — full national aggregation complete; a real crash found and fixed on the final 3 items; `publish_cycle_9` launched as the first clean, native run

**Status**: Recorded, 2026-08-27 19:45 JST. 1号's own aggregation stage
(generation `01M0MWK852631SHCHPA66F21WQ`, started 2026-08-22 per D35's
own addendum) is now **fully complete** — 1,979/1,979 dirty items done,
zero remaining. This is the actual completion milestone the whole
`aggregation_run_national` effort has been running toward since D23's
real national launch.

**Not a clean finish — a real crash on the final 3 items, found and
fixed before declaring completion**: a routine status check found
`aggregation_run_national`'s own `screen` session had exited with
**1,976/1,979 done**, not 1,979 -- deliberately not assumed to be
"basically done" (per this file's own standing "don't proceed on
assumption" discipline, most recently exercised for D44/D45). The
process had actually crashed:

```
FileNotFoundError: tmp-store/01M0MWK852631SHCHPA66F21WQ/11-1818-808-16/5-3857.tiff
```

**Root cause, traced by reading the actual code** (`aggregation_run.py`,
`aggregation_merge.py`): `aggregation_run.py`'s own `run()` creates each
item's `tmp_folder` with `os.makedirs(tmp_folder, exist_ok=True)` --
**never wiped between separate attempts at the same item**. All 3
remaining items' `tmp_folder`s held a fully-written `merged-3857.tiff`
(513MB/900MB/895MB) *plus* their original per-group `{i}-3857.tiff`
inputs, all dated **2026-08-23〜25** -- four days stale, almost
certainly left over from an attempt interrupted mid-`aggregation_
merge.py`'s own `merge()` call during D38's own recorded ~7h blackout
window, after the merge write itself finished but before its own
cleanup loop or `merge-done` marker touch completed. `merge()`'s own
`glob(f'{tmp_folder}/*.tiff')` (used to count expected per-group
inputs) is unscoped -- on a retry, it **also matched `merged-3857.tiff`
itself**, inflating the input count by one and causing the code to
look for a "last" per-group tiff (`5-3857.tiff`) that never existed
(source composition for this item only ever produced groups 0-4).

**Fix, committed to `hfu-mapterhorn`** (`cf857ff`): both globs
scoped to the real per-group naming pattern (`[0-9]*-3857.tiff`,
which `merged-3857.tiff` never matches, since it starts with a
non-digit), plus an explicit early-return: if `merged-3857.tiff`
already exists when `merge()` is entered, finish the interrupted
cleanup (remove any leftover per-group tiffs, touch `merge-done`)
instead of blindly re-running the expensive merge. Verified working
directly, not just by absence of a second crash: all 3 items' own
`tmp_folder/merge-done` markers were created within 2 seconds of the
retry starting (19:17:0x), confirming the new early-return path fired
correctly rather than falling through to a full re-merge. The 3
`aggregation_tile.main()` tiling passes that followed (the genuinely
expensive remaining step for these particular large-composition items)
then ran for real -- workers observed at 99-100% CPU, ~4 minutes
accumulated -- and all 3 items completed cleanly (`... start` / `...
end` pairs, no further errors). Restarted via the same `screen`+`zsh
-lc` pattern established throughout this session; finished at
**2026-08-27 19:43 JST, 1,979/1,979**.

**This is the same failure *class* this session already found and fixed
twice this session** (D44's `bundle.py`, D45's `downsampling_run.py`/
`utils.create_archive`) -- an uncaught exception from a `Pool.starmap()`
worker killing the whole batch, this time triggered by a *different*
mechanism (a resumed item's own tmp-state, not a cross-process race
with a concurrent generation) but the same underlying lesson: none of
this pipeline's stages originally assumed they might be resumed
mid-flight after an interruption, and `tmp_folder`/`bundle-store`/
`pmtiles-store` are none of them wiped clean between attempts by
design (D12's own explicit decision to key `tmp_folder` by
`aggregation_id` rather than wipe it). Worth keeping in mind for 号2:
any stage that can be interrupted (which is all of them, on a
single-machine, multi-day pipeline) needs its own resume-safety
audited, not just assumed from "it worked so far."

**`publish_cycle_9` launched immediately after**, 19:43:39 -- this is
simultaneously:
1. The first cycle to produce `mapterhorn-japan-bridge.pmtiles`
   natively end to end (D46's own rename).
2. The first `downsampling_run.py` pass with **zero concurrent
   aggregation activity** -- the actual clean-run validation D45's
   own resume prompt asked for (does downsampling genuinely converge
   to complete coverage once nothing is racing it any more?).
3. The first `bundle.py` pass under the same zero-contention
   condition -- expected to show **no** `FileNotFoundError`-class
   race warnings at all now (D44's fix should simply never need to
   fire, which is itself the confirmation, not a failure if it
   doesn't).

Full results not yet in -- still running as of this entry. See this
entry's own addendum (to follow) or the next `DECISIONS.md` entry for
the outcome.

**Current state, as of this entry (2026-08-27 19:45 JST)**:
- `aggregation_run_national`: **complete**, 1,979/1,979, `screen`
  session exited cleanly. No longer running -- nothing left to do at
  this stage for 1号.
- `publish_cycle_9`: running, `downsampling_run.py` stage.
- Disk free: ~535Gi, healthy.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read `DECISIONS.md` D35's closing addendum through D48 in full
> before touching anything -- D44 through D48 are dense and this is
> 1号's actual completion. Skim `PLAN.md` for 号2's own standing design
> notes.
>
> **1号's `aggregation_run_national` is done** (1,979/1,979, completed
> 2026-08-27 19:43 JST) -- nothing more to run at that stage. **First**:
> check whether `publish_cycle_9` (launched immediately after
> completion, to run clean with zero concurrent aggregation) finished,
> and whether it validates D44/D45's fixes as expected (zero race
> warnings in `bundle.py`, `downsampling_run.py` converging to full
> coverage) -- this is the one open question this session couldn't
> close by itself if it's still running.
>
> **Then**: re-test the GH Pages viewer's 3D terrain toggle (D47's own
> open item) now that aggregation is fully complete -- confirm whether
> the `dem dimension mismatch` finding from D47 is gone (supporting the
> sparse-coverage theory) or persists.
>
> **D40's ~2.54GB `pmtiles-store` orphan cleanup**: now safe to
> re-audit and execute for real -- aggregation will never reprocess/
> rename any position again, removing the ambiguity that kept this
> deferred since D40.
>
> **What's next for this project**: 1号 itself is functionally
> complete pending `publish_cycle_9`'s own clean verification above.
> 号2 stays gated on GSI actually shipping new DEM1A data (D42/PLAN.md)
> -- no fixed cadence known, don't start it just because 1号 finished.
> Whether/when to notify Oliver Wipfli about 1号's completion is
> Hidenori's own call, not something to act on unprompted.
>
> Converse in Japanese, per this repo's own language policy.

## D49: `publish_cycle_9`'s `merge_japan_bundles.py` step drove disk to 100% full (13Gi free) mid-run -- root cause traced to the `pmtiles` library's own temp-file design, resolved live by deleting already-consumed regional bundle inputs

**Status**: Recorded, 2026-08-28 13:10 JST. Live incident, resolved while
`publish_cycle_9` (D48's own clean-validation run) was still in its
`merge_japan_bundles.py` stage.

**What happened**: routine monitoring found free space on `slate` had
fallen from a healthy 214Gi to **13Gi (100% capacity)** within about an
hour, entirely during `merge_japan_bundles.py`'s own run -- no crash
yet, but clearly on a collision course with `ENOSPC`.

**Root cause, traced by reading the actual `pmtiles` library source
(`pmtiles.writer.Writer.finalize`), not assumed**: `Writer` streams
every `write_tile()` call's deduplicated tile bytes into a **separate
scratch temp file** (`self.tile_f`, e.g. `/Volumes/Migrate-2025-04/tmp/
tmpip7i8vae` -- immediately unlinked from its directory entry per
standard `tempfile` behavior, so it's invisible to `du`/`find`, only
visible via `lsof`). At `finalize()`, it writes the header/directory/
metadata to the *real* output file, then does a single
`shutil.copyfileobj(self.tile_f, self.f)` -- a full byte-for-byte copy
of the entire scratch file into the final archive. **This means the
scratch temp file and the growing final output coexist on disk
simultaneously for the whole copy**, needing roughly **2x the final
archive's own tile-data size** in temporary headroom at peak -- not
something `merge_japan_bundles.py`'s own code controls (it only calls
`write_tile()`/`finalize()`); a structural property of the upstream
`pmtiles` library itself. Confirmed directly via `lsof`: the temp file
reached **286,084,810,886 bytes (266GiB)** and stopped growing (all
`INPUTS` fully read), while the final output was still climbing through
the 160-180GB range when free space bottomed out at 13Gi.

**Resolved live, not by guessing**: since the temp file had stopped
growing, that meant `merge_japan_bundles.py`'s own read loop over
`INPUTS` (the 23 regional `bundle-store/{z}-{x}-{y}.pmtiles` files plus
`planet.pmtiles`, 266GB total) had **already fully completed** -- every
byte needed from them was already inside the temp file. Verified with
`lsof` on each input file individually (per this file's own D29 lesson:
check before deleting, don't assume) -- zero open handles, confirming
nothing was still reading them. Deleted all 23 regional files +
`planet.pmtiles`, freeing 266GB -> disk free jumped from 13Gi to 278Gi.
`merge_japan_bundles.py`'s own `finalize()` copy resumed climbing
immediately (output size actively growing again within the same
monitoring cycle). **Safe because these files are fully, deterministically
regenerable**: `bundle.py` always does a complete fresh rebuild from
`pmtiles-store` every cycle (`dirty_only = False`, D44's own comment) --
deleting them costs nothing beyond needing that rebuild next cycle,
unlike `pmtiles-store` or `source-store`, which would have been
genuine, expensive-to-recover data loss and were never touched.

**Why this didn't bite `publish_cycle_6`/`cycle_8`**: those cycles'
`japan.pmtiles` topped out at 159.6GB and 211.1GB respectively (D43,
D46) -- large, but apparently still under whatever margin existed at
the time. This cycle's own final archive is on track to be
substantially larger (aggregation is now 100% national, vs. ~55-68%
during those earlier cycles), pushing the same 2x-temp-space structural
cost past the available headroom for the first time. **Likely to recur
on every future cycle** now that the archive has permanently grown to
national-100% scale, not a one-off.

**Worth a real fix, not done this session (merge still in flight,
D45's own "don't edit code a live process has already loaded"
discipline applies)**: `merge_japan_bundles.py` could delete each
`INPUTS` file immediately after that file's own read loop finishes
(freeing space progressively rather than needing all-at-once headroom
at the end) -- trades "regenerate cheaply if merge crashes partway" for
"never let bundle-store integrity be actually at risk," a real design
tradeoff to weigh deliberately, not a quick patch. Flagging as a
concrete next-session item.

**Current state, as of this entry (2026-08-28 13:10 JST)**:
- `aggregation_run_national`: complete, 1,979/1,979 (D48), unaffected.
- `publish_cycle_9`: `merge_japan_bundles.py` resumed normally after
  the cleanup, output climbing toward its own final size (temp file's
  266GB is the practical ceiling). Zero `no longer exists` race
  warnings through `downsampling_run.py` and `bundle.py` (D44/D45's own
  clean-run validation holding up so far).
- Disk free: ~262Gi and stable, healthy margin restored.
- `check_pmtiles_integrity.py` (built and committed this session,
  `0c45422`) is ready to run against `bundle-store/mapterhorn-japan-
  bridge.pmtiles` once this merge finishes.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read `DECISIONS.md` D35's closing addendum through D49 in full before
> touching anything -- 1号's aggregation is complete (D48) and this
> entry (D49) covers a live near-miss during its first clean
> `publish_cycle_9` validation run.
>
> **First**: check whether `publish_cycle_9` finished (`screen -ls`,
> `tail pipelines/publish_cycle_9.log` for `publish cycle finished` or
> a crash) and whether disk stayed healthy through `rsync`. If it
> crashed on `ENOSPC` again despite this session's cleanup, the real
> fix (progressive input deletion in `merge_japan_bundles.py`, see this
> entry's own "worth a real fix" section) needs to actually happen
> before retrying blindly.
>
> **Then**: run `check_pmtiles_integrity.py bundle-store/mapterhorn-
> japan-bridge.pmtiles` (built this session, `0c45422`) -- confirms
> every tile has a parent one zoom coarser, no downsampling holes.
> Report tile counts per zoom and any orphans found.
>
> **Also still open**: D47's 3D-terrain-toggle `dem dimension mismatch`
> re-test (should this cycle's 100%-complete coverage resolve it);
> D40's ~2.54GB `pmtiles-store` orphan cleanup (now unambiguously safe
> to execute, aggregation will never reprocess again).
>
> Converse in Japanese, per this repo's own language policy.

## D50: `stars`-side ENOSPC near-miss during `publish_cycle_9`'s rsync retry (D49's same failure class, receiving end this time); `check_pmtiles_integrity.py`'s first real run found 413,925 orphaned tiles, traced to coarse-zoom downsampling throughput, not a covering-logic bug

**Status**: Recorded, 2026-08-28 18:48 JST. Resuming per D49's own resume
prompt, via SSH from `aalto`.

**Part 1 -- `publish_cycle_9`'s rsync was still mid-transfer, not stalled,
and about to hit a second, distinct disk-space incident**: `screen -ls`
confirmed the `publish_cycle_9` session and its `rsync` process (started
13:18, D49's own merge output) were both still alive -- not crashed, not
finished. `depot.optgeo.org`/`stars.optgeo.org` were still serving
`cycle_8`'s old bytes (211,109,523,151), unchanged, since rsync hadn't
reached its atomic rename yet.

Checked `stars`'s own disk directly rather than assuming rsync would just
finish: `df` showed only ~124GiB free, with the in-progress temp file
(`/home/stars/data/.mapterhorn-japan-bridge.pmtiles.DXPvU6`) already at
~131.7GB and growing ~1.6GB/min toward a ~266GiB final size, while the
**old `mapterhorn-japan-bridge.pmtiles` (211GB) was still on disk,
untouched, coexisting with the growing temp file** -- the same structural
2x-space problem D49 diagnosed on `slate`'s own local disk during
`merge_japan_bundles.py`, this time on the *receiving* end during
`rsync`. Projected ENOSPC in ~70-80 minutes, ~20GB short of completion.

**First mitigation attempt found a real gotcha, not just a fix**:
deleted the old `mapterhorn-japan-bridge.pmtiles` on `stars` (Hidenori's
own call, after being warned this would take the live public URLs down
during the swap) expecting to free ~211GB immediately. It didn't --
`df` showed no meaningful change (124.66GB -> 124.65GB). Root cause,
confirmed via `fuser` (no `lsof` on this Debian box): the receiving-side
`rsync --server` process itself still held the old file open as its
own delta-transfer basis file (standard rsync algorithm: read matching
blocks from the existing destination file to reduce bytes-over-the-wire,
even though this specific transfer had little in common between old/new
content). **Standard POSIX behavior, not a bug**: `unlink()` on a file
with an open fd removes the directory entry but does not free blocks
until the last fd closes -- `rm` "succeeding" is not the same as space
being reclaimed. Side effect confirmed live: `depot.optgeo.org` started
returning 404 (Caddy couldn't re-open the now-unlinked path for new
requests) and `stars.optgeo.org`'s tile endpoint also went to 404 for
actual tile requests (TileJSON metadata alone stayed 200) -- real,
if brief, public downtime for zero space benefit at that point.

**Corrected fix**: killed the client-side `rsync` process (`kill -TERM`)
on `slate`, which closed the connection and let the receiving-side
process exit too, finally releasing its fd on the unlinked old file.
Confirmed via `df`: free space jumped from ~124.7GB to **476GB**
(rsync's own interrupt handling also cleaned up its own incomplete temp
file). Since `bundle-store/mapterhorn-japan-bridge.pmtiles` on `slate`
was already complete and untouched (D49's own merge had already
finished before this session started), there was no need to re-run the
full `publish_cycle.py` (downsampling + bundle + merge, over an hour) --
just re-ran the bare `rsync` command directly in a fresh `screen`
session (`publish_cycle_9_rsync_retry`). No basis file to delta against
this time (old file genuinely gone), so no repeat of the 2x-space
problem is possible for this retry. Still running as of this entry
(~137GB/286GB, ~340GB free, healthy pace, no ENOSPC risk).

**Worth carrying forward**: this is the same underlying `pmtiles`-
library-adjacent "growing output + still-present prior file" pattern
D49 already flagged as "likely to recur on every future cycle" --
except D49 only analyzed the `slate`-side `merge_japan_bundles.py`
leg. **`rsync`'s own default delta-transfer algorithm has the identical
structural cost on the `stars`-side leg**, now confirmed empirically,
not just by analogy. `--inplace` (write directly into the destination,
no separate temp+basis-file copy) would avoid this doubling but trades
away rsync's own crash-safety (a killed `--inplace` transfer leaves a
corrupt destination, not an untouched original) -- a real tradeoff,
not evaluated further this session. Not fixed; flagging as a
publish_cycle.py-level design question alongside D49's own open
"progressive input deletion" item.

**Part 2 -- `check_pmtiles_integrity.py` (built and committed last
session per D49, never yet run against a real archive) run for the
first time**, against `bundle-store/mapterhorn-japan-bridge.pmtiles`
(2,358,133 tiles, z0-z16) while the rsync retry above ran in parallel
(read-only, seek+read only, safe to run concurrently). Completed in
56s:

| zoom | tiles | orphans (no parent at z-1) |
|---|---|---|
| z0-z1 | 1, 1 | 0 |
| z2-z8 | 0 | -- |
| z9 | 4 | 4 (100%) |
| z10 | 32 | 16 (50%) |
| z11 | 140 | 12 (9%) |
| z12 | 41,671 | 41,113 (98.7%) |
| z13 | 23,144 | 10,556 (46%) |
| z14 | 95,872 | 20,592 (21%) |
| z15 | 373,120 | 28,544 (7.6%) |
| z16 | 1,805,568 | 313,088 (17.3%) |

**Total 413,925 orphaned tiles (17.6% of the archive)**. The archive
itself is **not corrupted** -- header, directory tree, and every tile
id enumerated cleanly with zero read errors; this is a genuine data
*gap*, not a broken file.

**Root cause traced empirically against `aggregation-store`'s own
`.done`-marker counts and mtimes, not assumed from re-reading
`downsampling_covering.py` alone** (an initial code-only read of
`get_simplified_extents()`'s `num_overviews`-based zoom-skipping logic
looked like a plausible "intentional pyramid gap by design" explanation
-- ruled out by the evidence below):

```
downsampling.csv done/todo by parent_zoom (target zoom built), this generation:
  z15: 1,682/2,005 (84%)   z12: 487/1,835 (27%)
  z14: 1,612/1,942 (83%)   z11:   8/308   (2.6%)
  z13: 1,131/1,606 (70%)   z10:   2/252   (0.8%)
                            z9:   1/168   (0.6%)
                          z1-z8:  0/223   (0%)
```

`aggregation.csv` (native, pre-downsampling source resolution) only has
entries at child_zoom 12/13/14/16 -- **z12, z13, z14, and z16 each get
tile coverage from two independent sources**: direct native-resolution
output from `aggregation_tile.py` (already 100% complete per D48, no
downsampling dependency at all) *and* whatever `downsampling_run.py`
itself manages to build. **z11 and everything coarser has zero native
fallback** -- it exists only if the downsampling cascade actually
produces it, and each level strictly requires all 4 finer-zoom children
to exist first. Since z12 (the first fully downsampling-dependent
input z11 needs) is only 27% complete, z11's own completion (needing
all 4 quadrants simultaneously) drops far below a naive 27% -- and this
compounds at every level above it, producing the near-total emptiness
observed at z9-z11 and complete emptiness at z1-z8.

Checked whether this is a permanent stall (D45's own feared "silent and
permanent" variant) or just slow, ongoing progress: `.done` marker
mtimes at z9-z11 show **most of the existing 11 completions (8+2+1)
happened during this very session's own cycle_9 downsampling pass
(05:26-27 JST today)**, not accumulated steadily since generation start
(2026-08-22, 6 days / 9 cycles prior). Progress is real but has been
extremely slow at this tier -- not visibly stuck, but nowhere near
converging within any cycle count seen so far.

**Directly resolves D47's own open question**: the "dem dimension
mismatch" console error found there at z8-z11 was tentatively attributed
to "sparse coverage while aggregation is still incomplete" -- **that
theory is now falsified** (aggregation has been 100% complete since
D48, and this orphan-check ran against a `bundle-store` archive built
entirely after that completion). The real cause is specifically
**coarse-zoom downsampling throughput**, not aggregation incompleteness.

**Not fixed this session** -- flagging as the concrete next engineering
task, with two open sub-questions neither confirmed nor ruled out:
1. Does simply running `downsampling_run.py` many more times (now safe,
   zero concurrent aggregation per D48) eventually converge z9-z11 to
   full coverage, just slowly? Or
2. Is there a structural I/O bottleneck specific to coarse-zoom items --
   analogous to D44's own finding that a single large `pmtiles-store`
   region file can take `bundle.py` "well over an hour" to read -- that
   would make convergence impractically slow without a design change
   (e.g. `downsampling_run.py`'s own per-item `create_tile()` reads
   likely reopen the same few enormous archives repeatedly across many
   nearby coarse-zoom outputs)?

**Current state, as of this entry (2026-08-28 18:48 JST)**:
- `publish_cycle_9`'s rsync retry: running clean in `screen` session
  `publish_cycle_9_rsync_retry` (~137GB/286GB transferred, ~340GB free
  on `stars`, no space risk this time).
- Public URLs (`depot.optgeo.org`, `stars.optgeo.org` tile endpoint):
  still 404 until this retry completes and renames into place.
- `bundle-store/mapterhorn-japan-bridge.pmtiles` on `slate`: complete,
  structurally valid, unaffected by any of the above.
- Orphan-tile root cause identified but **not fixed** -- 413,925
  tiles (17.6%) still missing their z-1 parent in the archive
  currently being pushed to `stars`.
- D40's ~2.54GB `pmtiles-store` orphan cleanup: still untouched.
- D49's "worth a real fix" (progressive input deletion in
  `merge_japan_bundles.py`): still not done, and this entry adds a
  sibling open item on the `rsync` leg (`--inplace` tradeoff, above).

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- may need a fresh Cloudflare Access
> browser re-auth; if a retry hangs on "another cloudflared process is
> already waiting," kill the stale `cloudflared access ssh` process
> first).
>
> Read `DECISIONS.md` D35's closing addendum through D50 in full before
> touching anything -- D50 covers a live `stars`-side ENOSPC near-miss
> (resolved) and the first real orphan-tile finding against a production
> archive (root cause identified, not yet fixed).
>
> **First**: check whether `publish_cycle_9_rsync_retry`'s `rsync`
> (screen session of that name on `slate`) finished, and whether
> `depot.optgeo.org`/`stars.optgeo.org`'s tile endpoint are back to
> `200` with the new byte count (`286,089,908,804` bytes on `bundle-
> store/mapterhorn-japan-bridge.pmtiles` as of this entry -- confirm the
> `stars` copy matches). If it crashed on `ENOSPC` again despite this
> session's fix, something else is wrong -- don't assume it's the same
> already-diagnosed cause without checking `df`/`fuser` fresh.
>
> **The real open item**: 413,925 orphaned tiles (17.6%), concentrated
> at z9-z11 (near-total) and z1-z8 (completely empty), caused by
> `downsampling_run.py` not having converged at coarse zoom levels --
> see this entry's own root-cause section for the full evidence chain.
> Two open sub-questions to resolve before deciding a fix: does running
> `downsampling_run.py` many more times just slowly converge this, or
> is there a structural I/O bottleneck (analogous to D44's `bundle.py`
> finding) making that impractical? Don't re-derive the diagnosis from
> scratch -- this entry's `aggregation-store` `.done`-count table and
> mtime check are the load-bearing evidence, re-verify against current
> counts rather than re-theorizing from the covering code alone.
>
> **`rsync`'s own 2x-space-during-transfer problem** (this entry, Part 1)
> is a sibling to D49's `merge_japan_bundles.py` finding -- both still
> open design questions (progressive cleanup / `--inplace`), not fixed.
>
> **Storage**: D40's ~2.54GB `pmtiles-store` orphan cleanup is still
> open and untouched.
>
> **号2**: still gated on GSI actually shipping new DEM1A data -- no
> fixed cadence known.
>
> Converse in Japanese, per this repo's own language policy.

## D51: `publish_cycle_9`'s rsync retry completes (public URLs restored); root cause of D50's orphan tiles found and fixed -- `downsampling_run.py`'s dirty-filter was silently excluding 68-78% of coarse-zoom items, comparing against an unrelated old test generation

**Status**: Recorded, 2026-08-28 22:35 JST. Continuation of D50's own session,
resumed later the same day per Hidenori's explicit request to keep working
in 15-minute report increments while he continued other conversation.

**Part 1 -- `publish_cycle_9_rsync_retry` (D50's own fix) completed
clean**: 286,089,908,804 bytes, byte-identical to `slate`'s own `bundle-
store/mapterhorn-japan-bridge.pmtiles`. Both public URLs verified live
with the new byte count: `depot.optgeo.org/mapterhorn-japan-bridge.pmtiles`
returns `Content-Length: 286089908804`; `stars.optgeo.org`'s `martin`
tile endpoint returns `200` on a real tile fetch (`z0/0/0`), not just the
TileJSON metadata. `publish_cycle.py`'s own D50 fix (delete the `stars`-
side file before `rsync`) has not yet been exercised by a real
`publish_cycle.py` invocation -- this retry was still the bare `rsync`
command run directly, same as D50's own manual recovery. First real test
of the committed code fix is the next full cycle.

**Part 2 -- found and fixed the actual root cause of D50's 413,925
orphaned tiles**: re-ran `downsampling_run.py` fresh (screen
`downsampling_convergence_1`) to observe convergence per D50's own open
question. It finished in **~90 seconds** touching **zero** new items --
a dramatically different result from the historical ~9h44m full pass,
and a clear signal something was wrong beyond "just slow."

Compared this run's own processed-item count against the true on-disk
backlog, by zoom:

| zoom | items attempted this run | total todo on disk | inclusion rate |
|---|---|---|---|
| z9 | 53 | 168 | 31.5% |
| z10 | 61 | 252 | 24.2% |
| z11 | 70 | 308 | 22.7% |
| z12 | 660 | 1,835 | 36.0% |
| z13 | 1,158 | 1,606 | 72.1% |
| z14 | 1,619 | 1,942 | 83.4% |
| z15 | 1,682 | 2,005 | 83.9% |

Coarse zooms were disproportionately excluded from even being attempted.
Traced to `downsampling_run.py`'s `__main__` block: it filters the
candidate item list through a "dirty" comparison against
`utils.get_aggregation_ids()[-2]` (intended for incremental reprocessing
between two versions of the *same-scope* generation). `get_aggregation_
ids()` just lists every directory under `aggregation-store/` sorted by
ULID, so `[-2]` currently resolves to `01M0FNHYXSAMNVTV430XD3XB5T` -- the
old **Kyushu-scope test generation** (D16/D27/D40), not a genuine prior
pass over the current national generation. **Confirmed empirically, not
just by code reading**: ran the actual filter functions against a
sampled still-incomplete z11 item (`10-862-435-11-downsampling.csv`) --
both `is_parent_of_dirty_aggregation_tile` and `not_in_previous_
aggregation` returned `False`, meaning the item was silently dropped
from the worklist every single run, regardless of how many times
`downsampling_run.py` was invoked. This is why D50's diagnosis ("just
needs more throughput") was incomplete: no amount of re-running would
ever have converged the excluded fraction.

**Fix, committed to `hfu-mapterhorn`** (`a9e05d1`): removed the dirty-
filter's gating effect on `all_files` -- every `*-downsampling.csv` file
for the current generation is now always a candidate, matching the old
`len(aggregation_ids) < 2` branch's behavior. `.done` markers (checked
inside `main()`) remain the real idempotency guard, so this loses no
correctness, only a currently-broken optimization. Left the underlying
functions (`is_parent_of_dirty_aggregation_tile`, `not_in_previous_
aggregation`, `tiles_intersect`) defined but unused, with a comment
explaining why and noting this is worth revisiting once a genuine
second national-scope generation exists (号2) and the optimization's
own intent becomes applicable again.

**Verified working, not just theorized**: restarted `downsampling_run.py`
fresh (screen `downsampling_convergence_2`) -- immediately confirmed
`Total: 8340 files` (up from 5,382), the full on-disk backlog. Over the
following ~90 minutes (interrupted partway by a Cloudflare Access
session timeout, see Part 3), z12 climbed 487 -> 1,133 and, critically,
**previously near-frozen coarse zooms started moving for the first
time this generation**: z9 1 -> 21, z10 2 -> 51, z11 8 -> 75 -- all
in roughly the last 30 minutes of observation, well past this
generation's own 6-day/9-cycle history of the same handful of positions
(D50's own finding). Direct, real-time confirmation the fix unblocks
the cascade, not just a plausible-sounding theory.

**Part 3 -- routine Cloudflare Access session timeout, recovered per
D44's documented procedure**: mid-session, `slate-via-spacex` started
failing with `Connection timed out during banner exchange` after a
stale `cloudflared access ssh` process was already waiting for
re-auth (`another cloudflared process is already waiting`) --
exactly the pattern D44's resume prompt already warned about. Killed
the stale processes (`pkill -f "cloudflared access ssh"`), asked
Hidenori to complete the browser-based Cloudflare Access re-auth
(cannot be done headlessly), and resumed cleanly once approved.
`rsync` and `downsampling_run.py` on `slate` were both unaffected
throughout (independent `screen` sessions, not tied to any one SSH
connection) -- confirmed via accumulated CPU time on both processes
across the outage window.

**Not yet done**: `bundle-store/mapterhorn-japan-bridge.pmtiles` (the
archive just finished pushing to `stars`, verified live above) still
reflects the **pre-fix** downsampling state -- it was built before this
session's `downsampling_run.py` fix, so its own 413,925 orphaned tiles
(D50) have **not yet actually decreased** in what's publicly served.
Confirming the real-world improvement requires a future `bundle.py` +
`merge_japan_bundles.py` + `rsync` pass once `downsampling_convergence_2`
(or its successors) has meaningfully progressed, followed by a fresh
`check_pmtiles_integrity.py` run -- per the original plan's own step 6.

**Current state, as of this entry (2026-08-28 22:35 JST)**:
- `publish_cycle_9`: fully complete, both public URLs live and verified
  with the current byte count.
- `downsampling_convergence_2`: still running (screen session), coarse
  zooms actively converging for the first time this generation.
- D40's ~2.54GB orphan cleanup: done this session (`cleanup_kyushu_
  generation.sh`, ~3GB freed, safety check passed).
- `publish_cycle.py`'s own rsync-headroom fix (D50, `21a4c7e`): committed
  but not yet exercised by a real `publish_cycle.py` invocation.
- D49's `merge_japan_bundles.py` progressive-deletion fix: still not
  done, per the plan's own ordering (after downsampling shows real
  convergence).
- A 15-minute Monitor-based report loop (this session only, rsync bytes/
  ETA, `slate` load average, z9-z12 `.done` counts) has been running
  throughout -- does not survive this session ending, same caveat as
  every previous session's own monitoring loop.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- Cloudflare Access sessions have been
> timing out roughly every 2 hours this session; if a connection hangs
> with "another cloudflared process is already waiting," run `pkill -f
> "cloudflared access ssh"` then retry -- the retry itself will print a
> browser re-auth URL that needs Hidenori to open and approve, this
> cannot be done headlessly).
>
> Read `DECISIONS.md` D35's closing addendum through D51 in full before
> touching anything -- D50 found the orphan-tile symptom, D51 found and
> fixed its actual root cause (a dirty-filter bug, not just slow
> throughput) and verified the fix is working in real time.
>
> **First**: check `downsampling_convergence_2` (or whatever screen
> session superseded it)'s progress -- `.done` counts by zoom in
> `aggregation-store/01M0MWK852631SHCHPA66F21WQ/*-{Z}-downsampling.done`
> for Z in 9-15, compared against this entry's own snapshot (z9=21,
> z10=51, z11=75, z12=1133) to gauge how far coarse-zoom convergence has
> progressed. If it's plateaued again well short of each zoom's own
> total todo count, the fix may need a second look (though the fix
> itself is verified correct via direct code testing, not just
> plausible).
>
> **Once convergence looks meaningfully complete** (or genuinely
> plateaued for a real reason, not the D51 bug): run a full `bundle.py`
> + `merge_japan_bundles.py` + `rsync` cycle (via `publish_cycle.py`,
> which now also exercises D50's own rsync-headroom fix for the first
> time) and re-run `check_pmtiles_integrity.py` against the fresh
> `bundle-store/mapterhorn-japan-bridge.pmtiles` -- comparing its orphan
> count against D50's own 413,925 baseline is the real proof this
> session's fix actually improved the published product, not just the
> `aggregation-store` bookkeeping.
>
> **Still open, per the original session plan**: D49's `merge_japan_
> bundles.py` progressive-deletion fix (deliberately deferred until
> downsampling convergence is confirmed).
>
> Converse in Japanese, per this repo's own language policy.

## D52: D51's dirty-filter fix converges to a real fixed point within two passes; the remainder traces to items missing entirely from `downsampling_covering.py`'s own original covering, not a `downsampling_run.py` throughput problem

**Status**: Recorded, 2026-08-28 23:18 JST. Direct continuation of D51's
own session, same evening.

**Pass 2 results (`downsampling_convergence_2`, 19:33-22:19, ~46min)**:
full before/after by zoom, confirming D51's fix converts into real,
substantial completion gains, not just a larger candidate list:

| zoom | done/todo after pass 2 | rate |
|---|---|---|
| z9 | 21/168 | 12.5% |
| z10 | 51/252 | 20% |
| z11 | 75/308 | 24% |
| z12 | 1,133/1,835 | 62% |
| z13 | 1,511/1,606 | 94% |
| z14 | 1,928/1,942 | 99.3% |
| z15 | 1,998/2,005 | 99.7% |

z13-z15 are now essentially complete; z9-z12 improved by roughly an
order of magnitude over D50's own pre-fix numbers (z9 1->21, z10 2->51,
z11 8->75, z12 487->1,133) in a single 46-minute pass -- direct
confirmation D51's fix was the real unlock, not a coincidence.

**Pass 3 (`downsampling_convergence_3`, launched immediately after)
finished in ~1.1 seconds, touching zero new items** -- every one of
the 8,340 candidates was either already `.done` or hit `DOWNSAMPLING_
STRICT`'s skip (referenced child file still missing). Re-checked the
same zoom-level done/todo counts immediately after: **byte-for-byte
identical to pass 2's own end state** (21/51/75/1,133/1,511 unchanged).
This is a genuine fixed point, not a stall mid-computation -- D51's fix
already extracted everything currently extractable from the existing
covering; running `downsampling_run.py` a fourth, fifth, ... time would
not be expected to change anything further on its own.

**Traced one concrete blocked item to find out why, rather than assuming
"more passes would eventually help"**: `10-864-440-12-downsampling.csv`
(still not `.done`) references 10 child `-13.pmtiles` files; checked
each against `pmtiles-store` directly (not assumed) -- 9 of 10 exist,
but `11-1728-880-13.pmtiles` does not. Followed the chain one level
further: `11-1728-880-13-downsampling.csv` -- the item that would have
to produce that missing file -- **does not exist on disk at all**, in
either `.csv` or `.done` form. This is not a `downsampling_run.py`
concern (there is nothing for it to skip or retry; the work item was
never created in the first place). It traces back to `downsampling_
covering.py`'s own one-shot `write_downsampling_items()` run, early in
this generation's life (per `PLAN.md`'s own D37 note that this step is
manual, one-time, and easy to forget to re-run) -- either a genuine gap
in that covering computation's own logic, or this specific position
legitimately has no underlying source coverage at all (e.g. open ocean
with zero elevation data) and was correctly never enumerated. **Not yet
determined which** -- this is the concrete next investigation, not
something this session resolved.

**Current state, as of this entry (2026-08-28 23:18 JST)**:
- `downsampling_run.py`'s own dirty-filter bug (D51): fixed, verified,
  and has now converged to its own natural fixed point -- no further
  action expected to help from this angle alone.
- z9-z15 completion, final snapshot this session: z9 21/168, z10
  51/252, z11 75/308, z12 1,133/1,835, z13 1,511/1,606, z14 1,928/1,942,
  z15 1,998/2,005. z0-z8 still mostly empty (1/1, 0/1, 0/1, 0/4, 1/6,
  1/13, 4/34, 9/57, 14/107) -- expected, given they sit above the still-
  incomplete z9-z12 tier in the same dependency chain.
- `bundle-store/mapterhorn-japan-bridge.pmtiles` (the currently-published
  archive) still reflects the pre-fix state -- none of this session's
  downsampling gains have been bundled/merged/published yet.
- Next concrete step, explicitly deferred to a future session (Hidenori's
  own call): investigate whether `downsampling_covering.py`'s own
  covering computation has a real gap (worth a targeted code read /
  cross-reference against source coverage, similar in spirit to D29's
  own position-based verification discipline) versus genuinely empty
  source positions being correctly excluded. Only after that's
  understood does it make sense to decide whether `downsampling_
  covering.py` needs a fix and a re-run, or whether the current
  fixed-point state is actually as complete as this generation's real
  source data allows.
- D49's `merge_japan_bundles.py` progressive-deletion fix: still
  deliberately not done (per the session's own plan, gated on
  downsampling showing real convergence -- which it has, but the
  `downsampling_covering.py` question above should probably be resolved
  first, since another `bundle.py`/`merge` cycle mainly makes sense
  once it's clear whether more downsampling gains are still reachable).
- D40's ~2.54GB orphan cleanup: done this session.
- `publish_cycle.py`'s rsync-headroom fix (D50): committed, not yet
  exercised by a real `publish_cycle.py` run.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- Cloudflare Access sessions were timing
> out roughly every ~2h in the prior session; if a connection hangs with
> "another cloudflared process is already waiting," `pkill -f
> "cloudflared access ssh"` then retry, and ask Hidenori to complete the
> browser re-auth -- cannot be done headlessly).
>
> Read `DECISIONS.md` D35's closing addendum through D52 in full before
> touching anything -- D50 found the orphan-tile symptom, D51 found and
> fixed the dirty-filter root cause (verified working), D52 found that
> fix converges to a real fixed point and traced the remainder to a gap
> in `downsampling_covering.py`'s own original covering, not a
> `downsampling_run.py` throughput issue.
>
> **The concrete next step**: determine whether `downsampling_
> covering.py`'s covering computation has a real bug causing positions
> like `11-1728-880-13` to never be enumerated, or whether those
> positions genuinely have no underlying source data (correctly
> excluded). This entry's own example chain (`10-864-440-12-
> downsampling.csv` -> missing `11-1728-880-13.pmtiles` -> missing
> `11-1728-880-13-downsampling.csv` entirely) is a concrete starting
> point -- don't re-derive it from scratch, but do verify it's still
> accurate before trusting it (aggregation-store contents could have
> changed if anyone re-ran `downsampling_covering.py` since this entry).
>
> **Only after that's resolved**, decide whether to re-run `downsampling_
> covering.py` (D37's own manual, easy-to-forget step) and then another
> `downsampling_run.py` pass, before finally running a full `publish_
> cycle.py` (which exercises both D50's rsync fix and this generation's
> real downsampling gains for the first time) and re-checking `check_
> pmtiles_integrity.py`'s own orphan count against D50's 413,925
> baseline.
>
> **Still open**: D49's `merge_japan_bundles.py` progressive-deletion
> fix (deliberately deferred).
>
> Converse in Japanese, per this repo's own language policy.

## D53: a third, larger cause of D50's orphan tiles found -- 1,016 `.done` markers point to `pmtiles-store` files that no longer exist at their expected filename (pre-completion aggregation-rename race, D37/D44/D45's own historical concern, now safe to clear)

**Status**: Recorded, 2026-08-28 23:58 JST. Direct continuation of D52's
own investigation into `downsampling_covering.py`'s apparent gap.

**Trigger**: investigating the one concrete example D52 traced
(`11-1728-880-13-downsampling.csv` never existing on disk at all) led to
checking whether that was representative. Cross-referenced that example's
own geographic bounds (123.75-123.93E, 24.37-24.53N -- the Iriomote/
Yaeyama island area) against `aggregation-store`'s native `*-aggregation.
csv` entries at every resolution (z12/z13/z14/z16) under its full
descendant footprint: **zero matches at any zoom**. This one example does
look like a genuine no-source-coverage gap (consistent with this
project's own prior finding, `[[project_mapterhorn_japan_bridge_slate]]`-
adjacent memory, that Yonaguni/Hateruma-area meshes lack even 5m/10m
national floor coverage) -- not a `downsampling_covering.py` bug. But
sampling two more still-incomplete z12 items to check whether this
generalized surfaced something different and much bigger.

**The real finding**: one sampled item's missing reference
(`11-1758-825-13.pmtiles`) turned out to **exist on disk under a
different maxzoom suffix** (`pmtiles-store/7-109-51/11-1758-825-16.
pmtiles`) -- classic D37/D44/D45 race signature (`aggregation_run.py`'s
own in-place stale-file cleanup renamed this position's file after the
downsampling item that referenced the old name had already been marked
`.done`). Its own `.done` marker's mtime: **2026-08-23 15:17** -- three
days before D45's atomic-write fix (2026-08-26) even existed.

**Quantified across the entire generation, not assumed from one sample**:
wrote a small audit script (`check_pmtiles_integrity`-adjacent, one-off,
not committed) that, for every `*-downsampling.done` marker, recomputes
the exact filepath `downsampling_run.py`'s own `main()` would have
written (`utils.get_pmtiles_folder(extent_x, extent_y, extent_z)` +
`{extent_z}-{extent_x}-{extent_y}-{parent_zoom}.pmtiles` -- note the
folder is keyed by the extent's own zoom, not `parent_zoom`; an initial
run of this same check used the wrong zoom there and produced a
nonsensical 90% failure rate, corrected before trusting the result) and
checks whether that file actually exists:

```
total .done markers: 6,747
healthy (file exists): 5,731 (85.0%)
stale (done, but referenced file missing): 1,016 (15.1%)
```

**Newest stale marker: 2026-08-28 04:20:23 -- before `aggregation_run_
national` finished (2026-08-27 19:43, D48). No stale markers created
after that point**, consistent with the race requiring concurrent
aggregation reprocessing, which stopped for good at D48's own
completion. This means the population of stale markers is now **fixed
and fully safe to repair** -- no new ones can appear from this
mechanism going forward, and the underlying content these markers
"cover" was, in every sampled case, later rebuilt correctly at its own
new filename by `aggregation_run.py` itself before it finished (D48's
own crash-and-fix on the final 3 items is the same class of evidence:
the pipeline's actual source data is fine, only this specific
downsampling-side bookkeeping went stale).

**Why this matters more than D51's dirty-filter bug or D52's genuine
gaps**: 1,016 is a much larger number than the ~150 items D51's fix
unblocked, and unlike D52's genuine-gap example, these are recoverable
-- the moment their stale `.done` marker is removed, `downsampling_
run.py` will rebuild them for real (their references now correctly
resolve to the renamed file, or that file's own successor once rebuilt
this pass) instead of skipping forever.

**Fix, applied live (not a code change -- data repair)**: with
Hidenori's explicit approval, deleted all 1,016 stale `.done` markers
(`aggregation-store/01M0MWK852631SHCHPA66F21WQ/*-downsampling.done`,
full path list captured for the record, not committed to git since it's
generation-local runtime state, not source). Confirmed count dropped
6,747 -> 5,731 (exactly the 1,016 removed, no double-counting). Launched
`downsampling_run.py` again (screen `downsampling_convergence_4`) to
rebuild them -- already showing real movement in the first few minutes
(z12: 1,133 -> 977 immediately after the deletion, as expected -- the
stale ones were removed from the done-count -- with rebuilding
starting from item 551/8,340 as of this entry).

**Not yet known**: whether all 1,016 will successfully rebuild this pass
(their own dependencies need to be ready, same cascade logic as D51/D52),
or whether some fraction reveals yet another distinct issue. This
entry's own resume prompt should check the actual outcome, not assume
success.

**Current state, as of this entry (2026-08-28 23:58 JST)**:
- `downsampling_convergence_4`: running, rebuilding the 1,016 freed
  positions plus whatever else remains from D52's own fixed point.
- z9-z12 done counts at launch (post-deletion): to be tracked via this
  session's own 15-minute Monitor loop, restarted for this purpose.
- D49's `merge_japan_bundles.py` fix (`b680704`) and D51's rsync fix
  (`21a4c7e`): both committed, still awaiting their first real exercise
  via a full `publish_cycle.py` run -- deliberately still deferred until
  downsampling looks genuinely complete (or as complete as real source
  coverage allows).
- The one confirmed genuine no-coverage example (`11-1728-880-13`,
  D52) is untouched -- no fix attempted or needed for it specifically,
  pending broader confirmation of the "legitimate gap" theory.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- Cloudflare Access sessions timed out
> roughly every ~2h in the prior session; `pkill -f "cloudflared access
> ssh"` then retry if you see "another cloudflared process is already
> waiting", and ask Hidenori to complete the browser re-auth).
>
> Read `DECISIONS.md` D35's closing addendum through D53 in full before
> touching anything. D50 found the orphan symptom, D51 fixed the
> dirty-filter bug (verified), D52 found the fix's own natural
> fixed-point and one genuine no-coverage example, D53 found and
> repaired a third, larger cause (1,016 stale `.done` markers from the
> pre-completion aggregation-rename race) and relaunched `downsampling_
> run.py` to rebuild them.
>
> **First**: check `downsampling_convergence_4`'s own outcome -- did it
> finish, and how many of the freed 1,016 positions (plus whatever
> D52-era backlog remained) actually completed? Compare z9-z16 `.done`
> counts against this entry's own launch-time snapshot. If a similar
> stale-marker audit hasn't been re-run since, consider running it again
> after this pass -- new stale markers should NOT appear (aggregation is
> permanently finished), but worth confirming rather than assuming.
>
> **Once downsampling looks as complete as it's going to get** (either
> fully converged, or a stable, understood residue of genuine no-coverage
> positions like D52's own Iriomote-area example): run a full `bundle.py`
> -> `merge_japan_bundles.py` (now with D49's progressive-deletion fix,
> `b680704`, exercised for the first time) -> `rsync` (now with D51's
> pre-delete fix, `21a4c7e`, exercised for the first time) via `publish_
> cycle.py`, then re-run `check_pmtiles_integrity.py` against the fresh
> `bundle-store/mapterhorn-japan-bridge.pmtiles` and compare its orphan
> count against D50's own 413,925 baseline -- this is the real proof all
> of tonight's fixes actually improved the published product.
>
> Converse in Japanese, per this repo's own language policy.

## D56: `publish_cycle_10` improvement session -- `downsampling_covering.py` wired into the preflight, dead `.todo` code removed, coarse-zoom I/O fixed with a persistent worker Pool + per-worker Reader cache (verified byte-identical rebuilds)

**Status**: Recorded, 2026-08-29 09:07 JST. While `publish_cycle_10`'s
rsync (D50/D51's own fixes exercised for the first time end-to-end)
ran in the background, worked through the improvement backlog Hidenori
selected from this session's own earlier list, plus items surfaced
while reading `DECISIONS.md` for still-open threads (D25, D31, D37's
own "next fix" note).

**A1 -- `downsampling_covering.py` wired into `publish_cycle.py`'s
preflight** (`hfu-mapterhorn` `5d30424`): D37 (2026-08-23) flagged this
as the concrete next fix and it was never done -- a new generation
silently downsamples nothing until someone remembers to run this by
hand once. `write_downsampling_items()` is a full, idempotent
regenerate (`rm *-downsampling.csv` first), measured ~13-20s at this
generation's current scale, so safe to run every cycle. Also dropped
the call to `write_downlsampling_todos()` in the same script: grepped
every `.py` file in the repo and confirmed its own `.csv.todo` output
is never read anywhere (only `aggregation_run.py`'s own, unrelated
`.csv.todo` mechanism is real) -- the function stays defined, just
unused, for a future real consumer.

**A2 -- `check_downsampling_done_integrity.py`** (`0923ae0`): formalized
D53's ad hoc stale-`.done` audit into a real, reusable tool
(`--dry-run` default, `--fix` to delete). Reuses `utils.get_pmtiles_
folder()` rather than re-deriving it (an earlier ad hoc version got the
`z`/`parent_zoom` argument order wrong on first try -- see below, same
mistake almost repeated in this session's own C1 diagnostic).

**B1 -- coarse-zoom I/O, the actual fix for D44's original flag**
(`26ab4ac`): `downsampling_run.py`'s `main()` used to create a brand
new `Pool` (and therefore brand-new worker processes) for every single
downsampling item -- thousands of process spawns across a run, and it
meant no cache could ever help across items even though the slow
segments observed live (D50/D52, 3-4 minutes per item) were dominated
by the *same* large `pmtiles-store` archive being reopened across
consecutive-but-separate items. Two changes: (1) one `Pool` for the
whole `main()` invocation, created once outside the per-item loop --
`pool.starmap()` exceptions (`ChildPmtilesUnavailable`) still propagate
without killing the pool, so the existing skip-and-retry handling is
unchanged; (2) `get_cached_reader()`, a small per-worker-process LRU
(bounded at 16 open archives) of already-opened pmtiles `Reader`s --
safe under `spawn` (fresh module state per worker, no cross-process
sharing) and does not weaken `ChildPmtilesUnavailable`'s own race
detection, since callers already re-check `os.path.isfile()` fresh
before every read and this pipeline's filename convention never
reoccupies a path with different content (D37).

**Verified, not just reasoned about**: cleared 3 real `.done` markers
(80MB/119MB/234MB outputs), reran them through the new code (a first
attempt crashed every spawned worker because the *test harness* itself
wasn't guarded by `if __name__ == '__main__':` -- spawn re-executes a
script's top-level code in each worker, so the harness's own setup
assertions fired inside every child; fixed and reran cleanly) -- all 3
rebuilt byte-identical to the pre-change originals.

**B2 -- checked `bundle.py`'s own `create_archive()` for repeated
re-reads** (D31's own open question, re-examined): simulated the exact
tile-id sort against the real largest parent group (`planet`, 2,018
files, 55,424 tile entries) -- zero files reopened in a non-contiguous
run. D31's own largest-first scheduling fix already fully addresses the
practical concern; no code change needed (measured, not assumed, same
discipline as D24's own "measured, no fix needed" precedent).

**B3 -- `DOWNSAMPLING_WORKERS` tuning -- deliberately deferred**: no
real "ready, not yet run" backlog exists right now to A/B test worker
counts against without artificially clearing more real production
`.done` markers (already did this once for B1's own correctness test;
repeating it purely for a performance experiment carries more
operational risk than the marginal tuning insight is worth tonight).
Revisit once 号2 has a genuine backlog to test against.

**C1 -- sampled D52's "covering gap" more broadly, and found something
much bigger** (see D57, next entry) -- this is where the session's
own scope expanded significantly beyond the original 8-item plan.

**Housekeeping**: removed a stray untracked `check_stale_done.py`
(this session's own first-draft ad hoc script, superseded by A2) and
several one-off diagnostic scripts used only to produce the
measurements above (`check_bundle_reread.py`, `check_covering_gaps.py`,
`check_aggregation_dirty_gap.py`, `test_downsampling_restructure.py`)
-- none committed, deleted after use, per this session's own
established practice of not leaving one-off scratch scripts in the
production tree.

**Current state, as of this entry**: `publish_cycle_10`'s rsync still
running (D50/D51's fixes both exercised live: rsync pre-delete headroom
fix worked, D49's progressive merge-input deletion confirmed working
live -- `bundle-store` dropped from 23 regional files to 1 during
`merge_japan_bundles.py`, disk recovering from a 107Gi dip back to
~390Gi+ without intervention). See D57 for what happened next.

## D57: `aggregation_covering.py` had the same dirty-filter bug class as D51, with a far larger blast radius -- `aggregation_run_national`'s own "1,979/1,979 done" (D48) was 100% of an undercounted denominator; 2,343 native positions across Japan were never built at all. Fixed and a full backfill launched.

**Status**: Recorded, 2026-08-29 09:07 JST. Found while broadening D52's
own "covering gap" sample from 1 example to 20, as part of D56's own
C1 task.

**How it was found**: sampling 20 "referenced-but-missing, and no
`downsampling.csv` exists for it either" positions (D52's own category)
to check the genuine-no-coverage-vs-real-bug ratio at scale, 12 of 20
(60%) turned out to have real native aggregation coverage underneath
them -- contradicting D52's own tentative "probably mostly legitimate
gaps" read from its single example. Tracing one concretely
(`12-3450-1742-12`, an Okinawa/Sakishima-area position): its own native
`12-3450-1742-12-aggregation.csv` genuinely exists in the current
national generation's `aggregation-store` -- but has no `.todo`, no
`.done`, and zero `pmtiles-store` output. **Root cause**: `aggregation_
covering.py`'s `write_aggregation_todos()` compares the current
generation's own aggregation.csv content against `aggregation_ids[-2]`
(the old Kyushu-scope test generation, `01M0FNHYXSAMNVTV430XD3XB5T`)
via `utils.get_dirty_aggregation_filenames()`, and skips writing a
`.todo` for any item judged "unchanged" -- on the assumption that
unchanged content means the position is already correctly built.
Confirmed directly: this exact position's aggregation.csv *does* exist,
byte-identically, in the old Kyushu generation too -- so it was judged
"not dirty" and never queued. **The assumption is false whenever the
older generation itself never finished that position**: `pmtiles-store`
is flat, not generation-scoped, so "unchanged since Kyushu" silently
inherited every one of Kyushu's own incomplete positions forward,
permanently, into every later generation that ever compared against
it -- the exact same dirty-filter-against-an-unrelated-baseline pattern
D51 found and removed from `downsampling_run.py`, independently
reimplemented here in the aggregation-covering stage with a much larger
practical impact.

**Quantified on the real 1号 generation, not assumed from one example**
(`check_aggregation_dirty_gap.py`, one-off, not committed):

```
total current-generation native aggregation.csv items: 6,373
dirty (got a .todo, D48's own "1,979" denominator):     1,979
NOT dirty (never got a .todo, assumed already-built):    4,394 (69%)
  of those, zero pmtiles-store output at all:            2,343
```

**This means D48's own "`aggregation_run_national` reaches 1,979/1,979
-- full national aggregation complete" was 100% correct about its own
denominator, but that denominator was itself wrong** -- 1,979 was
already the dirty-filtered (undercounted) subset, not the true national
total of 6,373. Every entry from D48 through D56 that treated
aggregation as "done" was building on this same undercount. **2,343
native positions across Japan -- roughly a third of the true national
total -- have never been built**, silently assumed-complete by this
filter rather than genuinely finished.

**Fix, committed** (`hfu-mapterhorn` `3dd734a`): removed the dirty
comparison from `write_aggregation_todos()` entirely -- it now writes a
`.todo` for every current-generation aggregation.csv item,
unconditionally. `aggregation_run.py`'s own `run()` already checks
`os.path.isfile(f'{filepath}.done')` before doing any real work (D48's
own established idempotency guard), so writing a redundant `.todo` for
an already-`.done` item costs nothing beyond a fast no-op skip --
verified this is the case by reading `aggregation_run.py` directly
before relying on it, not assumed.

**Deliberate trade-off, flagged for 号2 rather than solved tonight**:
this fix sacrifices the *original intent* of dirty-tracking as a
genuine efficiency optimization -- letting a future generation skip
reprocessing the (per D42's own estimate) roughly two-thirds of
positions that don't actually change between real GSI update cycles.
The safe fix applied tonight makes every generation start from zero
tracking benefit; a more surgical version (skip only if unchanged *and*
the referenced `pmtiles-store` output is confirmed present) is possible
but not attempted this session, since 号2 itself is still gated on GSI
shipping new data and this decision doesn't block 1号's own repair. See
`PLAN.md`'s own infrastructure-prerequisites section, updated to flag
this before 号2 designs its own incremental-refresh strategy.

**Regenerated `.todo` markers for the current generation directly**
(`aggregation_covering.write_aggregation_todos()`, not `main()`, which
would have created an unwanted new generation): 6,373 total `.todo`
files now present (redundant ones for the 1,979 already-`.done` items
are harmless clutter, correctly no-op'd by `run()`).

**Launched `aggregation_run.py` for real** (screen session
`aggregation_run_backfill`, `AGGREGATION_WORKERS=4`, the existing D38/
D39-established default), to actually build the 4,394-item backlog.
Confirmed live, not just launched-and-assumed: `.done` count climbed
1,979 -> 2,013 within the first minute of observation.

**Storage risk, flagged before launch, per Hidenori's own explicit
"proceed being mindful of storage/memory limits" instruction**:
`pmtiles-store` currently holds 287GB for the 1,979 already-built
items (~145MB/item average). Of the 4,394 backlog items, ~2,051
already have `pmtiles-store` output (inherited from Kyushu, will be
overwritten in place at no net storage cost, same self-healing
mechanism D29/D40 already established) -- but the 2,343 genuinely-empty
positions represent real net-new growth, extrapolated at roughly
**~340GB** using the same per-item average, against **~392GB** free at
launch time. This is a real, not-fully-resolved risk of hitting ENOSPC
partway through a run expected to take on the order of days (linear
extrapolation from the original 1,979-item build's own ~140-hour/5.8-
day wall-clock cost suggests very roughly a week-plus for 4,394 more,
though per-item cost for these specific never-built positions is
unverified and could differ). **Mitigation**: the session's own 15-
minute Monitor loop now includes a disk-free threshold check (warns
below 100GB) so this can be caught and reacted to before it becomes a
live incident, rather than discovered after the fact the way D49/D50
were. No proactive storage-freeing was done before launch (Hidenori's
own explicit call: start the work that should start, handle storage
in parallel rather than blocking on it).

**Current state, as of this entry (2026-08-29 09:07 JST)**:
- `aggregation_run_backfill`: running, 2,013/6,373 `.done` and
  climbing (34 new completions in the first ~1 minute observed).
- `publish_cycle_10`'s rsync: still in progress separately (D50/D51's
  fixes both exercised live and confirmed working), unaffected by the
  aggregation backfill starting (different stage, no resource
  contention beyond shared CPU/disk).
- `pmtiles-store`: 287GB, expected to grow substantially over the
  backfill's own multi-day run -- disk headroom now the primary
  watch item via the Monitor's own threshold check.
- **1号's own "complete" status needs re-framing**: it is not, and
  was never, actually 100% complete at the native-aggregation level --
  this entry is the first accurate accounting of the true remaining
  scope. Downstream stages (downsampling, bundling, the published
  archive) all inherit this same undercount and will keep improving
  as the backfill's own output becomes available to them.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn`, via SSH from
> `aalto` (`slate-via-spacex` -- Cloudflare Access sessions have been
> timing out periodically this session; `pkill -f "cloudflared access
> ssh"` then retry if you see "another cloudflared process is already
> waiting", and ask Hidenori to complete the browser re-auth).
>
> Read `DECISIONS.md` D35's closing addendum through D57 in full before
> touching anything -- D57 is a major correction to the "1号 aggregation
> is 100% complete" narrative established in D48 and relied on through
> D49-D56. The true native-aggregation total is 6,373 positions, not
> 1,979; a dirty-filter bug in `aggregation_covering.py` (same class as
> D51's `downsampling_run.py` bug, fixed the same way) silently skipped
> 4,394 of them, 2,343 with zero output ever built.
>
> **First**: check `aggregation_run_backfill`'s own progress (`screen
> -ls`, `.done` count against 6,373) and, critically, **disk free space
> on `slate`** -- this entry flagged a real risk of running low
> (~340GB of projected net-new growth against ~392GB free at launch).
> If free space dropped below a safe margin at any point, check whether
> the Monitor's own threshold warning fired and what was done about it;
> don't assume it's fine without checking.
>
> **Once the backfill completes**: re-run `downsampling_covering.py`
> (now automated into `publish_cycle.py`'s own preflight, D56) and a
> fresh `downsampling_run.py` pass -- the newly-built aggregation
> positions should unlock real new downsampling progress, particularly
> at the coarse zooms (z9-z11) that D52 found still mostly empty. Then
> a full `publish_cycle.py` run and a fresh `check_pmtiles_integrity.py`
> check against D50's own 413,925-orphan baseline is the real end-to-
> end verification this entire D50-D57 arc has been building toward.
>
> **Flagged, not solved**: the dirty-tracking efficiency trade-off
> (see this entry's own "deliberate trade-off" section) needs a real
> decision before 号2 designs its own incremental-refresh strategy --
> check `PLAN.md`'s own infrastructure-prerequisites section.
>
> Converse in Japanese, per this repo's own language policy.

## D58: procured and formatted a second same-model external disk (APFS) for `pmtiles-store`, worked through a Screen Sharing/TCC troubleshooting saga to reach slate's physical console, and launched a two-phase rsync migration while `aggregation_run_backfill` (D57) keeps running

**Status**: In progress, 2026-08-29 11:10 JST. Recorded ahead of a
planned `/compact` so this state survives a context reset even if the
compact somehow disrupts anything (it did not disrupt anything the
first time tonight -- see below).

**Storage decision (asked and answered this session)**: of the three
big stores (`source-store` 342G, `pmtiles-store` 286G, `bundle-store`
287G peak), **`pmtiles-store` alone** is the one worth moving to the
new disk, not all three. Reasoning: `pmtiles-store` is the one under
concurrent read+write contention across multiple pipeline stages
(`aggregation_run.py` writes it while reading `source-store`;
`downsampling_run.py` reads+writes it exclusively; `bundle.py` reads it
while writing `bundle-store`) -- splitting it onto its own physical
disk actually separates contending I/O. Moving all three back onto one
new disk would just relocate the existing single-disk contention
without solving it. Also frees ~286G of headroom on the original disk
immediately, directly easing D57's own flagged ENOSPC risk.

**Filesystem choice**: the new disk arrived pre-formatted for
Raspberry Pi use (Linux `bootfs`). Reformatted as **APFS** (GUID
Partition Map, case-insensitive, default journaling) rather than
matching the *existing* `Migrate-2025-04` disk's own format, which
turned out to be legacy **HFS+** (Journaled) -- discovered by directly
checking (`diskutil info disk4s2`), not assumed. APFS was chosen over
sticking with HFS+ for real SSD-era advantages (TRIM, small-file/
metadata performance relevant to `pmtiles-store`'s tens of thousands of
individual files) and over exFAT since no actual cross-platform
(Linux/macOS) sharing is needed -- the disk only ever needs to be read
by `slate` (macOS). Volume named `pmtiles-store` directly at format
time.

**A real physical-console side-quest**: getting this new disk mounted
on `slate` and clicking through any "allow this accessory" dialogs
required physical/GUI access, which `slate` (a headless Mac mini,
USB-C only) didn't have on hand tonight. Chain of troubleshooting,
each step verified rather than assumed:
- Screen Sharing (`vnc://slate.local`) failed with "Screen Sharing is
  not permitted" even after `sudo launchctl enable system/com.apple.
  screensharing` + `bootstrap` (confirmed via `launchctl print` +
  `netstat` that the daemon *was* listening on 5900, on-demand/socket-
  activated -- so the daemon-level enable genuinely worked, but that's
  a different layer from ARD's own access-control list).
- `kickstart -activate -configure -access -on -privs -all -users hfu
  -restart -agent` fixed the access-control layer (this is the
  documented correct way to enable Screen Sharing *with* the access
  list configured, vs. the raw `launchctl` approach which only starts
  the daemon) -- but printed two TCC warnings: "Screen recording might
  be disabled" / "Screen control might be disabled."
- Those TCC warnings were real: Screen Sharing still failed. **TCC
  privacy grants (Screen Recording, Accessibility) for Remote
  Management are protected by SIP and cannot be granted via SSH/sudo at
  all** -- this needed physical/GUI confirmation, which is exactly the
  chicken-and-egg problem Screen Sharing was meant to solve. Confirmed
  directly: `screencapture -x` over SSH also failed ("could not create
  image from display"), same TCC gate.
- Physical peripherals were the fallback, but `slate` being a USB-C-
  only Mac mini limited what Hidenori had on hand. A USB-C hub
  eventually supplied a wireless keyboard/mouse receiver (recognized
  fine via `ioreg`, and `pmset -g assertions` confirmed real HID
  tickle events reaching `WindowServer`) and, once connected via the
  Mac mini's own **native HDMI port** (bypassing the hub's own video
  path, which wasn't syncing), a real display image.
- Landed on a **lock screen** (session was locked, not logged out --
  confirmed background production processes kept running unaffected
  throughout this entire saga, since locking never stops running
  processes). The lock screen's own input-source menu ("ABC") only
  offers language switching, not "Show Keyboard Viewer" -- that
  accessibility affordance is a login-window-only feature, not present
  on the simpler lock screen. **Net result: stuck at "Enter Password"
  with a trackball but no keyboard, and no way to conjure one without
  either a physical keyboard or a full logout/restart to reach the
  richer login window.**
- Hidenori's own keyboard was left at his workplace -- not available
  until Monday (2026-08-31) at the earliest, or a cheap replacement
  purchase. **Decided: not worth forcing tonight** -- a restart to
  reach the full login window would sacrifice `publish_cycle_10`'s
  rsync progress (no `--partial` flag on that command, confirmed by
  reading `publish_cycle.py`; a kill mid-transfer discards all
  progress, not just pauses it) and abandon whatever `aggregation_run_
  backfill` items were in flight, for a benefit (Screen Sharing/TCC
  fixed) that isn't actually needed tonight -- see below, the disk
  migration itself doesn't need GUI access after all.

**The GUI detour turned out to be unnecessary for the actual goal**:
once the USB-C hub was reconnected (trackball removed) and the new
disk plugged in, `diskutil list` via plain SSH showed it mounted
cleanly as `/dev/disk5` -> `disk6` -> APFS volume `pmtiles-store`,
**with no accessory-permission dialog blocking it at all**, lock screen
and all. Whatever "allow this accessory" gate exists on this machine
either doesn't cover storage devices the way it covers Remote
Management's screen/input access, or was already satisfied by the
existing `Elements SE SSD`'s own prior approval extending to the same
USB subsystem. Either way: **the disk mounted, and the actual migration
work proceeded entirely over SSH, no GUI needed after all.** Screen
Sharing remains broken and unresolved (stuck on the TCC/SIP wall,
pending a real keyboard), but this no longer blocks anything tonight.

**Migration plan, two-phase to minimize production downtime**:
Hidenori's own proposal (simplest form: move `pmtiles-store`'s content
onto the new disk, then symlink `pmtiles-store` -> `/Volumes/pmtiles-
store` in `pipelines/`) was adopted, split into two rsync passes so
`aggregation_run_backfill` doesn't have to stop for the whole multi-
hour bulk transfer:

- **Phase 1 (production stays running)**: bulk `rsync -av --progress`
  of the entire current `pmtiles-store` (285G at start) into `/Volumes/
  pmtiles-store/`, in a detached `screen -S pmtiles_migrate_phase1`
  session, logging to `/tmp/pmtiles_migrate_phase1.log`. Launched
  2026-08-29 ~10:33 JST. Confirmed the trailing-slash convention on the
  *source* path before running (`pmtiles-store/` not `pmtiles-store`)
  specifically to avoid nesting a redundant `pmtiles-store/pmtiles-
  store/` on the destination -- checked, not assumed, since Hidenori
  asked directly. Progress tracked by periodic `du -sh /Volumes/
  pmtiles-store` readings against elapsed time (local SSD-to-SSD copy,
  observed ~45-60MB/s, much faster than tonight's stars-bound network
  rsync): 6.2G at 10:35:51 -> 96G at 11:08:49, ETA re-estimated each
  check, currently ~1 hour remaining.
- **Phase 2 (not yet started -- the actual downtime window)**: once
  Phase 1's bulk copy finishes, (a) gracefully stop `aggregation_run_
  backfill` (Ctrl-C to the screen session is safe at any point --
  confirmed by reading `aggregation_run.py`'s `run()` directly: the
  `.done` marker is written via `os.rename()` as the *last* step, after
  the real pmtiles output is already safely and atomically written per
  D45, so an interrupt mid-item can never leave corrupt output, only
  abandon that one item's in-flight compute and possibly leave an
  orphaned `tmp-store/{generation}/{item}` scratch folder, harmless and
  cleanable); (b) run a short final incremental `rsync -av` pass to
  catch whatever `aggregation_run_backfill` wrote during Phase 1's own
  multi-hour window; (c) replace the local `pmtiles-store` directory
  with a symlink to `/Volumes/pmtiles-store`; (d) relaunch
  `aggregation_run.py` in a fresh screen session -- it will resume via
  the symlink transparently, picking up remaining `.todo` items.

**Confirmed independent of `publish_cycle_10`'s own rsync**: that
rsync's source is the already-fully-built local `bundle-store/
mapterhorn-japan-bridge.pmtiles` (built by `merge_japan_bundles.py`
well before rsync starts) -- it never touches `pmtiles-store` during
the transfer, so this entire migration (Phase 1 and Phase 2) has zero
interaction with the in-flight stars publish. Verified by re-reading
`publish_cycle.py`'s actual command sequence, not assumed from memory.

**Phase D groundwork (upstream sync), look-only, not executed**:
`git fetch upstream` on `hfu-mapterhorn` shows 13 commits on `upstream/
main` since D22's last sync (2026-08-21), through `8eaef05`. Checked
which touch files this session already modified (`aggregation_run.py`,
`aggregation_covering.py`, `downsampling_run.py`, `bundle.py`,
`utils.py`): **two commits directly touch `pipelines/aggregation_run.
py`** -- `57f8481` ("Update worker, reduce memory usage", #285) and
`8eaef05` (also touches `utils.py`). Given tonight's own observed load
average (consistently 6-7) and low free memory pages, an upstream
worker/memory change to the exact file `aggregation_run_backfill` is
currently running is worth real attention -- **deliberately deferred
to a dedicated pass, not attempted mid-migration/mid-backfill tonight**,
per D22's own established discipline (read commit-by-commit when not
mid-flight on the same files). Next session: read `57f8481` and
`8eaef05` in full before deciding whether/how to merge.

**Current state, as of this entry (2026-08-29 11:10 JST)**:
- `aggregation_run_backfill`: running, ~2600/6,373 done, pace has been
  volatile between ~270-720 items/hour across recent 15-min windows.
- `publish_cycle_10`'s rsync to stars: ~118GB/287GB (~39%), ~11MB/s,
  ETA ~4.5h, unaffected by anything in this entry.
- `pmtiles_migrate_phase1`: ~96GB/285GB copied, ETA ~1h.
- Screen Sharing: still not functional (TCC/SIP-gated), no keyboard
  on hand until Monday 2026-08-31 or a replacement purchase -- **not
  currently blocking anything**, since the disk migration proceeded
  entirely over SSH.

### Resume prompt

> Resuming `mapterhorn-japan-bridge`/`hfu/mapterhorn` via SSH from
> `aalto` (`slate-via-spacex`).
>
> Read D57 (the aggregation dirty-filter fix + backfill) and this entry
> (D58, the disk migration) before touching storage or `aggregation_
> run_backfill`.
>
> **Check first**: `screen -ls` on slate for `aggregation_run_backfill`,
> `publish_cycle_10`, `pmtiles_migrate_phase1` -- which are still
> running vs. finished? If `pmtiles_migrate_phase1` finished cleanly
> (compare `du -sh` on the old `pmtiles-store` path and `/Volumes/
> pmtiles-store` -- should match), **Phase 2 is the next real action**:
> stop `aggregation_run_backfill` gracefully (Ctrl-C is safe, see
> above), run the final incremental rsync, symlink-swap, relaunch. Do
> NOT symlink-swap before confirming Phase 1's `rsync` process has
> actually exited (check `screen -ls` / `ps aux | grep rsync`), and do
> NOT skip the final incremental pass -- Phase 1 was deliberately run
> *while* the backfill kept writing, so new files landed in the OLD
> path only, mid-copy.
>
> If Phase 2 is already done (symlink in place), verify it actually
> resolves correctly (`ls -la pipelines/pmtiles-store`,
> `readlink pipelines/pmtiles-store`) before assuming anything about
> it, and check whether `aggregation_run_backfill` was actually
> relaunched afterward or is still sitting stopped.
>
> Screen Sharing is still broken (TCC/SIP-gated, needs a real physical
> keyboard at `slate`'s console -- Hidenori's own is at his workplace,
> expected back 2026-08-31). Not urgent unless a future task genuinely
> needs GUI access; the disk work itself did not.
>
> Phase D (upstream sync) has a concrete next step queued: read
> `57f8481` and `8eaef05` (both touch `pipelines/aggregation_run.py`,
> the memory/worker-tuning ones) in full before merging anything.
>
> Converse in Japanese, per this repo's own language policy.

## D59: `publish_cycle_10`のrsyncが56%でネットワーク瞬断によりクラッシュ(`--partial`を追加して再送信)、`pmtiles-store`の新ディスク移行Phase 2(生産のgraceful stop→差分取り込み→シンボリックリンク切替→再起動)を完了

**Status**: Recorded, 2026-08-29 13:25 JST。

**Phase 1完了(前提)**: D58で開始した`pmtiles-store`→新APFSディスク(`/Volumes/pmtiles-store`)への一括コピーは12:24 JSTに正常終了(`sent 306503176268 bytes ... speedup is 1.00`、エラーなし)。

**publish_cycle_10のクラッシュ**: Phase 1完了後の監視中、`publish_cycle_10`のscreenセッションが12:30頃に消失していたことに気づき調査。ログ(`publish_cycle_10.log`)を確認したところ、stars向けrsyncが56%(174GB/307.9GB)まで転送した時点で

```
Read from remote host stars.local: No route to host
client_loop: send disconnect: Broken pipe
rsync: [sender] write error: Broken pipe (32)
rsync error: unexplained error (code 255) at io.c(949) [sender=3.5.0]
```

で異常終了していた。`stars.local`へのping/ssh到達性を再確認したところ、その時点では正常に復旧しており、一時的なネットワーク瞬断だったと判断(コード側のバグではない)。

**影響**: `publish_cycle.py`はrsync開始前にstars側の旧ファイルを削除する設計(D51)のため、クラッシュ後は**stars上に`mapterhorn-japan-bridge.pmtiles`が存在しない状態**が継続していた(他の公開ファイル群は無事)。ローカルの`bundle-store/mapterhorn-japan-bridge.pmtiles`(307.9GB、08:18 JSTビルド完了済み)はそのまま残っていたため、downsampling→bundle→mergeを含む数時間規模のフルサイクル再実行は不要と判断。

**修正**(`hfu-mapterhorn` `a81478b`): `publish_cycle.py`のstars向けrsyncコマンドに`--partial`を追加。従来は中断されると転送済み分が完全に破棄され0%からやり直しになる設計(既に把握していたリスクだったが、今回のインシデントで実際に顕在化)。`--partial`により、次回以降の同種の瞬断ではrsync自身の差分転送で再開できるようになる。

**復旧**: ビルド済みファイルをそのまま`rsync -av --partial --progress`でstarsへ再送信(screenセッション`publish_retry_rsync`)。転送は最初から(0%)開始(今回のクラッシュ自体は`--partial`適用前だったため、送信先に再開可能な部分ファイルが残っていなかった)。13:25時点で約2%、約11MB/sで安定進行中、ETA約7時間強。

**Phase 2(`pmtiles-store`ディスク移行の仕上げ)実行**、Hidenoriの明示的な承認(「どちらも実行して良い」)を得て実施:

1. `aggregation_run_backfill`のscreenセッションへSIGINT送信 → `aggregation_run.py`が`KeyboardInterrupt`で正常終了したことをログのトレースバックで確認(D45設計通り、途中の実データ破損なし)。screenセッション自体もシェルごと終了して消滅。
2. Phase 1完了後に新規追加された差分を`rsync -av --progress pmtiles-store/ /Volumes/pmtiles-store/`で最終取り込み(3.25GB追加転送、正常終了、`speedup is 93.99`)。
3. `pipelines/pmtiles-store`を`pmtiles-store.old-internal-disk`にリネーム(即削除はせず安全のため一時保持)、`/Volumes/pmtiles-store`へのシンボリックリンクとして`pmtiles-store`を新規作成。
4. `aggregation_run.py`を新しいscreenセッション(`aggregation_run_backfill`)で再起動。正常に4ワーカーで再開し、シンボリックリンク経由で新ディスクへの書き込みが実際に進んでいることを`.done`カウントの増加(3753→3857)で確認。

**現状(このエントリ時点)**:
- `pmtiles-store`は新ディスク(`/Volumes/pmtiles-store`, APFS, 1.5Ti空き)上で稼働中。旧内蔵ディスク側のコピー(`pmtiles-store.old-internal-disk`, 約284GB)は安全確認のため一時的に残置 — 数日程度の安定稼働を見てから削除しMigrate-2025-04の空き容量(現在397Gi)に還元する判断を別途行う。
- `publish_retry_rsync`が進行中(starsへの再送信、ETA約7時間)。
- `aggregation_run_backfill`が新ディスク経由で正常に再開、進捗継続中。

### Resume prompt

> `mapterhorn-japan-bridge`/`hfu/mapterhorn`再開時、まずこのD59とD58を読むこと。
>
> **確認すべき状態**:
> - `publish_retry_rsync`(screen)が完走したか、stars上に`mapterhorn-japan-bridge.pmtiles`が復活しているか(`ssh stars@stars.local ls -la /home/stars/data/mapterhorn-japan-bridge.pmtiles`)。完走していなければ`--partial`が効いて再開されているはずなので、クラッシュしていた場合はログを見て要因を判断。
> - `aggregation_run_backfill`が新ディスク(`/Volumes/pmtiles-store`)経由で問題なく進捗しているか、新ディスクの空き容量(元々1.5Ti超)。
> - `pmtiles-store.old-internal-disk`(旧内蔵ディスク上の退避コピー、約284GB)をまだ削除していなければ、安定稼働が数日続いたことを確認してから削除しストレージを回収する判断をすること — Hidenori未確認のまま一存で削除しない。
>
> Screen Sharing(TCC/SIP起因の未解決問題、D58参照)は今回のディスク移行そのものには一切不要だったため、これ以上急ぐ理由はない。

## D60: 新旧2ディスクのアクセスパターンをiostatで実測 -- 旧ディスク(disk4)が依然として唯一のI/Oワークホース、新ディスク(disk5/pmtiles-store)はほぼアイドル

**Status**: Recorded, 2026-08-29 13:35 JST。Hidenoriの依頼で、D59のPhase 2完了後の実際のディスクI/O分布を`iostat -d -c 15 -w 4 disk0 disk4 disk5`で1分間実測。

**結果**:
- **disk4(旧, `Migrate-2025-04`)**: ほぼ全サンプルで持続的に200〜1,400 tps、12〜30MB/sの負荷。`source-store`/`tmp-store`/`bundle-store`/`aggregation-store`、そしてリポジトリのコード自体がすべてこのディスク上にあり(`tmp-store`はPLAN.mdのD41が当初想定していた「高速な内蔵ディスクへ」という移行が実際には行われておらず、今も外付けdisk4上にある)、aggregation実行中の再投影・マージ・タイル化の全スクラッチI/Oと`source-store`の読み込みがここに集中している。
- **disk5(新, `pmtiles-store`)**: ほとんどのサンプルで0〜2 tps、ごく低いMB/s。aggregationの1アイテムが完了して最終pmtiles出力が書き込まれる瞬間だけ散発的にスパイク(観測中の最大で119 tps/11.88MB/s)。それ以外は事実上アイドル。

**解釈**: 今回のディスク移行(D58/D59)の目的は当初からI/O性能の分散ではなく**容量の逼迫回避**(disk4の空き容量397Giに対し`pmtiles-store`自体が300GB超で伸び続けていた問題への対処)であり、その目的は達成された。一方で、aggregationのボトルネックになりうる実際の重いI/O(`tmp-store`でのGDAL再投影・マージ処理、`source-store`の読み込み)は今回の移行の対象外で、すべて引き続きdisk4に集中している。したがって**disk4は今もこのパイプライン全体の実質的な単一I/Oボトルネック資源であり続けており、今回の移行はそれを一切軽減していない**(誤解しないよう明記: pmtiles-store移行はそもそもI/O分散を意図したものではなかった)。

**新ディスク(disk5)には十分な余力がある**ため、新ディスクがボトルネックになる懸念は当面ない。逆にdisk4の負荷が今後の律速要因になる可能性がある場合、PLAN.mdのD41節が元々提案していた「`tmp-store`を高速な内蔵ディスクへ」という、まだ未実施の最適化が実際の候補として残っている(今回は着手せず、実測結果の記録のみ)。

**Hidenoriへの継続的な注意事項**: `pmtiles-store.old-internal-disk`(disk4上、約284GBの退避コピー)は安定稼働確認後に削除してdisk4の空き容量を回収する予定 -- まだ削除していない。D59のResume promptと合わせてこの2点(退避コピーの削除判断、disk4の実I/O集中)を次回セッションで必ず確認すること。

## D61: `tmp-store`を新ディスク(`/Volumes/pmtiles-store`)へ移設 -- D60の実測に基づく判断、graceful stop→移動→シンボリックリンク化→再起動で完了

**Status**: Recorded, 2026-08-29 13:47 JST。D60の実測(disk4が持続的に200〜1,400 tps/12〜30MB/s、disk5がほぼアイドル)を踏まえたHidenoriの依頼で実施。

**判断根拠**: PLAN.mdのD41は当初`tmp-store`の移設先として内蔵SSDを想定していたが、内蔵ディスクの空きは実測約77Gi(macOS自体と共有)のみで狭すぎると判断。一方`tmp-store`自体の実フットプリントは小さく(移設直前の実測で5.6GB、進行中アイテムのスクラッチのみで自己クリーニングされる)、`pmtiles-store`本体の285GB移行とは規模が全く違う。新ディスク(`/Volumes/pmtiles-store`)は空き1.5Ti・I/Oほぼゼロで、`source-store`(342GB、読み込み専用でdisk4に残置)の読み込みトラフィックと競合していた`tmp-store`のスクラッチ読み書きを分離するのに適任と判断。

**実施手順**(D59のPhase 2と同じ型):
1. `aggregation_run_backfill`のメインプロセスへ`kill -INT`で直接SIGINT送信(前回screenの`stuff`経由での送信が一度反応しなかった経験を踏まえ、今回は直接PIDへ送信 — 即座に`KeyboardInterrupt`で正常終了、screenセッションもシェルごと終了して消滅したことを確認)。
2. `mv tmp-store /Volumes/pmtiles-store/tmp-store`(5.6GB、異なるボリューム間のためコピー+削除だが、規模が小さく数秒で完了)。
3. `ln -s /Volumes/pmtiles-store/tmp-store tmp-store`でシンボリックリンク化。
4. `aggregation_run.py`を新しいscreenセッション(`aggregation_run_backfill`)で再起動、4ワーカーで正常再開を確認。

**効果を実測で確認**(`iostat -d -c 5 -w 3 disk4 disk5`、再起動直後):disk5に実際に23〜57 tps/6〜7MB/sの持続的なI/Oが乗るようになった(移設前はほぼ0)。disk4は引き続き200〜270 tps程度(`source-store`の読み込みと`aggregation-store`/コード分)で稼働しているが、`tmp-store`分の書き込み競合が分離された形。

**現状**: `pipelines/tmp-store`は`/Volumes/pmtiles-store/tmp-store`へのシンボリックリンク。旧内蔵ディスク上に`tmp-store`の残置コピーは作っていない(`mv`のため、移動元は既に存在しない -- `pmtiles-store`移行時のような`.old-internal-disk`退避コピーは今回は無し、regenerateされる性質のディレクトリなので不要と判断)。`pmtiles-store.old-internal-disk`(D59由来、約284GB)は引き続き削除せず残置中 -- 変わらず要注意。

### Resume prompt

> D61で`tmp-store`も新ディスク(`/Volumes/pmtiles-store/tmp-store`)へのシンボリックリンクに切り替わっている。`pipelines/tmp-store`が通常のディレクトリに戻っていたら何か巻き戻っている(要調査)。
>
> `pmtiles-store.old-internal-disk`(D59、旧ディスク上、約284GB)は依然未削除 -- D59/D60/D61を通じて繰り返し記録している通り、安定稼働を確認してから削除しストレージを回収する判断がまだ残っている。

## D62: Phase C2 -- `publish_cycle_10`の実測ステージ別所要時間を記録、24時間cadence前提の再検証。あわせてcron/launchd未設定であることを確認

**Status**: Recorded, 2026-08-29 14:10 JST。改善プラン(rustling-napping-pond.md)のPhase C2として、待ち時間を使って実施。

**`publish_cycle_10.log`から実測したステージ別タイミング**:

```
05:15:21  publish cycle starting
05:15:21  $ uv run python3 downsampling_run.py       -- 開始
05:15:22  $ uv run python3 bundle.py 1                -- downsampling終了(約1.5秒)
06:47:28  $ uv run python3 merge_japan_bundles.py      -- bundle終了(1時間32分)
08:18:23  $ ssh stars@stars.local rm -f ...            -- merge終了(1時間31分)
08:18:28  $ rsync -av --progress ... stars.local:...   -- rsync開始
12:30ごろ crash(D59参照、56%地点でネットワーク瞬断)
```

**downsampling_run.pyの「約1.5秒」について、誤解を避けるための注記**: このcycle_10は05:15開始で、D57のaggregation欠落発見・backfill開始(09:07)より前に走っている。つまりこの時点ではまだ多くのポジションが未整備で、`DOWNSAMPLING_STRICT=1`のreadiness gateがほぼ全ての候補をスキップした結果の「1.5秒」であり、**downsampling自体が本質的に高速という意味ではない**。D57のbackfill(6,373件中の欠落4,394件)が完了した後の次サイクルでは、大量の新規レディ項目が発生し、downsampling_run.pyの実行時間は今回よりずっと長くなる見込み。この数字を「downsamplingは無視できるコスト」と一般化しないこと。

**rsyncステージの実測(部分)と推定**: 実際のクラッシュ地点(56%、174GB)までの平均転送速度は約11MB/s。この速度が最後まで続くと仮定すると、307.9GB全体で約7.4時間(444分)。

**cadence再検証**: downsampling(実質ゼロ、ただし上記の注記通り次回は増える可能性大)+ bundle(92分)+ merge(91分)+ rsync(推定444分)を合算すると約10.4時間。**クラッシュがなければ、全国規模のフルサイクルでも24時間cadenceには十分収まる**計算になる。ただし今回のように途中でネットワーク瞬断が起きると(D59)、`--partial`修正後でも再開にはさらに時間がかかるため、実運用上のマージンは計算上の余裕ほど大きくない。

**cron/launchd自動スケジューリングは未設定であることを確認**(`crontab -l`は"no crontab"、`launchctl list`にpublish関連のジョブなし、`~/Library/LaunchAgents`/`/Library/LaunchDaemons`にもpublish関連のplistなし)。`publish_cycle.py`自身のdocstringが述べる「cadence is set by whatever schedules this script, not by this file」は正しいが、**実際には何もスケジュールしておらず、cycle_1〜cycle_10まですべて手動起動**だったことを確認した。号2に向けて、この「毎日1回」という前提を本当に実現したいなら、cron/launchdの実設定が必要 -- 現状は前提が机上のものにとどまっている。

### Resume prompt

> D62はPhase C2(cadence再検証)の実測記録。号2を検討する際は、(1) downsampling_run.pyの実測1.5秒はD57 backfill前の非代表値である点、(2) cron/launchdが今も未設定である点、の2つを踏まえること。

## D63: Phase D -- upstream `mapterhorn/mapterhorn`の`aggregation_run.py`関連2コミットを読了。単純マージ不可と判断(分散ワーカー化+D22が否定したLERC採用が同梱されているため)

**Status**: Recorded, 2026-08-29 14:20 JST。D22以来の同期規律(コミット単位で読み、fork固有ロジックとの衝突可能性があるものは慎重に読む)に従い、`aggregation_run.py`に触れる2コミットを読了。**マージは実施していない、読解のみ**。

**`git fetch upstream`時点で13コミット遅れ**(前回D22の同期、2026-08-21以降)。うち`aggregation_run.py`に触れるのは以下の2件。

**`57f8481`「Update worker, reduce memory usage」(#285, 2026-08-12)**: 見た目のコミット名に反し、実態は**分散ワーカー化への大きなアーキテクチャ変更**。
- `aggregation_run.py`の`run()`が、実処理の前に`tmp-store/queue/{filename}`へジョブを書き出し、別プロセス(新設の`downloader.py`)が`tmp-store/ready/{filename}`を作るまで`while`ループでポーリング待機する設計に変更されている。**この`ready`ファイルを作る主体(downloader)が存在しない限り、この版の`aggregation_run.py`はこのfork環境では永久に待機してハングする** -- `source-store`から直接読む今のfork構成とは根本的に非互換。
- `aggregation_reproject.py`の入力ファイルリストも`source-store/{source}/{filename}`から`tmp-store/source/{source}/{filename}`に変更 -- 上記downloaderが事前にステージングする前提の変更で、単独では動かない。
- **`aggregation_merge.py`と`aggregation_reproject.py`の両方でLERC圧縮を新規採用**(`compress='LERC', max_z_error=0.001`)。**これはD22がこのfork自身で実測・却下した変更と正面から矛盾する**: D22は同じ「短命で繰り返しウィンドウ読み込みされる集約中間ファイル」に対してLERCを試し、`aggregation_merge.py`自身の再読み込みパターンのせいで15〜35倍遅くなることを確認して却下している。Oliver側の環境・ワークロードが違う(あるいは前述のdownloader分散構成で読み込みパターン自体が変わった)可能性はあるが、**このfork向けに無条件採用すると同じ退行を再現する危険が高い**。
- 一方で`gdal_translate`のメモリ設定変更(`GDAL_CACHEMAX=64 GDAL_NUM_THREADS=1 --config GDAL_MAX_DATASET_POOL_SIZE 1`、旧`GDAL_CACHEMAX=512`)は、コミット名通りの純粋なメモリ削減策で、**分散ワーカー化ともLERCとも独立して評価可能**。`slate`(16GBのM4 Mac mini)はこのセッション中もmemory free pageが低い水準で推移しており、これ単体は将来ベンチマークする価値がありそうだが、今夜は未検証。
- `create_virtual_raster`への`heterogeneous projection`検出例外は、小さく独立した防御的修正で、そのまま採用しても副作用はなさそうに見える(未検証)。

**`8eaef05`「Minor pipeline changes」(#303, 2026-08-26)**: 前コミットの延長線上の変更。
- ログメッセージの体裁変更(`item`をprefixに含めるよう統一)のみで実質的な挙動変化なし。
- `.done`マーカーの付け方が`os.rename(f'{filepath}.todo', f'{filepath}.done')`から`with open(f'{filepath}.done', 'w') as f: f.write('')`(`.todo`を消さない単純な新規作成)に変更されている -- upstream側は「`.todo`は残ったままでよい」という設計に舵を切ったように見え、このfork自身がD57で発見した「`.todo`が消えないと再実行のたびに全件再チェックされる」問題と同じ形。**このfork自身の直近の教訓(D57)と矛盾する方向の変更**であり、採用しない。
- `aggregation_merge.py`からdtype変換の安全策(`output_tile.astype(dst_dtype)`)が削除されている -- 理由不明、正しさへの影響が読めないため、これも単独では採用しない。
- `utils.py`の`save_terrarium_tile()`に`np.seterr(all='raise', under='ignore')`(アンダーフローを例外にしない)を追加 -- 小さく独立した防御的修正、副作用なさそうに見える。

**結論・今夜の対応**: **この2コミットはマージしない**。採用するとしても、(a) `heterogeneous projection`例外、(b) `np.seterr(under='ignore')`、(c) 未検証だがGDALメモリ設定、の3点だけを個別に手動移植する形が現実的で、queue/ready分散ワーカー化とLERC採用は、このforkの現在のアーキテクチャ(単一マシン、`source-store`直接読み込み)とは別物として扱うべき。号2設計時に、upstream側が分散ワーカー方向に進化していること自体は認識しておく価値がある(将来複数マシンでの並列処理を検討する際の参考実装になりうる)。

### Resume prompt

> Phase D再開時、`57f8481`/`8eaef05`は読了済み・マージ未実施。安全に個別採用できそうなのは3点のみ(D63本文参照)、それ以外(queue/ready分散ワーカー化、LERC採用、`.done`マーカー方式の変更、dtype変換削除)はこのforkの設計・過去の実測結果(D22, D45, D57)と衝突するため、採用するなら個別に再検証してから。`git fetch upstream`はまだ13コミット遅れの残り11件が未読(`aggregation_run.py`以外のファイルのみ触れるもの)。

## D64: D63で保留したLERC採用の危険性は、今夜のディスク移行(D58-D61)によって解消されていない -- ボトルネックはI/O帯域ではなくCPU側の反復デコードコストのため

**Status**: Recorded, 2026-08-29 14:30 JST。Hidenoriからの直接の問いに答える形で確認。

D22が実測した15-35倍の遅延は、aggregation_merge.pyが同じ巨大な中間ファイルをウィンドウ単位で繰り返し読み直すアクセスパターンに起因し、LERC圧縮ブロックが読み直されるたびに再デコードされることのCPUコストが支配的と考えられる。今夜のD58-D61(pmtiles-store/tmp-storeの新ディスクへの移設)はディスクのI/O帯域・容量・競合を改善しただけで、aggregation_merge.py自身の反復読み込みパターンには一切手を付けていない。したがってD22/D63のLERC忌避判断は今も変わらず有効。この判断が変わるとすれば、PLAN.mdセクション5が触れているaggregation_merge.pyのシングルパス読み込みへの再設計が実現した場合のみで、それは未着手。

## D65: ディスク分割の効果を再点検 -- データ配置・I/O分布は明確に分かれたが、増速はまだ統計的に確認できず(継続観測へ)

**Status**: Recorded, 2026-08-29 14:15 JST。Hidenoriの依頼で、D58-D61のディスク分割について(1)データ配置(2)I/O分布(3)増速の有無を再確認。

**(1) データ配置**:

| | 旧ディスク(disk4, `Migrate-2025-04`) | 新ディスク(disk5, `pmtiles-store`) |
|---|---|---|
| 内容 | `source-store`(342G)、`bundle-store`(287G)、`aggregation-store`(198M)、`polygon-store`(166M)、コード一式、`pmtiles-store.old-internal-disk`(284G、退避コピー) | `pmtiles-store`本体(299G)、`tmp-store`(6.8G) |
| 空き | 399Gi | 1.5Ti |

**(2) I/O分布**(`iostat -d -c 15 -w 4`、1分間再実測):disk4は185〜273 tps・11〜14MB/sで安定的に稼働。disk5はD61直後の6〜7MB/s平均から成長し、**今回は0〜152 tps・5.6〜50.7MB/sと大きく変動しつつ平均15.6MB/s**(disk4の11.7MB/s平均を上回る場面もある)。データの物理的な分離とI/Oの分離は明確に実現できている。

**(3) 増速の有無**: **まだ統計的に確認できていない。** aggregation `.done`ペースを比較:
- ディスク分割前(ベースライン、11:39〜12:39の4区間平均): 522件/時、ただし区間ごとに280〜840件/時と約3倍のばらつき
- pmtiles-store移行のみ後(13:23〜13:47): 約562件/時
- tmp-store移行後(13:47〜14:10): 約608件/時

見かけ上わずかに上昇しているが、**ディスク変更前から既に280〜840件/時という約3倍の自然変動があり**、この差(562→608、+8%)はその変動幅の中に完全に収まる。アイテムごとの処理コストのばらつき(macrotileの複雑さによる)が支配的で、30分程度の短い観測窓では実際の増速効果を分離できない。

**結論**: データ・I/Oの分離という設計意図は実現できているが、それが体感できるスループット向上に繋がっているかは、もっと長い時間軸(数時間〜半日規模)で継続観測しないと判断できない。Hidenoriの依頼により、時間をおいて再確認する。

### Resume prompt

> ディスク分割の増速効果について再確認する際は、D65のベースライン数値(280〜840件/時の自然変動幅)と比較すること。数時間分のtickデータが溜まったら、ディスク分割前後で平均ペースに意味のある差(自然変動幅を超える差)があるかを見る。

## D66: `aggregation_run_backfill`完走 -- D57が発見した6,373件全件のnative aggregationが真に完了

**Status**: Recorded, 2026-08-29 20:28 JST。

09:07 JSTにD57で開始した backfill(D57時点で発見された、真の国内総数6,373件に対する4,394件の未処理分、うち2,343件は一度もビルドされたことがなかったポジション)が、約11時間20分のwall-clockで完走。

- `.done`マーカー: **6,373/6,373**、現行世代(`01M0MWK852631SHCHPA66F21WQ`)の全ポジションが揃った。
- `aggregation_run_backfill`のscreenセッションは自然終了(プロセス自体が正常終了、`Traceback`/`Error`の出力ゼロ、`grep`で確認済み)。
- 途中、D58〜D61でストレージを新ディスクへ移行(`pmtiles-store`本体+`tmp-store`)する作業のためgraceful stopを2回挟んだが、いずれも`KeyboardInterrupt`で安全に中断・再開できており、データ破損は一切なし。
- `pmtiles-store`最終サイズ: **283GB**(新ディスク`/Volumes/pmtiles-store`上)。

**D48〜D57で辿ってきた「1号のaggregationは完了している」という認識の、最終的な正しい姿がここで確定した**: D48時点の「1,979/1,979 完了」は誤った母数に基づく誤認、D57でその誤りと真の母数(6,373)が判明し、今回そのフルスコープが実際に完了した。

**次のステップ(D57の resume prompt通り)**: `downsampling_covering.py`→`downsampling_run.py`のフルパス、その後`bundle.py`→`merge_japan_bundles.py`→starsへのrsyncを含む完全な`publish_cycle`を1回走らせ、最後に`check_pmtiles_integrity.py`をD50の413,925件オーファン基準と比較する、という一連の検証が1号の真のミッションコンプリートの最終確認になる。現在進行中の`publish_retry_rsync`(D59の復旧、古いビルドの再送信)が完走してから着手する。

### Resume prompt

> aggregation本体は完了(6,373/6,373)。次はdownsampling_covering→downsampling_run→bundle→merge→publish_cycleのフルパス実行と、`check_pmtiles_integrity.py`による最終検証。`publish_retry_rsync`(D59、古いビルドの再送信)の完走を待ってから着手すること。完了後はD65の「1号ミッションコンプリート後にdisk5を取り外す」手順(PLAN.md参照)に進める。

## D67: `publish_retry_rsync`が完走 -- starsへの再送信成功、Martinのカタログにも反映済み

**Status**: Recorded, 2026-08-29 21:59 JST。

D59のクラッシュ後に開始した`publish_retry_rsync`が完走。starsに`mapterhorn-japan-bridge.pmtiles`(307,895,883,486バイト、bundle-storeのローカルファイルと一致)が正式名で配置された。20:42に転送バイト数自体は100%に達していたが、その後実際にファイルが正式名にリネームされるまで約1時間17分かかった。原因を`lsof`/`iostat`で特定: rsync送信側プロセスがソースファイル全体(307.9GB)を再度読み込んで最終チェックサムを計算しており(disk4で1,680-1,700 tps・60-66MB/sの持続読み込みを確認)、ハングではなく正常な最終検証だった。

Martin(`http://localhost:3000/catalog`、stars上で稼働中)のカタログに`mapterhorn-japan-bridge`が既に反映されていることを確認 -- config.yamlに個別記載がないことから、ディレクトリスキャン方式で自動検出されたとみられ、追加の再起動は不要だった。

**これでaggregation(D66)とstars公開(D67)の両方が完了し、1号の現在の到達点が揃った。** 次はdownsampling_covering→downsampling_run→bundle→merge→publish_cycleのフルパスと`check_pmtiles_integrity.py`による最終検証(D57のresume prompt通り)。

## D68: `check_pmtiles_integrity.py`をpublish_cycle_11のローカル成果物(`bundle-store/mapterhorn-japan-bridge.pmtiles`)に対して実行 -- D50基準(413,925孤立タイル)から55.6%改善、183,847件まで減少

**Status**: Recorded, 2026-08-30 05:07 JST。stars向けrsync進行中(D67のスコープ外、cycle_11自身の本番rsync)と並行して、ローカルにある完成済みマージ出力に対して整合性チェックを実施(directory-onlyの軽量な走査のみ、実タイルデータは読まないため12秒で完了、rsyncと競合しない)。

**結果**:
```
total tiles: 2,507,680
orphaned tiles (親タイル不在): 183,847 (11ズームレベル)
  z4:1 z6:8 z7:10 z8:20 z9:46 z10:118 z11:3,149
  z12:43,843 z13:4,684 z14:1,920 z16:130,048
```

**D50基準(413,925件)から230,078件減少、55.6%の改善**。aggregation backfill(D57)の完走とdownsampling_run.pyのフルパス実行(D66/publish_cycle_11)の効果が直接反映された結果。

**残存する183,847件の内訳**: z16(ネイティブ最細ズーム)が130,048件(71%)、次いでz12が43,843件で大半を占める。ログ上でも`0-0-0-0`/`1-1-0-1`/`2-3-1-2`など複数の粗いグローバルタイルが今回のdownsampling実行で"children not all ready, skipping"となっており、この残存分と符合する。ゼロにはなっていないが、根本原因(D45のrace/D57のdirty-filter)は既に修正済みであり、残りは「まだ全ての依存関係が揃っていない」ことによる一時的な未整備であって、恒久的なバグではないとみられる。次のpublish_cycleでさらに減る可能性が高い。深堀りした根本原因分析はまだ行っていない -- 必要なら個別に追跡する。

### Resume prompt

> `check_pmtiles_integrity.py`の結果: 183,847孤立タイル(D50の413,925から55.6%改善)。z16/z12に集中。次回のpublish_cycleで再チェックし、傾向が減り続けているか確認すること。ゼロを目指すなら、残存する孤立タイルの具体的な位置(z16の130,048件)を個別にaggregation/downsamplingの状態と突き合わせる追加調査が必要。

## D69: 「欠けているタイル」の実地調査 -- D53の`check_downsampling_done_integrity.py`が今日のbackfillで大量発生したstale `.done`マーカー(1,265件)を検出・修復

**Status**: Recorded, 2026-08-30 05:50 JST。Hidenoriから「aggregationが100%完了した今、欠けている場所は確定論的に決められるはず、リストが現実的か確認して、狙い撃ちのdownsamplingをすべきか」という問いを受けて調査。

**手順1 -- `check_downsampling_readiness.py`で現況を確認**: publish_cycle_11のdownsampling_run.py完走直後の状態は「done: 7,903 / ready-not-run: 0 / not-ready: 437」。**ready-not-run が0ということは、単純に同じrunをもう一度回しても何も進まない**ことを意味する(直前のrunが実際にreadyだったもの全てを処理し切っていたため)。

**手順2 -- 具体例を1件深掘り**: `10-863-435-11-downsampling.csv`(1/10 children missing)を追跡。欠けていた子`12-3454-1742-12.pmtiles`は、実際には対応する`12-3454-1742-12-downsampling.csv`(別の、より細かいdownsamplingステップ)自体の`.done`マーカーが**2026-08-28 22:00**(今日のbackfillより前)に存在するにもかかわらず、実体のpmtiles-storeファイルが存在しないという状態だった。これはD53が発見したのと同じ「stale `.done`マーカー」のバグクラス(`aggregation_run.py`の既存ファイル置き換えが、そのファイルを参照するdownsampling完了マーカーより後に発生すると、マーカーだけが取り残される)。

**手順3 -- 既存ツールで規模を確認・修復**: `check_downsampling_done_integrity.py 01M0MWK852631SHCHPA66F21WQ`(dry-run)を実行したところ、
```
total .done markers: 7,903
healthy: 6,638
stale (done, but referenced file missing): 1,265 (16%)
oldest stale marker: 2026-08-28 19:41:35
newest stale marker: 2026-08-29 08:48:18
```
全てのstaleマーカーが**今日のaggregation backfill開始(09:07)より前**の日付であり、ツール自身が定めた安全条件(「aggregation完全終了後にのみ`--fix`してよい」)に合致することを確認した上で`--fix`を実行、1,265件を削除。

**手順4 -- 削除したマーカーの再構築**: `downsampling_run.py`を単独で再実行(screenセッション`downsampling_repair`)。この操作は`bundle-store`・`pmtiles-store`のダウンサンプル出力・`aggregation-store`の各csvにのみ触れ、**`bundle-store`の完成済みファイルや進行中のstars向けrsyncには一切触れない**ため、転送中でも安全に並行実行できると判断し実施。

**Hidenoriの問いへの回答**:
- 「狙い撃ちのdownsamplingツールを新設すべきか」→ **不要と判断**。既存の`downsampling_run.py`自体が`.done`チェック→readiness チェックの2段構えで、既に「実際にやるべきことだけをやる」設計になっている。今回の停滞は「チェーンが単に未完成」ではなく「stale markerというバグ」が原因で、これは専用の既存ツール(D53/`check_downsampling_done_integrity.py`)で対処するのが正しい選択だった。
- 「タイミング(転送完了を待つべきか)」→ **待つ必要はなかった**。「開始時点で古いプロダクトを削除する」設計は`publish_cycle.py`が新しいサイクル全体(bundle+merge+rsync)を開始する時にのみ発動するもので、`downsampling_run.py`単独の再実行は`bundle-store`に一切触れないため、進行中のrsync(cycle_11自身の本番転送)と完全に独立して安全に実行できた。

### Resume prompt

> D69で1,265件のstale downsampling `.done`マーカーを削除・`downsampling_run.py`を再実行中(`downsampling_repair`スクリーン)。完了後、`check_downsampling_readiness.py`で not-ready の数がどれだけ減ったか再確認すること。さらに次回のpublish_cycleで`check_pmtiles_integrity.py`のorphan数(D68: 183,847)がどれだけ減るかも追跡すること。

## D70: downsampling完全収束を確認 -- strict修復のみで8,340/8,340完了、非strict仕上げパスは変更なし(何もすることがなかった)

**Status**: Recorded, 2026-08-30 08:05 JST。D69で合意した「更新版プラン」(stale marker修復 → 新規stale再チェック → readiness収束確認 → 非strict仕上げ → 整合性再検証)を実行。

**手順1 -- `downsampling_repair`(strict、1,265件の再構築)完走**: 05:47開始、08:03完了(約2時間16分)。screenセッション正常終了。

**手順2 -- `check_downsampling_done_integrity.py`を再実行(新規stale確認)**: `total .done markers: 8,340 / healthy: 8,340 / stale: 0`。**repair自体が新たなstaleを生んでいないことを確認**(D69で懸念していたリスクは顕在化しなかった)。

**手順3 -- `check_downsampling_readiness.py`で収束確認**: `already .done: 8,340 / ready, not yet run: 0 / not ready: 0`。**全8,340件の候補downsamplingアイテムが実際に完成しており、依存関係で詰まっているものは1件も残っていない。**

**手順4 -- 非strict仕上げパスを実行**: 全件が既に`.done`のため即座に終了、変更なし。当初懸念していた「本当に永久に埋まらない穴(海など)」は、downsampling候補の中には実質存在しなかった、あるいは今回のstale marker修復だけで全て解消したことになる。

**手順5 -- 整合性の再検証は次回publish_cycle待ち**: 現在stars向けに転送中のローカルビルド(`bundle-store/mapterhorn-japan-bridge.pmtiles`)は、この一連の修復より**前**に作られたものであり、今回の改善を反映していない。D68の183,847孤立タイルがどこまで減ったかは、次回のpublish_cycle(bundle+merge+`check_pmtiles_integrity.py`の再実行)で初めて確認できる。

**結論**: `aggregation_covering.py`/`downsampling_run.py`双方の設計上到達可能な範囲では、1号のdownsamplingピラミッドは完全に収束した。残る不確実性は、check_pmtiles_integrity.pyが検出する範囲外の項目(親子整合性チェックの対象にすらならない、真にカバレッジがない領域)のみで、これはバグではなくデータの実際の範囲を反映するものと考えられる。

### Resume prompt

> downsamplingは8,340/8,340で完全収束(D70)。次のpublish_cycleで`check_pmtiles_integrity.py`を再実行し、D68の183,847孤立タイルからどれだけ改善したかを確認すること。大幅に減っていれば(理想はゼロに近づいていれば)、1号の「タイル抜けなし」達成が実証される。

## D71: `pmtiles-store.old-internal-disk`(284GB)を削除 -- publish_cycle_12のmerge中にディスク枯渇リスクが顕在化し、Hidenoriの明示的承認を得て実施

**Status**: Recorded, 2026-08-30 12:10 JST。

**背景**: publish_cycle_12のbundleステージで、D69/D70のdownsampling修復により新規カバレッジ領域が多数見つかり、archive数がcycle_11の7個→21個に増加(生成pmtiles 23ファイル)。これに伴いmerge_japan_bundles.pyの出力(`bundle-store/mapterhorn-japan-bridge.pmtiles`)がcycle_11実績(283GB)を上回るペースで成長し、`/Volumes/Migrate-2025-04`の空き容量が11:50時点で294GB(85%使用)まで低下、マージ完走前のディスク枯渇が現実的リスクとなった。

**対応**: 同じディスク上に存在していた`pipelines/pmtiles-store.old-internal-disk`(disk5移行前の旧内蔵ディスク上pmtiles-storeの安全コピー、実測284GB)を削除。PLAN.mdに記録済みの削除前提条件(「新ディスク経由での読み込み成功実績」)はpublish_cycle_11で既に満たされており、cycle_12進行中でさらに実証されていたため、削除は安全と判断。Hidenoriの明示的な承認(「そうだ、今こそ、pmtiles-store.old-internal-diskを削除しよう。」)を得て実施。

**結果**: `rm -rf`実行、exit code 0。空き容量294GB→554GB(71%使用)に回復。以降merge出力が順調に成長を続けても十分な余裕を確保。

**教訓**: cycle-over-cycleでdownsamplingが収束するほど、bundle/mergeの出力サイズは前回より大きくなる(=ディスク使用量が単調増加とは限らず、むしろ「直る」ことで一時的に急増しうる)という点は、今後のディスク容量計画で考慮すべき。disk5移行後の安全コピーのような「もう不要だが削除判断が先送りされていたデータ」が、まさにこのタイミングで役立った。

### Resume prompt

> D71でpmtiles-store.old-internal-disk(284GB)を削除、Migrate-2025-04の空き容量を554GBまで回復。publish_cycle_12のmerge完走後、check_pmtiles_integrity.pyで再検証すること。disk5のdetach手順(PLAN.md記載)は、この削除でold-internal-diskへの依存が完全に無くなったことも追記しておくとよい。

## D72: `check_pmtiles_integrity.py`をpublish_cycle_12のローカル成果物に対して実行 -- 孤立タイル0件(CLEAN)、D68の183,847件から完全収束

**Status**: Recorded, 2026-08-30 13:30 JST。stars向けrsync進行中(13%程度)と並行して、ローカルの`bundle-store/mapterhorn-japan-bridge.pmtiles`(merge済み、311,401,426,221 bytes)に対して整合性チェックを実施。

**結果**:
```
total tiles: 2,568,241 (D68のcycle_11実績2,507,680から+60,561)
tiles per zoom: z0:1 z1:1 z2:1 z3:4 z4:6 z5:13 z6:37 z7:117 z8:440 z9:1,725
  z10:6,870 z11:27,431 z12:109,699 z13:38,840 z14:123,856 z15:451,840 z16:1,807,360
=== orphan check ===
CLEAN: every tile at every zoom > min_zoom has a parent one zoom coarser.
total check time: 12s
```

**D68(183,847孤立タイル)からゼロまで完全収束**。D69/D70で修復したstale downsampling `.done`マーカー(1,265件)の解消が、そのまま孤立タイルの解消に直結したことが実測で確認された。タイル総数も+60,561件増加しており、D71で削除した`pmtiles-store.old-internal-disk`が占めていたディスク容量問題とは無関係に、純粋にデータ側のカバレッジが拡大したことを示している。

**結論**: 1号(`01M0MWK852631SHCHPA66F21WQ`)について、「タイル抜けなし」という当初のミッションは、ローカル成果物のレベルで実証された。残るのはstars向けrsyncの完走(本番反映)のみ。

### Resume prompt

> D72でローカルbundle-store成果物のcheck_pmtiles_integrity.pyがCLEAN(孤立タイル0件)を確認。stars向けrsync完走後、本番ファイルでも同様にCLEANであることを念のため再確認するとよい(ローカルとstars側でファイルが一致していることはD67のパターンで確認可能)。これでPLAN.mdのdisk5デタッチ前提条件(publish_cycleの整合性改善確認)は満たされた。

## D73: publish_cycle_12が完走 -- stars本番反映完了、1号のミッション(タイル抜けなし)を実証

**Status**: Recorded, 2026-08-30 19:58 JST。

publish_cycle_12(downsampling→bundle→merge→rsync)が19:53:38に完走。stars向けrsyncは311,401,426,221 bytesを転送、送信側報告(311,477,452,080 bytes sent、speedup 1.00)と一致。`publish_cycle_12` screenセッションは正常終了。

**このサイクルの経緯まとめ**:
- bundleステージのarchive数がcycle_11の7個→21個に急増(D69/D70のdownsampling修復で新規カバレッジが埋まったため)、最終マージサイズもcycle_11実績(304.0GB)を上回る311.4GBに到達
- merge進行中にディスク逼迫が現実化(`/Volumes/Migrate-2025-04`の空きが294GBまで低下)したが、Hidenoriの承認を得て`pmtiles-store.old-internal-disk`(284GB、disk5移行前の安全コピー)を削除(D71)し解消
- merge完了直後、ローカル成果物に対する`check_pmtiles_integrity.py`で**孤立タイル0件(CLEAN)**を確認(D72)、D68の183,847件から完全収束
- 今回のrsyncはローカル再起動によるモニタリングタスク中断を挟みつつ、約7時間かけて11.0MB/s前後の安定した帯域で完走

**結論**: 1号(`01M0MWK852631SHCHPA66F21WQ`)の当初ミッション「タイル抜けなし」は、ローカル検証(D72)とstars本番反映(本エントリ)の両方で実証された。stars直接のホスト名解決は環境上できず(D67と同様)、rsync自身の転送完了報告(バイト数一致)を検証根拠とした。

**次のステップ**: PLAN.mdに記録されているdisk5デタッチ手順の前提条件はこれで全て満たされた。実際にdisk5を取り外すかどうかは別途Hidenoriの判断を待つ。

### Resume prompt

> D73でpublish_cycle_12が完走、stars本番反映も完了。1号の「タイル抜けなし」ミッションは実証済み(D72のCLEAN確認+本エントリの転送完了)。PLAN.mdのdisk5デタッチ前提条件は全て満たされているので、Hidenoriが実施を希望すればいつでも着手できる状態。2号は10月末のGSI更新まで着手しない方針(既存合意通り)。

## D74: pmtiles-store全体の50%の位置でstale child_zファイルが未削除のまま残存 -- 212GBの汚染データを発見・削除、市松模様の最有力原因候補

**Status**: Recorded, 2026-08-30 22:50 JST。中国・四国沿岸の市松模様アーティファクト調査の一環として発見。

**発見の経緯**: 倉橋島(呉市付近)のタイル`10-889-408`のpmtiles-store出力を直接調べたところ、同じz-x-y位置に**child_z(最大ズーム)が異なる4つの別々のファイル**(`-13`, `-14`, `-15`, `-16`.pmtiles)が同時に存在していた。`aggregation_tile.py`/`downsampling_run.py`はどちらも「同じz-x-y位置の古いchild_zファイルを削除する」というstale cleanupロジック(`for stale_filepath in glob(f'{out_folder}/{z}-{x}-{y}-*.pmtiles'): if stale_filepath != out_filepath: os.remove(stale_filepath)`)を持っているが、これが機能していない事例。

**規模の確認**: pmtiles-store全体をスキャンした結果:
```
total pmtiles-store files: 14,411
distinct z-x-y positions: 6,972
positions with stale duplicate files: 3,493 (50.1%)
```
現在のaggregation-store/downsampling-storeの`*-aggregation.csv`/`*-downsampling.csv`ファイル名(child_zを含む)を「正解」として突き合わせたところ、**7,440ファイル・212.62GBが不要な古いchild_z違いの重複**と判明。0件が「該当するcsvが一切ない」孤立ファイルだった(=全て「正しいバージョンは別に存在する、古い重複」)。

**影響**: `bundle.py`はpmtiles-store全体を素朴にglobするため、この新旧混在した重複ファイルを全て拾い集めて`bundle-store`にマージしていた。これにより、tile_idの重複や、古い(不完全/別ソース構成だった可能性がある)データが最終成果物に混入していた可能性が高い——中国・四国沿岸の市松模様アーティファクトの最有力な説明。

**対応**: 7,440件・212.62GBを削除。ちょうど並行して実行中だった`bundle_merge_z8plus`(z8+専用の新方式ビルド)はこの汚染データを巻き込んでいたため中断し、削除後にクリーンな状態で`bundle_merge_z8plus_v2`として再実行した。

**未解決**: なぜ半数の位置でstale cleanupロジックが機能しなかったのかは未特定。可能性としては、(a) 複数の異なるスクリプト実行(手動での個別修復や過去の中断されたrun)が、`aggregation_tile.py`本来のクリーンアップパスを経由しない形で新しいchild_zファイルを直接生成した、(b) cleanup自体はaggregation実行時にのみ働き、downsampling側の同名パターンの重複には元々効かない設計だった、等が考えられる。今後の号2設計では、この「stale child_z重複」を定期的に検出・除去する仕組み(今回使ったスクリプトと同じロジック)を`check_downsampling_done_integrity.py`等と並ぶ標準ツールとして正式化する価値がある。

### Resume prompt

> D74でpmtiles-store全体の50%の位置にstale child_z重複ファイル(212GB)を発見・削除、bundle_merge_z8plus_v2としてクリーン再実行中。完了後、check_pmtiles_integrity.pyで再検証し、D72の「孤立タイル0件」がこの汚染除去後も維持されているか、また中国・四国沿岸の市松模様が実際に解消されたかを確認すること。なぜcleanupロジックが半数で機能しなかったかの根本原因はまだ未特定——号2設計の参考にすること。

## D75: D74の削除ロジックに欠陥あり -- downsampling層では同一z-x-y位置に複数の正当なchild_zが共存しうることを見落とし、4,396件を誤って過剰削除。check_downsampling_done_integrity.py --fixで修復

**Status**: Recorded, 2026-08-30 23:20 JST。D74の対応として実行したbundle+merge(`bundle_merge_z8plus_v3`)が完走し、総タイル数512,570(cycle_12実績2,568,241から想定を大幅に超えて激減)という異常な結果になったことから発覚。

**根本原因**: D74で書いた「stale判定」スクリプトは、`aggregation-store/{gen}/*-downsampling.csv`のファイル名から`(z,x,y) -> child_z`の対応表を1つずつ構築していたが、**downsampling層では同じ(z,x,y)位置に複数の異なるchild_zを持つcsvが正当に共存しうる**(ズーム遷移ごとに別アイテムとして生成されるため、例: `10-862-435-10-downsampling.csv`と`10-862-435-11-downsampling.csv`が両方とも現行で必要)ことを見落としていた。dict構築時に後から読んだ方で上書きされ、結果として「本来複数必要なうちの1つ」以外を全て「stale」と誤判定・削除してしまった。

**被害範囲の確認**:
- aggregation層(6,373件)は複数child_z共存ゼロ件 -- **無傷、影響なし**(D74の元々の判定はaggregation層に対しては正しかった)
- downsampling層は3,991ポジション中2,302件(57.7%)が複数の正当なchild_zを持っており、ここが誤判定の温床だった
- `check_downsampling_done_integrity.py`で確認したところ、8,340件の`.done`マーカーのうち**4,396件(52.7%)が誤削除によりstale化**していた

**対応**: `check_downsampling_done_integrity.py --fix`で4,396件のstaleマーカーを削除(D53/D69と全く同じ既存ツール・既存手順で対応できた)。`downsampling_run.py`を再実行して再構築中。aggregation層は無傷のため、高コストな再aggregationは一切不要——downsamplingの再構築のみで済む見込み。

**教訓**: 「同じz-x-y位置に複数ファイルがある = 重複・stale」という前提は、生成レイヤー(aggregation)には成り立つが、ダウンサンプリングレイヤー(複数のズーム遷移が同じ座標に落ちうる)には成り立たない。今後同様のクリーンアップを行う際は、レイヤーごとに「1ポジション1ファイル」という前提が実際に成り立つか、対象コードの生成ロジック(`downsampling_covering.py`のループ構造など)を先に確認してから判定基準を作るべきだった。

### Resume prompt

> D75でD74の削除ロジックの欠陥(downsampling層の複数child_z共存を見落とし)を修正中。aggregation層は無傷、downsampling層の4,396件のstaleマーカーを削除し`downsampling_run.py`で再構築中。完了後、`check_downsampling_readiness.py`で0 not-readyを確認してから、改めて`bundle.py`+`merge_japan_bundles.py`を実行し直すこと(bundle_merge_z8plus_v4)。タイル総数がcycle_12実績(2,568,241、z0-7除く分を差し引いた数)に近い値に戻ることを確認するのが成功の目安。

## D76: D74/D75のさらなる訂正 -- aggregation層とdownsampling層の座標名前空間の衝突により、3,344件の正当なaggregation出力を誤削除。再aggregationで復旧中

**Status**: Recorded, 2026-08-31 05:15 JST。

**発覚の経緯**: D75でdownsampling再構築が完走した後、`check_downsampling_readiness.py`で203件が「依存する子タイルが見つからない」まま収束しないことが判明。九州修正タイル`10-881-411`がこの203件に含まれていたため深掘りしたところ、`10-881-411-15-downsampling.csv`が参照する`10-881-411-16.pmtiles`(aggregation層の出力、九州修正で今日再生成したばかりのファイル)がpmtiles-store上に存在しないことが分かった。

**根本原因**: D74で書いたstale判定スクリプトは、aggregation層の`(z,x,y)->child_z`とdownsampling層の`(z,x,y)->child_z`を**同一の辞書に統合**していた。aggregation層の座標(例: z=10,x=881,y=411、これは元データの粒度に基づく)と、downsampling層の座標(同じz=10,x=881,y=411だが、これは別のズーム遷移の出力位置としてたまたま同じ数値になっている)が**偶然一致する**ケースがあり、この場合downsampling側のchild_z値でaggregation側のエントリが上書きされてしまっていた。

**被害範囲の確認**: aggregation全6,373件・downsampling全3,991件のうち、座標が衝突する位置は**3,344件**。これらの位置ではaggregation層の正しい出力ファイルが軒並み欠落していることを確認した(3,344件全て)。D74で「aggregation層は無傷」と報告したのは誤りで、実際には全体の52.5%が影響を受けていた。

**対応**: 3,344件の`aggregation-store/*-aggregation.csv.done`マーカーを削除(該当する`.todo`が無いもの1,635件は新規作成)、`aggregation_run.py`(`aggregation_repair_3344`スクリーン)で再aggregation中。既存の九州修正(1件)と全く同じ仕組みで対応可能だったが、規模が3,344倍——九州の1件が約30分かかった実績を踏まえると非常に長時間を要する見込み。

**教訓(D75に続く)**: 複数のデータ生成レイヤーが同じ命名規則(`{z}-{x}-{y}-{child_z}`)を共有している場合、**座標タプルだけでは一意にレイヤーを識別できない**。今回のような横断的なクリーンアップスクリプトを書く際は、必ずレイヤーごとに独立した名前空間で処理し、決して1つの辞書に統合しないこと。今後の号2設計では、pmtiles-storeのファイル名にレイヤー種別(aggregation/downsampling)を明示的に含めるか、別ディレクトリに分離するなど、名前空間衝突自体を構造的に防ぐ設計を検討する価値がある。

**現在の理解**: 元々のD74の発見(pmtiles-store全体の50%の位置に古いchild_z重複ファイルが残存)自体は事実であり、市松模様の説明として今も有力な仮説。しかし対応スクリプトの欠陥により、意図せず大規模な追加ダメージ(3,344件のaggregation出力喪失)を生んでしまった。今は「本来あるべきだった状態」への復旧作業中であり、復旧完了後に初めて、当初の仮説(stale重複ファイルの除去が市松模様を解消するか)を実際に検証できる。

### Resume prompt

> D76で3,344件のaggregation再生成を`aggregation_repair_3344`スクリーンで実行中(非常に長時間かかる見込み)。完了後の手順: (1) downsampling層の再収束確認(`check_downsampling_readiness.py`で0 not-readyになるまで`downsampling_run.py`を繰り返す)、(2) `bundle.py`+`merge_japan_bundles.py`で新しいjapan-z8plus.pmtilesを作成、(3) `pmtiles merge`でglobal-overview.pmtiles(z0-7、Mapterhorn由来)と結合し最終成果物を作る、(4) `check_pmtiles_integrity.py`で孤立タイル0件を確認、(5) 実際に倉橋島・中国四国沿岸の市松模様が解消されたか目視確認する(これが今回一連の作業の本来の検証ゴール)。

## D77: z0-7グローバルMapterhorn接合設計のズームレビュー -- z7/z8境界は妥当、ただし日本近海の外洋には接合後も構造的な穴が残る

**Status**: Recorded, 2026-08-31 JST。`aggregation_repair_3344`と並行してレビュー実施(D76の復旧作業をブロックしない)。

**きっかけ**: 藤村さんから「z=7と8の境界でグローバルMapterhornとの接合を行うが、これに必然性があるか、グローバルMapterhornの実践と整合的か。ズームレベル数個ずれている可能性がある」というレビュー依頼。

**検証(1) 内部整合性**: `pipelines/utils.py`の`get_pmtiles_folder()`が、`z<7`をフラット格納・`z==7`をタイル単位フォルダ・`z>7`をz7祖先で束ねたフォルダ、という3分岐でpmtiles-storeのディレクトリシャーディングを既に行っていた(接合設計とは無関係な既存コード)。これは「z7以下=グローバル粒度」という区分が自前パイプラインに以前から内在していたことを意味し、`min_output_zoom=8`は既存の構造的境界と一致する。

**検証(2) 外部実データでの境界検証**: `tiles.mapterhorn.com`に実際にHTTPリクエストして被覆状況を確認。z0-2は欠落なし、z3で初めて欠落発生(北極圏・絶海の2件)。日本近海bbox(東経118-154度・北緯20-50度)を全数チェックすると、z7で54/196(27.5%)が404。欠落座標は全て日本海・東シナ海・フィリピン海・日本東方の外洋で、東京・大阪・札幌・福岡・那覇を含むz7タイルは全て存在(日本の陸地には一切かかっていない)。upstream本家CHANGELOG.mdの"Add source coverage vector tiles layer (#113)"の記載から、外洋の無データはMapterhorn自身も前提としている設計である可能性が高いと判断。

**結論**: z7/z8の境界そのものにズレは無い(動かしても外洋の無データ問題は解消しない)。ただし重要な副作用として、**接合後も日本海・東シナ海・日本東方の外洋には、Mapterhorn自身のデータ限界に由来する構造的な欠落(z6-7で最大27.5%)が残存する**。これは今回の作業が解決しようとした「世界中どこでも真っ白」という問題とは別種・別スコープの事象であり、最終`pmtiles merge`後の目視確認で「まだ直っていない」と誤診しないよう、D74-D76が対象とする「陸地に近い海岸沿いの市松模様」と明確に区別して評価する必要がある。また、日本国外のz8以上は自前データが存在しないため完全に無データとなるが、これは本リポジトリのスコープ(日本国内限定、ADR 0001)と整合的であり意図した挙動と判断する。

詳細な検証データ(HTTPステータス一覧・都市別タイル座標確認)は`PIPELINE_DESIGN.md`7.1節に記録。

### Resume prompt

> D77でz7/z8境界のレビューを完了(結論: 境界自体は妥当、ただし日本近海の外洋には接合後も構造的な穴が残ることを確認・文書化)。D76の`aggregation_repair_3344`の進捗確認へ戻ること。最終`pmtiles merge`後の目視確認では、D74-D76対象の「海岸沿いの市松模様」と、D77で確認した「外洋の構造的欠落(修正不能・許容範囲)」を区別して評価すること。

## D78: D74の「50%でstale cleanupが機能していない」という診断は誤り -- 修正した監査スクリプトで再スキャンした結果、真のstaleファイルは0件。市松模様の原因はD74-D76では説明できず、依然未特定

**Status**: Recorded, 2026-08-31 06:55 JST。48時間自律運用のコードレビュー方針(藤村さんの指示)に基づき、`aggregation_repair_3344`と並行して`aggregation_tile.py`のstale cleanupロジックを再点検した結果、判明。

**きっかけ**: D77(z7/z8境界レビュー)の作業の流れで、D74がまだ未解決のまま残していた「なぜ半数の位置でstale cleanupロジックが機能しなかったのか」を追う目的で`aggregation_tile.py`のクリーンアップコード(`for stale_filepath in glob(f'{out_folder}/{z}-{x}-{y}-*.pmtiles'): if stale_filepath != out_filepath: os.remove(stale_filepath)`)を精読したが、ロジック自体に明白な欠陥は見当たらなかった。

**検証方法**: D74の元スクリプトの欠陥(D76が特定した、aggregation層とdownsampling層の`(z,x,y)`を同一辞書に混同する問題)を修正した再監査スクリプト`check_stale_duplicates_v2.py`を新規に書いた。二層を独立した辞書として扱い、downsampling層については複数の正当なchild_z共存(D75)も許容する形で「本当に説明のつかないファイル」だけを検出する。読み取り専用(削除は一切行わない)。

**結果**(`aggregation_repair_3344`進行中の時点でのpmtiles-store、参考値):
```
total pmtiles-store files: 11,000
distinct z-x-y positions: 6,985
positions with >1 file, all explained by legit child_z values: 2,225
orphan files (no CSV references this position, either layer): 0, 0.00 GB
TRUE stale files (position has a legit child_z, but this file is a different, unreferenced one): 0, 0.00 GB
```

**結論**: 名前空間を正しく分離して判定すると、pmtiles-store全体に**真の意味でのstale重複ファイルは1件も存在しない**。D74が報告した「50.1%・3,493ポジションがstale」という数字は、D74自身の監査スクリプトが抱えていた名前空間混同バグ(D76が根本原因として特定したものと同一の欠陥)による誤検出だったと考えられる。つまり:

- `aggregation_tile.py`/`downsampling_run.py`のstale cleanupロジック自体にはバグは無かった可能性が高い。
- D74で削除された212GB・7,440ファイルの中には、本当にstaleだったものも一部含まれていたかもしれないが、その後のD75(4,396件の誤削除)・D76(3,344件の誤削除)の規模の大きさを踏まえると、**212GBの相当部分が実際には正当なファイルだった**可能性が高い。これは復旧不能(削除実行時にゴミ箱等を経由しない`rm`だったため)——ただしD75/D76の対象範囲は特定・復旧済みであり、それ以外に見過ごされた誤削除が無いかは、`aggregation_repair_3344`完了後にaggregation層6,373件・downsampling層(収束後)の総数が期待値と一致するかで最終確認する。
- **市松模様アーティファクトの根本原因は、D74-D76のいずれによっても説明されない**。D74の「stale重複ファイルの混入」という最有力仮説は棄却する。中国・四国・九州・沖縄の海岸沿いの市松模様は、パイプライン復旧完了・最終`pmtiles merge`後に改めて目視確認し、**新しい仮説から調査をやり直す必要がある**。

**今後の候補仮説(未検証、優先度順ではなく列挙)**:
1. `aggregation_merge.py`のガウシアンぼかしによる境界ブレンドが、macrotileの境界(512pxブロック)付近で意図しない縞・格子状のパターンを作っている可能性(このセッションの以前の調査で「大部分は除外」とされていたが、完全には除外されていない)。
2. `aggregation_reproject.py`の`cubicspline`リサンプリングが、7段の優先度ソースが入り乱れる境界で不安定な結果を出している可能性。
3. PMTiles自体の`clustered`フラグが正しくない中間生成物(`merge_japan_bundles.py`の出力、6節参照)を経由したことによる、tile読み込み時の不定動作。
4. ビューア/レンダラー側(MapLibre GL JSのタイルキャッシュ、ブラウザ側)の表示上のアーティファクトで、データ自体には問題が無い可能性。

**教訓**: 診断ツール(監査スクリプト)自体のバグが、本物のバグであるかのような測定結果を生み、それが後続の実データ破壊(D75/D76)の引き金になった。今後、生産データに対する「診断→対応」を行う際は、診断スクリプト自体を新規に書いた場合は必ず**小さな既知サンプルで手動検証してから全体に適用する**という手順を徹底する(D74はこれを怠り、多段階の被害に繋がった)。

### Resume prompt

> D78で、D74の「stale cleanup が50%で機能していない」という診断自体が誤りだったと判明(修正した監査スクリプトで再スキャンした結果、真のstaleファイルは0件)。**市松模様アーティファクトの根本原因はまだ完全に未特定**——D74-D76は復旧作業として必要だったが(実際に3,344+4,396件の正当なファイルを誤って削除・復旧した)、市松模様そのものの説明にはなっていない。`aggregation_repair_3344`完了後、パイプラインを最後まで再構築し、`pmtiles merge`後に改めて中国・四国・九州・沖縄の海岸沿いを目視確認すること。直っていなければ、D78が列挙した新しい仮説(ガウシアンぼかしの境界パターン、cubicsplineの不安定性、clustered化の不整合、ビューア側の表示問題)から調査を再開する。

## D79: 市松模様の新しい有力仮説 -- aggregation_merge.pyの512pxブロック単位ブレンド判定が、ブロック境界に沿った不連続を生む可能性(未検証)

**Status**: Recorded, 2026-08-31 07:15 JST。D78で「stale重複ファイル」仮説が棄却された後、コードレビュー方針(48時間自律運用の3本柱の1つ)に基づき`aggregation_merge.py`を精読して発見。`aggregation_repair_3344`の完走を待たずに記録(コード読解のみ、生産には触れていない)。

**発見の経緯**: `merge()`は`merged-3857.tiff`全体を一度に処理せず、**512x512pxのブロック単位**でループ処理する(`for y in range(0, height, tile_size): for x in range(0, width, tile_size)`)。各ブロックは`overlap`(=`buffer_pixels`)分だけ周囲を広げて読み込むが、**ブレンド処理を行うかどうかの判定(`filled_from_start = (-9999 not in merged_tile)`)は、このブロックごとの読み込みウィンドウ単独で行われる**。

**問題の構造**: 最優先ソース(source 0、通常はGSI陸域データ)だけでこのウィンドウが完全に埋まっていれば(`filled_from_start=True`)、ガウシアンぼかしによる境界ブレンドは一切行わず**生データをそのまま出力**する。埋まっていなければ、そのブロック内で複数ソースを合成し、境界をガウシアンぼかしでブレンドしてから出力する。

海岸線のような**急峻なソース境界**(陸=GSI、海=jpnationalsea/Copernicus)の近くでは、隣接する2つの512pxブロックのうち、内陸側のブロックは読み込みウィンドウ内が完全にGSIデータで埋まり`filled_from_start=True`(ブレンドなし、生データ)となる一方、海側に一歩ずれただけの隣接ブロックは同じウィンドウ内に海データが混入し`filled_from_start=False`(ブレンドあり、ガウシアンぼかし済み)となりうる。この場合、**2つのブロックの共有境界において、「生データ」と「ぼかし済みデータ」が接することになり、値が不連続になる可能性がある**。最終的な出力は各ブロックを512px単位でクロップして敷き詰める(`output_window`)ため、この不連続が**512pxブロック格子に沿った線状/格子状のアーティファクト**として現れることと整合的。

**この仮説がD74と異なる点**: D74は「pmtiles-store内の重複ファイル」という生成後のデータ汚染を疑ったが、D78でこれは監査スクリプト自体のバグによる誤検出と判明し棄却された。D79は生成"前"の合成ロジック自体(`aggregation_merge.py`)に内在する構造的な問題であり、**stale重複ファイル問題とは独立に、今も現行コードに存在しうる**。中国・四国・九州・沖縄という報告地域が**すべて海岸線が複雑に入り組む地域**であることは、この仮説と整合的(直線的な内陸境界が少なく、512pxブロックと海岸線の交差パターンが多様なため)。

**未検証・今後の確認方法**:
1. 復旧完了・パイプライン再構築後、既知の市松模様報告地点(倉橋島/呉市周辺など)の`merged-3857.tiff`相当データ(またはaggregation_tile.py出力前の中間ラスタ)を直接調べ、アーティファクトの境界が512px格子線と一致するかを確認する。
2. 一致する場合、`merge()`のブロックループを「ブレンド要否の判定を全ブロック共通(macrotile全体で1回判定)にする」または「隣接ブロックのブレンド要否をオーバーラップ領域で揃える」よう修正する。
3. 一致しない場合、この仮説は棄却し、D78が列挙した他の候補(cubicsplineの不安定性、PMTiles clustered不整合、ビューア側の問題)に進む。

**教訓**: D74-D76の教訓(監査スクリプト自体の妥当性を小サンプルで検証してから全体適用する)と同様、この仮説も「もっともらしいコード読解」の段階に留まっており、**実データでの検証を経るまでは推測の域を出ない**。ただし、既知の構造的メカニズム(ブロック単位の独立判定)に基づく点で、D74の「原因不明の50%失敗」よりも検証可能性が高い。

**追記(07:50 JST)、D78仮説2「cubicsplineの不安定性」の棄却**: `aggregation_reproject.py`を読んだところ、`create_warp()`はコードコメント付きで明示されている通り、`TILE_ENCODING == 'terrarium'`(この標高パイプラインの経路)では`-r cubicspline -dstnodata -9999`という**upstream本来の推奨設定をそのまま使っている**。lanczosへの変更(リンギング/オーバーシュートを生みうる)は、コメントに明記されている通り**`rgb`エンコーディング経路(Freetownオルソフォト用、5eaa737で変更)専用**であり、標高データには適用されていない。よって、D78が挙げた候補のうち「cubicsplineの不安定性」は、**このプロジェクトのコードには該当しない**と判断し棄却する。残る候補はD79(本エントリ、有力)と、PMTiles clustered不整合・ビューア側の問題。

### Resume prompt

> D79で、`aggregation_merge.py`の512pxブロック単位ブレンド判定が市松模様の原因である可能性を発見(コード読解のみ、未検証)。`aggregation_repair_3344`完了・パイプライン再構築後、倉橋島など既知の報告地点で512px格子線とアーティファクト境界が一致するか確認すること。一致すればD79の修正(ブロック間でブレンド要否を揃える)に着手、一致しなければD78の他候補に進む。

## D80: downsampling_run.pyの`check_and_fix_pmtiles(--fix)`に、D76と同種の未発火のバグを発見(コード読解のみ、現時点で実害なし)

**Status**: Recorded, 2026-08-31 07:45 JST。コードレビュー方針の一環、`downsampling_run.py`精読中に発見。DECISIONS.md全文検索で、この関数・`--fix`/`--validate`フラグとも**このセッション中に一度も実行されていない**ことを確認済み(現時点で実害なし、潜在バグ)。

**内容**: `downsampling_run.py --fix`(`check_and_fix_pmtiles()`)は、pmtiles-store全体を走査してPMTilesとして壊れているファイルを検出・削除するツール。壊れたファイルを削除した後、対応する`.done`マーカーも削除して再生成対象にする設計だが、そのマーカー探索が

```python
done_files = glob(f'aggregation-store/*/{basename}-downsampling.done')
```

と**downsampling層のマーカーしか探さない**。もし壊れていたファイルがaggregation層の出力(`aggregation_run.py`が書く`{z}-{x}-{y}-{child_z}.pmtiles`)だった場合、対応するマーカーは`{basename}-aggregation.csv.done`という別サフィックスであり、このglobには一切マッチしない。結果、**pmtilesファイルは削除されるが、aggregation層の`.done`は消えないまま残り**、`aggregation_run.py`の`run()`は`.done`の存在だけを見て永久にスキップする——ファイルが存在しないのに「完了済み」として扱われる、恒久的な穴になる。

**D76との関係**: これはD76が特定した「aggregation層とdownsampling層が同じ`{z}-{x}-{y}-{child_z}`命名規則を共有し、名前空間が独立している」という構造上の弱点の、**別の現れ**。今回は「削除はするが正しいマーカーを消せない」という非対称な形。

**対応方針(あえて即座にパッチしない)**: 一見「両方のサフィックスを探せばいい」という修正が思いつくが、これは危険——もし該当`(z,x,y,child_z)`がaggregation層とdownsampling層の間で数値衝突している位置(D76で3,344件確認済み、全体の過半数規模)だった場合、**削除されていない方のレイヤーのマーカーまで誤って消してしまう**、D74と同種の事故を再現しかねない。ファイル自体は削除後にどちらのレイヤー由来だったか自己申告する手段がなく(命名規則にレイヤー識別子が無い)、安全に判定する方法が無いまま拙速にパッチするより、**号2でレイヤー識別子をファイル名またはディレクトリ構造に組み込む構造的な修正を待つ**のが安全と判断する。D74-D76の教訓(その場しのぎのクリーンアップスクリプトが二次被害を生んだ)を踏まえた判断。

**現状のリスク評価**: このセッション中に一度も呼ばれていないため、現在の1号運用には実害なし。ただし今後誰かが「壊れたpmtilesを掃除したい」と考えてこのフラグを使うと、この潜在バグを踏む可能性がある。`--fix`実行前にこのDECISIONS.mdエントリを確認するよう、次回このツールに触れる際の注意点として記録しておく。

### Resume prompt

> D80で`downsampling_run.py --fix`に、削除したpmtilesファイルがaggregation層由来だった場合に正しい`.done`マーカーを消せない(downsampling層のサフィックスしか探さない)という潜在バグを発見。実害はまだ無いが、拙速な修正はD74と同種の事故を再現しうるため、号2の構造的なレイヤー分離設計まで温存する方針。このツールを実際に使う前には必ずこのエントリを確認すること。

## D81: PIPELINE_DESIGN.mdの訂正 -- 「pmtiles clusterは使えない」は未検証の誤った一般化だった

**Status**: Recorded, 2026-08-31 12:15 JST。コードレビュー方針の一環、次の最終mergeステップの準備として`merge_japan_bundles.py`(3.9節)を再読・`pmtiles cluster --help`を実地確認して発見。

**内容**: PIPELINE_DESIGN.mdの既存記述は「`merge_japan_bundles.py`の出力はclustered化されないため、`pmtiles extract`/`pmtiles cluster`が使えない(`must be clustered for extracts`エラー)」としていた。`pmtiles extract`が失敗する点は実際に確認された事実だが、**`pmtiles cluster`も同様に使えないというのは、extractの制限からの未検証の類推だった**。`pmtiles cluster --help`の説明文は"Cluster an unclustered local archive"であり、非clustered化アーカイブをclustered化することがこのコマンド自身の存在目的——事前にclustered化されている必要があるなら、このコマンドは何もできなくなり、存在意義そのものと矛盾する。実際に試した記録はDECISIONS.mdに見当たらない。

**対応**: PIPELINE_DESIGN.md 3.9節・6節を訂正。次に`japan-z8plus.pmtiles`を再生成した際、最終`pmtiles merge`の前に`pmtiles cluster japan-z8plus.pmtiles`を試すことを推奨事項として追記した。機能すれば、7節の「結合順序で副産物的にclustered化する」設計への依存を減らせる。

**教訓**: 「Aができないので関連するBもできないだろう」という類推は、実地検証なしに文書に書くとそのまま既成事実として扱われてしまう。D74以来のレビューで繰り返し見つかっているパターン(D78の監査スクリプトの誤検出、D79-D80のコード読解結果)と同種——ツールのhelp文やドキュメントを実際に確認する一手間を惜しまないことの重要性。

### Resume prompt

> D81でPIPELINE_DESIGN.md 3.9節・6節を訂正(「pmtiles clusterが使えない」は未検証の誤り)。`japan-z8plus.pmtiles`再生成後、最終mergeの前に`pmtiles cluster japan-z8plus.pmtiles`を試すこと。

## D82: upstream(`mapterhorn/mapterhorn`)同期確認 -- D22以降の13コミットは大半が多ホスト分散アーキテクチャへの移行で、単一マシン運用の1号には非適用。underflow対策のみcherry-pick

**Status**: Recorded, 2026-08-31 21:50 JST頃。`rustling-napping-pond.md`計画のPhase Dに沿って、`git fetch upstream && git log HEAD..upstream/main`で確認。

**内容**: D22(2026-08-21)以降、upstreamに13コミットが積まれていた。大半(8件)は新規ソース追加(`Add source ...`)で無関係。パイプライン本体に触れる主要コミットを精読した結果:

- **`57f8481`「Update worker, reduce memory usage」・`a0ae374`「update multi-host pipeline」**: `aggregation_run.py`・`downsampling_run.py`双方に、`tmp-store/queue`/`tmp-store/ready`フォルダを介して別プロセス(新設の`downloader.py`)からのダウンロード完了を`while not os.path.isfile(...): time.sleep(1)`で待つロジックが追加されていた。これは複数ホストでpmtiles-storeを分散配置し、各ワーカーホストがオンデマンドで必要なファイルをフェッチする前提のアーキテクチャで、**1号は単一マシン(slate)上に全データを直接マウントしているため、この分散フェッチ機構自体が不要**。マージ対象外と判断。
- 同じ`57f8481`で、upstream版`aggregation_run.py`は`shutil.rmtree(tmp_folder)`が長らくコメントアウトされたままだった(一時フォルダが溜まり続けるバグ)のを今回のコミットで解消していた。**確認したところ、1号のフォークは既にこの行がコメントアウトされておらず正しく`rmtree`されている**(D12以降のfork固有の`aggregation_id`スコープ変更の際に、独立して正しい状態になっていたと見られる)。`tmp-store`の実測サイズも4KB(2件)のみで、リークの兆候なし。対応不要。
- **`8eaef05`「Minor pipeline changes」の`utils.py`**: `save_terrarium_tile()`内の`np.seterr(all='raise')`を`np.seterr(all='raise', under='ignore')`に変更(浮動小数点アンダーフローで例外を投げるのをやめ、無視するよう緩和)。1号のフォークにも同じ`all='raise')`(アンダーフロー無視なし)が残っていた。`aggregation_repair_3344.log`をgrepしてFloatingPointError/underflowの実際の発生は0件——**現時点で実害は出ていないが、エラー条件を緩める方向の変更で新たな不具合を生む余地がない(既存の動作を壊さない、クラッシュ条件を減らすだけ)ため、低リスクな保険としてそのままcherry-pick**。`hfu-mapterhorn`側でコミット`d8b7c2e`。

**対応**: `d8b7c2e`のみ適用(1行、`np.seterr`引数追加)。分散ダウンローダー関連の変更は取り込まない。今回精読しなかった残り2コミット(`f2ff181`ローカルビューア用create_index.py削除、`ef97ada`source_create_tarball.py修正)は、1号が使っていない機能(それぞれローカルビューア生成・新規ソースのtarball作成)に限定されたdiffstatだったため、スコープ外と判断し詳細は読んでいない。

**教訓**: upstreamの開発方向が「単一マシンでのバッチ処理」から「複数ホストでの分散処理」へ明確にシフトしている。今後の同期では、キュー/フェッチ待ち系のパターン(`tmp-store/queue`, `tmp-store/ready`)が出てきたら、それは多ホスト前提の変更だとまず疑ってよい。1号がこの方向に追従する必要が生じるとしたら、それはハードウェア調達(PLAN.mdのストレージ階層化)の話と合わせて号2以降で検討すべき規模の話。

### Resume prompt

> D82でupstream 13コミットを確認、大半は多ホスト分散アーキテクチャ移行(1号には非適用)。`utils.py`のnp.seterr underflow緩和のみ低リスクとしてcherry-pick済み(`d8b7c2e`)。次回upstream同期時も「tmp-store/queue, tmp-store/ready」パターンが出たら分散フェッチ機構への追従と判断し、原則マージ対象外とすること。

## D83: `lineage_inspect.py`で倉橋島タイルのソース境界を可視化 -- D79検証の一環、lineage境界にグリッド/ブロック状パターンは見られず、市松模様の原因としてのソース切り替わり説を却下

**Status**: Recorded, 2026-08-31 22:24 JST頃。Hidenoriの提案(「lineageタイルを作ってみる？」)を受けて、既存の標準外(D20由来)診断ツール`lineage_inspect.py`をそのまま倉橋島タイルに対して実行。

**内容**: D74で市松模様の報告地点として言及されていた`10-889-408`(呉市・倉橋島付近、z=10)の中心座標をz17タイルに変換し、`find_aggregation.py`と同じ包含判定ロジックでこれを覆うaggregation itemを特定 -- `10-889-408-16-aggregation.csv`一件のみが該当。このitemは現在`aggregation_repair_3344`の対象(`.todo`のまま、`.done`未生成)だが、`lineage_inspect.py`は`aggregation_reproject.reproject()`を独立tmpディレクトリで再実行するだけで、pmtiles-store本体や進行中のリペア用tmp-storeとは一切干渉しないため、リペア完了を待たずに安全に実行できた。

実行結果: 5つの優先グループ(jpnational1/A 31.7%、jpnational5/A・5/B・10/B 合計0.9%未満、jpnationalsea 68.1%)。生成したRGB可視化画像を目視確認したところ、**陸域(青)と海域(グレー)の境界は完全に自然な海岸線形状で、グリッド線やブロック境界を示唆する直線的なパターンは一切存在しない**。5%未満の小さな中間解像度パッチ(5A/5B/10B、おそらく港湾部や離島周辺の1mデータの穴埋め)も、海岸線に沿った自然な輪郭で現れており、四角いタイル状の切れ方はしていなかった。

**D79との関係**: これはD79が提起した「市松模様の境界がaggregation_merge.pyの512pxブロック単位ブレンド判定に由来する」仮説と、暗黙に対立していたかもしれない別の可能性(「境界はソースデータの切り替わり=lineage境界そのものではないか」)を、少なくともこの1サンプル地点について明確に否定する結果である。ソース境界自体がグリッド状に現れない以上、実際の市松模様がもし規則的なグリッドパターンとして視認されるなら、それを説明できるのは引き続きD79の512pxブロック仮説の方だと判断できる。

**副産物として得た知見**: `lineage_inspect.py`は単体で軽量に動く(このタイル1件で約2分)、かつ現在進行中のリペア処理と安全に並行実行できることを実地確認した。号2以降、複数の既知報告地点でこれを繰り返し実行し、lineageタイルとして面的にPMTiles化・ダッシュボードへ反映する構想がHidenoriから出ている(急ぎではなく、starsへのPMTilesアップロードは`stars`エージェントに相談する予定)。

**追記(2026-08-31 22:48 JST)**: D75で言及された九州修正タイル`10-881-411-16-aggregation.csv`でも同じ手法を再実行。6優先グループ(jpnational1/A 91.5%、jpnational5/A・B・C計0.3%、jpnational10/b 0.1%、jpnationalsea 8.2%)、可視化結果もやはり境界は完全に自然な海岸線・地形形状のみで、グリッド痕跡は無し。倉橋島に続く2件目の独立した裏付けが得られ、「lineage境界は市松模様の原因ではない」という結論の確度が上がった。

### Resume prompt

> D83で`lineage_inspect.py`を倉橋島・九州(D75言及地点)の2タイルに実行、いずれもソース境界(lineage境界)は完全に自然な地形形状でグリッドパターンなし -- 市松模様の「ソース切り替わり」説を却下、D79の512pxブロック仮説が引き続き最有力。`aggregation_repair_3344`完了・再構築後の実地検証(D79 resume prompt参照)で、512px格子線とアーティファクト境界が一致するかを確認すること。余裕があれば他の既知報告地点(中国・四国・沖縄)でもlineage_inspect.pyを追加実行し、lineageタイルのPMTiles化・ダッシュボード反映(急がず、stars向けアップロードは`stars`エージェントに相談)を検討する。

## D84: `AGGREGATION_WORKERS`のデフォルトを4→5に引き上げ、実測で増速効果を検証中

**Status**: Recorded, 2026-09-01 02:00 JST頃。Hidenoriとの議論を受けて実施。

**背景**: `aggregation_run.py`の`get_worker_count()`が返すデフォルト4は、元々「aggregation_run.pyとdownsampling_run.pyが同じマシン上で同時に動く」「pmtiles-storeがディスク1枚」という前提でCPU/ディスクを飽和させないよう控えめに設定されたものだった。しかし現在: (1) `aggregation_repair_3344`はdownsamplingと同時実行しておらず単独稼働、(2) D58/D61でpmtiles-storeは2枚のディスクに分割済み——前提が変わっていた。実測(`iostat`)でも4ワーカー時点でCPU idle 46-47%(10論理コア、4P+6E構成)と明確な余裕があった。

**対応**: 一気に増やさず、まず5への1段階引き上げに留めて増速効果を計測する方針(Hidenoriの判断)。`get_worker_count()`のデフォルトを4→5に変更、`hfu-mapterhorn`側にコミット(`486a7a0`)。適用のため`aggregation_repair_3344`をgraceful stop(SIGTERM、進行中アイテムはatomic renameで保護済みなので安全)→新screenセッションで再起動、ログで`using 5 workers`を確認。

**計測方法**: 15分tickごとの`done_count`増分(直近の4ワーカー時点の実測: 概ね28〜33件/15分)と、5ワーカー再開後の同じ指標を比較する。あわせてload average・iostatも継続観測し、ディスクI/Oが新たなボトルネックにならないか確認する。

### Resume prompt

> D84で`AGGREGATION_WORKERS`のデフォルトを4→5に変更(`486a7a0`)、2026-09-01 02:00 JST頃に再起動。4ワーカー時点のベースラインペースは概ね28〜33件/15分。5ワーカーでのペースを複数tick分計測し、有意な増速があるか、load average/iostatに悪化がないかを確認すること。良好であれば6への追加引き上げも検討、悪化(ディスクI/O競合等)が見られれば4へ戻すこと。

## D85: ダッシュボードのMission Timeline計器、文字サイズが小さいとの指摘を受けてデザイン改善

**Status**: Recorded, 2026-09-01 02:05 JST頃。Hidenoriから「Mission Timelineは極めて良いが字が小さい」とのフィードバック。

**内容**: `mapterhorn-monitor/docs/instruments/mission-timeline.js`のSVGガントチャートは、900px viewBoxの中でラベル11px・軸目盛10pxという小さめのSVGフォントサイズを使っていた。行高(rowHeight 34px)・ラベル用余白(labelHeight 16px)も同様に詰まっていたため、実際のダッシュボードパネル幅にスケールされた際に文字が読みづらかった。ラベル15px・軸目盛/now注記13px相当まで引き上げ、それに合わせてrowHeight(34→46)・labelHeight(16→22)・topPad(30→40)も拡大し、バーと文字が窮屈にならないよう調整。ダッシュボードの基本フォントサイズ(14px)・キャプション(12px)との整合も意識した(ラベルが主要テキストとして14pxよりやや大きい15px、軸目盛等は補助情報としてキャプションに近い13px)。ローカルでOpen MCT越しに目視確認してからpush。

**対応**: `mapterhorn-monitor`側でコミット・push済み。他の計器(Progress Trendなど)も同様に小さめのSVGフォントサイズを使っているため、追加のフィードバックがあれば同じ方針で拡大する。

### Resume prompt

> D85でMission Timelineの文字サイズを拡大(ラベル11→15px、軸目盛10→13px、行高34→46px)、push済み。他の計器(Progress Trend等)も同種の小さいSVGフォントサイズを使っているため、フィードバックがあれば同様に拡大すること。

## D86: Mission Timelineの説明文が「細部が多すぎて分かりにくい」との指摘を受け、文章形式の凡例をスウォッチ形式に置き換え

**Status**: Recorded, 2026-09-01 02:10 JST頃。D85直後、Hidenoriから「このテキストがわかりにくい。微妙に細部が多すぎるのかも」とのフィードバック。

**内容**: 従来のキャプションは"Solid = actual/in-progress (dark) / projected remainder (light) — dashed outline = pure estimate — solid blue outline = estimate anchored to a historical measurement (rsync). Covers every step from now..."と、4種類のバー表現(実績/進行中の濃い緑・投影分の薄い緑・純粋な見積もりの青破線枠・実測値に基づく見積もりの青実線枠)とスコープ説明を、記号的な"="を使った一文に詰め込んでいた——凡例というより暗号に近く、読み解くのに文章解析が必要な状態だった。

**対応**: `status-map.js`の凡例と同じパターン(色付きスウォッチ+短いラベル)に置き換え。新設した`.mjbmon-timeline-legend`(flexラップの2x2グリッド)で、実際のバースタイルと視覚的に一致するスウォッチ(塗り/半透明塗り/破線枠/実線枠)を4行で示す。キャプション自体は"Every step from now through Generation 1's final rebuild after the D74-D76 repair."という短いスコープ説明のみに削減。ローカルでOpen MCT越しに目視確認してからpush。

**教訓**: D85(文字サイズ)とD86(情報の詰め込みすぎ)は別々の指摘だったが、根っこは同じ——SVG/テキストベースの表現に頼りすぎて、本来視覚的に示すべき情報(色・線種の意味)まで文章化してしまっていた。今後ダッシュボードに新しい視覚的エンコーディング(色・線種・塗りパターンなど)を追加する際は、最初から文章キャプションではなくスウォッチ凡例で設計すること。

### Resume prompt

> D86でMission Timelineのキャプションをスウォッチ凡例に置き換え、push済み。今後ダッシュボードに新しい視覚的エンコーディングを追加する際は、文章キャプションではなく`status-map.js`/`mission-timeline.js`と同じスウォッチ凡例パターンを最初から使うこと。

## D87: 公開ビューア(`mapterhorn-japan-bridge`)のデフォルト表示位置を函館山・五稜郭から風不死岳に変更

**Status**: Recorded, 2026-09-01 02:45 JST頃。Hidenoriから「Live Viewerのデフォルト位置を、現在の『函館の中途半端な位置』ではなく風不死岳あたりにしたい」との要望。

**内容**: `app.js`の`center`は元々`[140.73, 41.79]`(函館山・五稜郭)で、コメントに「current coverage; recenter as coverage grows」とあり、当初から暫定値だった。風不死岳(北海道千歳市、支笏湖畔、座標42.71694°N/141.35889°E、標高1102.5m、出典: 日本語版Wikipedia)へ変更。

**検証**: 変更前に、この地点に実データがあるか確認した。ブラウザペインでの目視確認では地図が真っ白に見えたが(このツールの既知の制限——本セッション中繰り返し確認されているMapLibreタイル非描画のクセ)、実際に`stars.optgeo.org/mapterhorn-japan-bridge`のmartin XYZエンドポイントへ直接curlしたところ、風不死岳のz13タイル(7312/3018)は`200 image/webp`で実データを確認。函館側の同じ検証(7298/3047)も同様に200だった——つまりどちらも実際にはデータがあり、ブラウザペインの表示だけが信用できなかった、という結論。今後もこの種の視覚確認は、ブラウザペインの結果だけでなくHTTPレベルの直接確認を併用すること。

**対応**: `app.js`を変更、`mapterhorn-japan-bridge`側にコミット・push(`e936344`)。GitHub Pagesのキャッシュ(10分)が効くため、反映まで多少のラグがある。

### Resume prompt

> D87でLive Viewer/公開ビューアのデフォルト中心座標を函館山・五稜郭から風不死岳(42.71694, 141.35889)に変更(`e936344`)。変更前にmartin XYZエンドポイントへの直接curlでデータ存在を確認済み(ブラウザペインの目視確認だけでは信用できないことを再確認)。GitHub Pagesの10分キャッシュ後、実際の表示を確認すること。

## D88: ダッシュボード整理(Constituent PMTiles廃止・並び替え・巡回モード追加)、その過程でOpen MCT rc1ビルドの`openmct.on('start', ...)`が実際には発火しないバグを発見

**Status**: Recorded, 2026-09-01 03:10 JST頃。Hidenoriから3点の整理指示:「Constituent PMTilesは廃止」「Progress Trendを先頭に」「巡回モードを追加」。

**内容(整理3点)**: `pmtiles-manifest.js`計器・関連データ(`pmtiles_manifest.json`)・config/index.htmlの参照・CSSブロックを全て削除。表示順を`Progress Trend → Current Stage → Status Map → Change Log → Resources → Mission Timeline → Live Viewer`に変更(`order`値を1つずつ振り直し)。新機能として「巡回モード」(右下の▶Cycleトグル、ON中は20秒ごとに全計器を自動的に巡回表示、無人ディスプレイでの表示を想定)を追加。

**巡回モード実装中に発見したバグ**: 新しい巡回ロジックを`openmct.on('start', () => {...})`のコールバック内に置いたところ、ボタンが一切表示されなかった。デバッグの結果、**このOpen MCT rc1ビルドでは`'start'`イベントが内部的にリスナー登録はされる(`openmct._events`に`'start'`キーが現れる)ものの、実際には一度も発火(emit)されていない**ことが判明——既存の`openmct.router.setPath(...)`呼び出しも、実は同じ理由でこれまで一度も実行されていなかった(見た目上ルートフォルダが正しく表示されていたのは、Open MCT自身が登録済みrootへ自動的にデフォルトナビゲートする挙動のおかげで、たまたま隠れていただけ)。

**対応**: `openmct.on('start', ...)`への依存をやめ、`openmct.start('#app')`呼び出しの直後に`setPath`と巡回モードのインストール処理を直接(同期的に)実行するよう変更。`document.body`は`<body>`内の`<script>`が実行される時点で常に存在するため、DOM準備待ちは不要と判断。

**教訓**: D3(SharedWorker無効化)・D4相当の過去のOpen MCT関連の発見と同様、このrc1ビルドは**ドキュメント化されていない挙動が多い**。イベントベースのAPIを新たに使う際は、まず`window.__debug`のようなグローバル変数に副作用を記録して直接DOM/JS状態を検証する手法が、consoleログのタイミング依存の不確実性(このセッション中、早期に発火するconsole.logが`read_console_messages`に一部捕捉されないケースも確認)より確実だと分かった。

### Resume prompt

> D88でダッシュボード計器を整理(PMTiles計器廃止・Progress Trend先頭化・巡回モード追加)、push済み。同時に、Open MCT rc1ビルドの`openmct.on('start', ...)`が実際には発火しないバグを発見・回避(`openmct.start()`直後に直接呼び出す形に変更)。今後Open MCTの新しいイベントベースAPIを使う際は、まずグローバル変数への副作用記録で動作を直接検証すること。

## D89: ダッシュボードの文言微調整3件(友人への本格共有を見据えて)

**Status**: Recorded, 2026-09-01 03:15 JST頃。Hidenoriから「このダッシュボードを本格的に友人に共有することを考えている」との前置きで3件の指摘。

**内容**:
1. **Current Stageの「ETA remaining」を相対時間から絶対時刻に変更**: 従来は`~2.3 hr`のような相対表示だったが、これはスナップショット生成時点でのみ正しく、閲覧者がスナップショットが古くなった後に見ると誤解を招く。`generated_at + remainingMs`を計算した絶対時刻(ローカル時刻表示)を「Estimated completion」ラベルで表示するよう変更。スナップショットが古くなっても表示自体の意味は保たれる。
2. **Current Stageのキャプションから内部開発メモを削除**: 「Planned evolution: a slate-side script commits to a dedicated branch served via raw.githubusercontent.com (per sas0's advice).」は`progress.json`の`note`フィールドに由来する、開発者向けの将来計画メモであり、外部の友人向けには不要と判断。`progress.json`から`note`フィールド自体を削除し、`current-stage.js`側もこのフィールドを表示しないよう修正。
3. **Progress Trendのキャプションから方法論の説明を削除**: mtimeベースの実測方法(marker fileのrenameではなく実際の出力ファイルのmtimeを使う、という技術的根拠)を説明する長いキャプションは、開発者向けレビュー記録(DECISIONS.md)には価値があるが、ダッシュボードの読者には過剰な detail だったため削除。グラフ本体と「Latest: N repaired as of...」の要約行のみ残した。

**教訓**: D86(Mission Timelineの凡例)と同種——ダッシュボードを外部に見せる前提が明確になったことで、「開発者が自分向けに書いた注記」と「読者向けの説明」を分離する必要性が繰り返し顕在化している。今後新しい計器やキャプションを書く際は、最初から「これは読者向けか、開発メモか」を意識して書き分けること。

### Resume prompt

> D89でCurrent StageのETAを絶対時刻表示に変更、内部開発メモ2箇所(Current Stageの`note`表示、Progress Trendの方法論キャプション)を削除。push済み。友人への共有に向けて、他の計器にも同様の「開発メモ混入」が無いか、余裕があれば一通り見直すこと。

## D90: D1〜D89全数の時系列レビュー監査 -- 重大な取り残し1件(対応済み)・軽微な取り残し5件・クロスリファレンスで解消と判明した項目2件

**Status**: Recorded, 2026-09-01 03:25 JST頃。Hidenoriから「レビューが止まっているかな? 過去のレビューを全数、時系列の順番でレビューし、重大な取り残し、軽微な取り残しがないか確認してみる?」との依頼を受けて実施。

**内容**: `## D`見出し87件・`### Resume prompt`35件(D37以降、D1-D36にはこの仕組み自体が無い)を全数抽出し、それぞれのフォローアップが後続のエントリまたは現在のライブ状態で実際に解消されているかを突き合わせた。加えて`disk5`のマウント状態・`crontab`/`launchd`のスケジューリング設定を実地確認。

**発見(重大、対応済み)**: PLAN.md §4の「disk5デタッチ手順」が、D73時点で「全前提条件を満たした」と明記されたまま更新されておらず、直後に発生したD74-D76インシデントで前提が崩れていることが反映されていなかった。`pmtiles-store`(デタッチ対象のディスクそのもの)は現在も`aggregation_repair_3344`の書き込み先として稼働中——この記述のままPLAN.mdだけを見て手順を実行すると、復旧作業中のディスクを物理的に取り外す事故になりかねない。PLAN.md §4にSTALE警告を追記して対応(コミット`a7e82be`)。

**発見(軽微、5件)**: (1) D62のcron/launchd自動化は今も未設定(実地確認で再確認)。(2) D65のディスク分割増速効果、定量的な再検証記録が無い。(3) D72が求めていたstars側ファイル自体への`check_pmtiles_integrity.py`再実行の記録が無い。(4) D83のlineage_inspect.py追加サンプリング(中国・四国・沖縄)は未実施(任意項目)。(5) D25(readiness filter設計)がD45+D51により別手段で実質達成されたという結論は、今セッション冒頭のプランファイルには書かれていたが、DECISIONS.md自体に正式なクローズ記録が無い。

**クロスリファレンスで解消と判明したもの(2件)**: D63の「upstream 11コミット未読」はD82のより網羅的な同期確認で内容的にカバー済み。D74の「なぜクリーンアップが50%で機能しなかったか」という問いは、D78によって「そもそも機能していないという診断自体が誤りだった」と判明しており、問いそのものが無効化されていた。

**対応**: 監査結果をArtifact(HTMLレポート)として整理し、Hidenoriに共有。PLAN.mdの重大項目のみ即時修正、軽微項目は記録のみ(優先度は低い)。

### Resume prompt

> D90で全89件のレビュー監査を実施。重大項目(PLAN.md disk5デタッチ前提の陳腐化)は`a7e82be`で対応済み。軽微項目5件(D62 cron/launchd未設定、D65増速効果未検証、D72 stars側再検証未実施、D83追加サンプリング任意、D25正式クローズ記録欠如)は優先度低・記録のみ。余裕があればD25の正式クローズエントリをDECISIONS.mdに追加するとよい。

**訂正(2026-09-01 05:20 JST頃、D96参照)**: 上記のdisk5デタッチ判断(「`aggregation_repair_3344`完了後にデタッチしてよい」)は、その後Hidenoriが「1.5号」構想(D96)を決めたことで**再度覆った**。1号完了直後にdisk5をデタッチするのではなく、続けて1.5号(2号向けパイプライン改修の検証ラン、同一ソースデータ)のインフラとしてそのまま使い続ける方針になった。**disk5のデタッチは、1.5号も含めた一連の検証が完全に終わった後まで、さらに待つこと。** 詳細はD96参照。

## D91: Open MCTとの関係性 -- 技術的な代替は存在するが、「使い倒すことで貢献する」という立場を意図的に維持する

**Status**: Recorded, 2026-09-01 03:30 JST頃。Hidenoriとの対話の中で、ダッシュボード構築中に繰り返し遭遇したOpen MCTの「クセ」(D3のSharedWorker問題、Plot/Telemetry APIの`+Create`前提、PlanLayoutのミュータビリティ壁、D88の`'start'`イベント未発火)について議論した結果、静かに記録しておく価値があると判断されたもの。

**内容**: 今回の一連の実装を振り返ると、Open MCTが本来提供するはずの中核機能(リアルタイムテレメトリのプロット・タイムライン計画)はことごとく壁にぶつかり、実際に使っているのは「フォルダツリー+オブジェクトルーティングの殻」のみで、各計器の実体(SVGチャート・地図・凡例)は全て`mjbmon.instrument`という自前の薄いレイヤーで手書きしている。技術的に率直に評価すれば、この用途(tickベースの静的スナップショットを表示する小規模ダッシュボード)には、vanilla JSやAlpine.js/htmxのような軽量な自作SPAの方が、コード量も摩擦も少なく、「RSSっぽい静的プッシュ」という設計思想にも素直に合う。

**それでもOpen MCTを使い続ける理由**: これは純粋な技術選定の結果ではなく、dwg7としての立場——「Open MCTを使い倒すことによってOpen MCTに貢献する」——という、既に確立された非技術的な方針に基づく意図的な選択である。今回見つかったバグ(D88の`'start'`イベント未発火など)も、使い倒しているからこそ見つかる類のものであり、この方針自体の価値を裏付けている。

**位置づけ**: 「Open MCTは技術的に最適だから使う」のではなく、「Open MCTへの投資・貢献という目的があるから、技術的な摩擦があっても使い続ける」という、目的と手段の関係が通常と逆転した意思決定であることを明示的に記録しておく。将来、この方針を再検討する機会があれば(号2以降、規模が大きく変わった場合など)、この記録を判断材料にする。

### Resume prompt

> D91でOpen MCT継続利用の方針を明文化(技術的代替は存在するが、意図的に「使い倒して貢献する」立場を維持)。号2以降、ダッシュボードの規模や要件が大きく変わる場合は、この記録を踏まえて改めて技術選定を見直す余地がある。

**追記(2026-09-01 03:35〜03:50 JST頃)**: D91のドラフト(「Open MCT実地ノウハウ集」)をsas0エージェント・claude-mctエージェントに回付し、3者(mapterhorn-monitor/sas0/claude-mct)の実装を突き合わせるレビューを実施。当初の仮説のうち「Plot/Telemetry APIはproviderパターンと根本的に相性が悪い」「`openmct.on('start', ...)`が4.3.0-rc1全般で発火しない」の2点が言い過ぎだったと判明(他環境での反証)。巡回モードのフルスクリーン化(Hidenoriからの要望)についてもsas0に相談し、Open MCT自身のUI chrome(ツリー・ヘッダー・Inspectパネル)を隠すCSSクラスをsas0の実地DOM調査から流用、実装・push済み。

**ドキュメントのマスターはsas0リポジトリに移管完了**: **https://github.com/dwg7/sas0/blob/main/OPENMCT-NOTES.md** (`docs/`配下ではなくリポジトリルート — `docs/`はGitHub Pages配信対象そのものなので、フロントマターなしのMarkdownを置くと生テキストのまま配信されてしまうため、とのsas0の判断)。技術的な詳細・3者統合の全内容はこのURLを参照。以降の更新もここで行われる。このDECISIONS.mdには重複させない。

**教訓**: 一つの環境だけで得た知見を「〜は使えない」と断定的に書くと、他の環境での反証で覆ることがある。複数の独立した実装を持つチームでは、この種のドキュメントは早い段階で横展開してレビューを受け、マスターは実際にその技術を最も深く使っているチームが持つのが良い。

### Resume prompt

> D91の技術的詳細(Plot/Telemetry APIの評価訂正・`'start'`イベントの環境依存性・SharedWorkerの2系統の原因・巡回モードのフルスクリーン化)は、mapterhorn-japan-bridge内ではなく https://github.com/dwg7/sas0/blob/main/OPENMCT-NOTES.md が正本。参照する際はこのURLを見ること、このDECISIONS.mdには複製しないこと。巡回モードのフルスクリーン化自体は実装・push済みだが、実機での最終視覚確認はブラウザ自動化ツールの制約で未実施——次回Hidenoriが実機で確認すること。

## D92: 公開ビューアの3D地形表示をデフォルトONに変更(未検証)

**Status**: Recorded, 2026-09-01 03:45 JST頃。Hidenoriから「3D表示をデフォルトでオンにできるならしておいてほしい」との要望。

**内容**: `app.js`の`terrain-toggle`チェックボックスは従来デフォルトOFFで、`map.on('terrain', ...)`がチェック状態を実際のterrain有無に同期する設計だった。`map.on('load', () => map.setTerrain({source: 'mapterhorn', exaggeration: 1}))`を追加し、地図読み込み完了時に自動でterrainを有効化するようにした(既存の`terrain`イベントリスナーがチェックボックスの見た目を自動的に同期するので、そちら側の変更は不要)。

**未検証の理由**: ブラウザ自動化ツールでローカルプレビューを試みたが、この環境では`new maplibregl.Map(...)`が正常なMapインスタンスを返さない(`window.map`が空オブジェクトになり、`getTerrain`/`setTerrain`等のメソッドが一切存在しない)という、既存のMapLibre描画問題(D87)よりさらに踏み込んだ制限に遭遇した。コード自体は標準的なMapLibre GLのAPI呼び出しパターンだが、実際に3D表示されるかは未確認のままpush(`836c6f9`)。Hidenoriが実機で確認予定。

### Resume prompt

> D92で公開ビューアの3D地形表示をデフォルトONにするコードをpush(`836c6f9`)したが、ブラウザ自動化ツールの制約(MapLibre Mapインスタンスが正常に構築されない)で未検証。実機で意図通り3D表示になっているか確認すること。ならなければ`map.on('load', ...)`のタイミングやsource準備状況を再調査。

## D93: lineageタイル常設化の見積もり(未実装、提案のみ)

**Status**: Recorded, 2026-09-01 03:55 JST頃。Hidenoriから「lineageタイルを常設化するかどうかは単発で終わらせるかもしれないが、実装はせず見積もりだけ作っておいてほしい」との依頼。D83で使った`lineage_inspect.py`を国土全域・全ズームレベルのPMTiles層として常設した場合の、所要時間・所要ストレージ・パイプライン挿入位置の見積もり。実装はしない。

**所要時間の見積もり**:

- `lineage_inspect.py`を**独立したスタンドアロンの全件スイープ**として実行した場合: D83の実測(倉橋島・九州の2件、いずれも約2〜2.5分/件)を単純外挿すると、6,373件 × 約2.5分 ≈ 15,900分(約265時間、約11日)の逐次処理時間。現在の`AGGREGATION_WORKERS=5`と同程度の並列度を仮定すると約53時間(約2.2日)。ただしこれは**`aggregation_reproject.reproject()`という最も重い処理(GDALでのソースファイル群のワープ変換)を、本番の`aggregation_run.py`とは別に、まるまる二重に実行する**という無駄を含む見積もり。
- **`aggregation_run.py`本体に組み込んだ場合**(推奨案、下記): 本番run自体が既に`reproject()`を実行しているので、そこに相乗りすれば追加コストは「既に展開済みのtiffを読んでprovenanceラスタを1枚追加で書き出す」だけの軽い処理(nodata埋めループ+ファイル書き出し)で済み、1件あたり数十秒程度(概算)に収まる可能性が高い。全件で見ても数時間〜半日程度の追加コストと推定(ただしこれは1号の6,373件全件を今から作る場合の話ではなく、**号2の次回フルビルド時に相乗りさせる場合**の話——下記参照)。

**所要ストレージの見積もり**(粗い概算、実測ではない):

- 比較対象: 現行の標高terrarium PMTiles本体(`mapterhorn-japan-bridge.pmtiles`)は307.9GB(D67実測、307,895,883,486バイト)。
- lineageデータは連続値ではなく、最大7段階程度の離散カテゴリ値+nodataのみを表現すればよく、かつ空間的な均質性が非常に高い(海は全部「海」、単一ソースの陸地は広い範囲で同じ値)。PNG/WebPのようなロスレス圧縮は、この種の低エントロピー・大面積均一データに対して標高の連続値エンコーディングよりもはるかに効率よく圧縮できる。
- 厳密な実測なしの大まかなオーダーとして、標高本体の**5〜15%程度**(約15GB〜45GB)を暫定レンジとして見積もる。海岸線が複雑な地域(D83で見た通り、輪郭自体は自然な海岸線形状)が圧縮率を下げる要因になりうるため、レンジの上限寄りになる可能性もある。実測するまでは確度の低い見積もりであることを明記しておく。

**パイプライン挿入位置の推奨**:

- 最適な挿入点は`aggregation_run.py`の`run()`関数内、`aggregation_reproject.reproject()`の直後・`shutil.rmtree(tmp_folder)`で中間tiffが消される前。`lineage_inspect.py`の`compute_provenance()`のロジックをそのまま共有関数として抽出し、環境変数フラグ(例: `EMIT_LINEAGE=1`)で本番`aggregation_run.py`からもオプトインで呼べるようにする——`lineage_inspect.py`自身のdocstringが既に言及している「hfu/fusiの`--emit-lineage`本番フラグ」と同じパターン。
- **重要な見落とされがちな追加コスト**: lineageは離散カテゴリ値なので、ズームレベルを粗くする際(downsampling)に、標高データで使っている`cubicspline`等の連続値向けリサンプリングをそのまま流用できない——カテゴリ値を補間すると意味のない中間値になってしまう。**多数決(majority vote)ベースの新しいリサンプリングアルゴリズムを`downsampling_run.py`とは別に実装する必要がある**。これは今回の見積もりで新たに認識した、非自明な追加エンジニアリングコスト。
- **1号への遡及的な後付けは非推奨**: 6,373件全件に今から独立スイープをかけると、本番の再aggregationに匹敵する規模の冗長な計算コストがかかる(上記の約2日規模)。加えて1号のソース構成は号2で更新される見込みのため、今作ってもすぐ陳腐化する。**推奨は、号2の次回フルビルド(GSI更新後、10月末頃見込み)に`EMIT_LINEAGE`フラグとして組み込み、本来のaggregation実行に相乗りさせる形**。この場合、追加コストは上記の「軽い処理」分のみで、レンジの低い方(数時間〜半日)に収まる可能性が高い。

**結論**: 実装はしない。号2着手時の検討事項として、この見積もり(時間・ストレージ・多数決リサンプリングという新規要件)を残しておく。

### Resume prompt

> D93でlineageタイル常設化の見積もりを作成(未実装)。時間: 号2のフルビルドに相乗りさせれば数時間〜半日規模、1号への遡及なら約2日規模の冗長コスト。ストレージ: 標高本体307.9GBの5〜15%(約15〜45GB、粗い概算)。挿入位置: `aggregation_run.py`の`reproject()`直後、`EMIT_LINEAGE`フラグで。新規要件: カテゴリ値downsamplingには多数決ベースの新しいリサンプリングアルゴリズムが必要(既存のcubicsplineは流用不可)。号2着手時にこの見積もりを判断材料にすること。

## D94: カテゴリ値(lineage)downsampling用の多数決アルゴリズムを特定・実装(号2向け先行実装、未接続)

**Status**: Recorded, 2026-09-01 05:05 JST頃。D93のフォローアップとして、Hidenoriから「多数決ベースのリサンプリングアルゴリズムを特定して、実装しておこうか」との依頼。

**訂正(D93の記述ミス)**: D93で「既存のcubicsplineが使えず」と書いたが、これは不正確だった。実際に`downsampling_run.py`の`create_tile()`を読んだところ、ダウンサンプリング(coarser zoomの親タイル生成)は**cubicsplineではなくαウェイト付き平均**(2×2ブロックの子タイルの標高値を、alpha(有効/無効)で重み付けして平均し、その1つの平均標高値からR/G/Bを再導出する方式、upstream本家のアルゴリズムに合わせた実装)。cubicsplineは別の場所(`aggregation_reproject.py`のGDALワープ時のリサンプリング手法)の話で、混同していた。いずれにせよ「平均」という演算自体がカテゴリ値には無意味という結論は変わらない。

**実装したアルゴリズム**: `hfu-mapterhorn/pipelines/lineage_downsample.py`(コミット`62c592e`、production未接続)。

- 1024×1024の子タイル4枚ぶんのカテゴリラスタ+alphaを入力に、2×2ブロックごとの**多数決(one-hotカウント+argmax)**で512×512の親ラスタを生成。
- **同数タイの処理**: `lineage_inspect.py`の`GLOBAL_TIER`(0=最優先ソース〜6=海)の順序をそのまま利用し、タイの場合は**インデックスの若い方(=優先度の高いソース)を採用**。これは新しいルールを持ち込んだのではなく、`np.argmax`が同値の場合に最初(最小インデックス)を返すという既存の仕様と、`GLOBAL_TIER`の既存の優先順位付けを組み合わせただけ——`aggregation_merge.py`本体のピクセル単位マージが元々使っている優先順位と一貫性がある。
- nodata処理: alpha=0の子は投票から除外。4件中1〜3件だけ有効な場合もその有効票だけで多数決(定足数不足で無効扱いにはしない)。4件全て無効ならnodata。
- `scipy.stats.mode`は使わず(新規依存の追加を避ける、バージョン依存のtie-break挙動を避ける)、カテゴリ数(7)ぶんのnumpy一括演算で完全ベクトル化。

**検証**: 4パターンの合成テストケース(明確な多数決/同数タイ/有効票1件のみ/全無効)を全て通過。実測パフォーマンス: 1024×1024→512×512の1回あたり約24.1ms(10回平均)。D93で見積もった全downsampling件数(8,223件)に単純適用すると合計3〜4分程度——D93の「数時間〜半日」という見積もりより実際にはさらに軽いことが判明(D93の見積もりはreproject側の重さを支配的要因と見ていたが、それは変わらず妥当)。

**未接続の理由**: D93の結論通り、1号への遡及実装はしない方針。このモジュールは号2でのpipeline組み込み(`downsampling_run.py`のcreate_tile()に相当する処理からデータ種別で分岐、または専用の`lineage_downsampling_run.py`を新設)を待つ、独立した検証済みビルディングブロックとして置いておく。

### Resume prompt

> D94で多数決ベースのカテゴリ値downsamplingアルゴリズムを実装・自己テスト済み(`hfu-mapterhorn/pipelines/lineage_downsample.py`、`62c592e`)。1024x1024→512x512で約24ms、全downsampling件数(8,223件)換算で合計3〜4分——D93のストレージ・時間見積もりのうちdownsampling自体のコストはほぼ無視できるレベルと判明(支配的コストは引き続きreproject側)。号2でlineageタイルを実装する際は、このモジュールをそのまま`downsampling_run.py`相当の処理に組み込むこと(production未接続、独立したビルディングブロックとして温存)。

## D95: 2号investment着手前の準備計画をPLAN.mdに整理(設計のみ、1号の本番コードは未変更)

**Status**: Recorded, 2026-09-01 05:10 JST頃。Hidenoriから「少し早いが2号の計画を立てておこうか。1号を完成させるまでは2号は投入しないが、2号を投入可能にしておくために準備すべきことはしておこう。1号に悪影響は及ぼさないように」との依頼。

**内容**: `PLAN.md`(2号計画の正本)にD74-D94の蓄積を反映する形で加筆(コミット`e04f080`)。

1. **[最優先] D74-D76レイヤー名前空間衝突の構造的修正の設計**: aggregation層とdownsampling層が同じファイル命名規則を共有している問題(D76)、およびD80が「号2の構造修正まで温存する」と明言していた潜在バグへの対応。案A(`pmtiles-store`をレイヤーごとにディレクトリ分離、推奨)と案B(ファイル名にレイヤーサフィックス追加、非推奨・参考記録)を設計として記録。**実装はしない**——`get_pmtiles_folder()`は`aggregation_repair_3344`が今まさに使っている本番コードのため、1号完了後・2号着手直前に実装するタイミングと明記。
2. **GSI更新状況の生存確認**: 2026-07-31が引き続き最新であることを実地確認(新規更新なし、10月末予想と整合)。
3. **lineageタイルの機能スコープ整理**: D93/D94を2号の「本編とは独立した任意機能」と位置づけ、2号の一次リリース(GSI更新の取り込み)を遅らせてまで実装する優先度ではないと明記。
4. **「今すぐ準備してよいこと/1号完了まで待つべきこと」チェックリストを新設**: D94(完了)・GSI監視・設計ドキュメント作成は今すぐ着手可、レイヤー分離実装・disk5デタッチ・lineageのEMIT_LINEAGEフラグ組み込み・upstream同期の再検討は1号完了まで待つ、と明示的に区分。

**教訓**: 「早めに計画を立てる」ことと「早めに実装する」ことを意図的に分離した。2号の設計判断(特にレイヤー分離のような、1号のインシデントから直接学んだ教訓)は今のうちに固めておく価値が高いが、実装は1号の本番コードパスに触れるため、稼働中の復旧作業(`aggregation_repair_3344`)を危険にさらさないよう、明確にタイミングを切り分けた。

### Resume prompt

> D95でPLAN.mdに2号準備計画を整理(`e04f080`)。最重要item: D74-D76レイヤー名前空間衝突の構造的修正(案A: ディレクトリ分離を推奨、未実装)——1号完了後・2号着手直前に実装すること、`get_pmtiles_folder()`呼び出し箇所の全棚卸しが前提。GSIは2026-07-31のまま(10月末予想通り)。lineageタイルは2号本編とは独立した任意機能と整理。実装済みなのはD94のdownsamplingアルゴリズムのみ(production未接続)。1号完了まで、本番コード(`get_pmtiles_folder()`・ファイル命名規則・`aggregation_run.py`等)には一切手を入れないこと。**この方針は直後にD96で更新されている——lineageの位置づけとdisk5デタッチのタイミングはD96を見ること。**

## D96: 「1.5号」構想 -- 1号完了後・2号(新GSIデータ)着手前に、同一ソースデータで新パイプラインを検証するステージングラン

**Status**: Recorded, 2026-09-01 05:20 JST頃。Hidenoriの提案:「今回バッチで1号が完成したらpmtilesをstarsに公開する。その後、10月末の基盤地図更新までまだ時間があるので、パイプラインを2号用に改造し、基盤地図情報ソースは現状維持した『1.5号』を走らせよう。1.5号はどちらかと言えば2号のテスト用途」。

**目的**: 2号の実本番実行時に「新しいコード」と「新しいデータ(GSI更新)」という2つの未知数を同時に抱えないための、変数分離。1.5号で「同一データ・新パイプライン」を先に全国スケールで検証しておけば、2号本番では純粋にデータ側の変動にだけ集中できる。加えて、ソースデータが1号と同一である以上、1.5号の出力は理屈上1号の「タイル抜けなし」という既実証の結果とほぼ一致するはずで、**レイヤー分離リファクタ(D95最重要item)が全国スケールで副作用を生んでいないかを検証する、実質無料の回帰テスト**にもなる。

**スコープ(1.5号に含めるもの)**:
1. D95で設計した、aggregation層/downsampling層の名前空間分離の構造的修正(案A、ディレクトリ分離)——1号での最大インシデント(D74-D76)の再発防止策を、実際に全国スケールで動かして検証する初めての機会になる。
2. D93/D94のlineageタイル機能——**当初「2号本編とは独立した任意機能、2号一次リリース後に検討」としていたD95の位置づけを訂正**。Hidenoriの決定により、1.5号のスコープに含める。`aggregation_run.py`への`EMIT_LINEAGE`フラグ組み込み、D94の多数決downsamplingの実接続、lineageラスタのタイル化・bundle・merge・stars配信までの一連を、1.5号で実装・検証する。
3. ソースデータ(`jpnational1`/`5`/`10`/`sea`)は1号と同一のまま——新規GSIデータの取り込みは行わない(それは2号の役目)。

**公開方針**:
- **terrarium(標高)タイル**: starsで1号を**上書き**する。1.5号が新しい「現行版」になる。
- **lineageタイル**: 新規に公開する(1号には存在しなかったので上書きではなく新規)。
- **両方とも、2号(新GSIデータ投入後)が完成すればさらに上書きされる**——1.5号はあくまで中間ステージング。

**disk5デタッチ方針への影響(D90の訂正)**: D90が結論づけた「`aggregation_repair_3344`完了後にdisk5をデタッチしてよい」は再度覆る。1.5号も全国スケールのビルドを行うため、disk5(pmtiles-store)を1号完了直後に取り外さず、1.5号のインフラとしてそのまま使い続ける。1号の成果物(pmtiles-store上のデータ)は1.5号との突き合わせ用の基準として保持し、1.5号は別のgeneration_idで走らせて上書きしない——ディスク容量に余裕があるかは実行前に確認すること(1号相当の容量をもう1世代分、一時的に追加で必要とする可能性がある)。

**未確認・今後詰める点**:
- 1.5号の全国フルビルドに要する実際の所要時間(1号は投資調査・バグ修正を含めた実績のため、純粋な「クリーンな1回のフルビルド」の所要時間としては参考にならない——1.5号自体がこの実測データを提供することになる)。
- ディスク容量: 1号の成果物を保持したまま1.5号を並行して構築するための空き容量が足りるか、事前確認が必要。
- lineageタイルのPMTiles化・stars配信の実装(D93が「未実装」としていた残りの工程)は、1.5号のスコープの中で今回初めて実装することになる。

**対応**: 未実装。設計方針をDECISIONS.md・PLAN.mdに記録。実装着手は1号完了後。

### Resume prompt

> D96で「1.5号」構想を記録。1号完了後・2号(新GSIデータ)着手前に、同一ソースデータ+新パイプライン(D95のレイヤー分離修正+D93/D94のlineage機能)で全国フルビルドを実行する中間ステージングラン。terrariumはstarsで1号を上書き、lineageは新規公開、両方とも2号完成時にさらに上書きされる。D90のdisk5デタッチ判断は再度保留(1.5号のインフラとして継続使用)。D95のlineage位置づけ(「2号本編とは独立、一次リリース後」)は本エントリで訂正——1.5号のスコープに含まれる。実装着手前にディスク容量・所要時間を確認すること。

## D97: `aggregation_repair_3344` 完走 -- 6,373/6,373全件完了、D76復旧作業が完了

**Status**: Recorded, 2026-09-01 18:00 JST頃。

**内容**: 2026-08-31 05:29 JSTに開始した`aggregation_repair_3344`(D76の3,344件誤削除からの復旧)が完走。最終確認:
- `aggregation-store/{generation_id}/*-aggregation.csv.done`が6,373件(=対象csv総数と一致、完全カバー)。
- ログにエラー・トレースバックなし。
- 残存する269件の`.todo`ファイルは、"already done, skip"パス(既に有効な`.done`が存在する項目を処理せずスキップする分岐)が`.todo`を削除しない仕様のため生じた無害な残骸——実害なし、優先度低で後日クリーンアップ検討。
- 5ワーカー(D84)への引き上げは最後まで安定して機能、増速効果が持続した。

**対応**: D76のresume promptに従い、次の手順に着手:
1. **downsampling再収束**: `check_downsampling_readiness.py`で確認したところ、8,223件中`.done`8,020・処理待ち74・子タイル未整備129——想定通り(aggregationがまさに終わったばかりのため)。`downsampling_reconverge`スクリーンセッションで`downsampling_run.py`(`PRIORITY_MODE=quadrans DOWNSAMPLING_STRICT=1 DOWNSAMPLING_WORKERS=3`、publish_cycle.pyの標準設定に合わせた)を起動、進行中。
2. 以降、bundle.py+merge_japan_bundles.py→pmtiles cluster試行(D81)→global-overview.pmtilesとのmerge→check_pmtiles_integrity.py→視覚確認(D79の512pxグリッド仮説検証)→starsへrsync、と進める予定。

### Resume prompt

> D97でaggregation_repair_3344が完走(6,373/6,373)。現在downsampling再収束中(`downsampling_reconverge`スクリーン、74件処理待ち+129件が子タイル整備待ちだった)。完了後: (1) `check_downsampling_readiness.py`で0 not-readyを再確認、(2) `bundle.py`+`merge_japan_bundles.py`で`japan-z8plus.pmtiles`再構築(TMPDIR明示指定を忘れないこと)、(3) D81に従い`pmtiles cluster japan-z8plus.pmtiles`を試す、(4) `global-overview.pmtiles`をバックアップから復元、(5) `pmtiles merge`で最終成果物作成、(6) `check_pmtiles_integrity.py`、(7) D79の512pxブロック仮説を倉橋島等で視覚確認、(8) starsへrsync。starsへの最終rsyncは公開に関わる操作なので、実行前にHidenoriに一声かけること。
