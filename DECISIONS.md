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
