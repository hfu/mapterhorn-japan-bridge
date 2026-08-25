# 2号計画 (Generation 2 planning)

Forward-looking plan for the next national build cycle, written ahead
of it actually starting. Not a decision log (that's `DECISIONS.md`) and
not a session narrative (that's `HANDOVER.md`) — this file is "what we
intend to do differently next time and why," kept current as a living
document until 2号 actually kicks off, at which point its outcomes
belong in `DECISIONS.md` as usual.

Started 2026-08-25, while 1号 (`01M0MWK852631SHCHPA66F21WQ`, the first
full national generation) is still finishing its own aggregation run
(840/1,979 done at time of writing, ETA late 2026-08-27 to early
2026-08-28 at current pace — see `DECISIONS.md`'s own recent entries
for the live numbers, don't trust this snapshot once it's stale).

## 1. What triggers 2号

**Corrected understanding, from a direct exchange with Oliver Wipfli
(`DECISIONS.md` D42)**: our own refresh cadence should be anchored to
GSI actually shipping new DEM1A data (check
`https://service.gsi.go.jp/kiban/app/data_update_info/` periodically —
no fixed schedule is documented anywhere; Japan's 1m tier is
characterized as still early-stage with unusually large *quarterly*
updates, and the one real data point on record is a ~1-year gap between
the 2025-07 and 2026-07 announcements, which is thin evidence, not a
committed cadence). **Do not wait passively for a signal from
Mapterhorn's own release cycle** — Oliver's own release trigger is
demand-aggregated across 130+ terrain sources and he only cuts a
release when someone actively tells him fresh data is ready. The
correct posture is: refresh proactively when GSI moves, then tell
Oliver, and let his own release timing be entirely his call.

**Practical implication**: someone (Hidenori, or a scheduled check)
needs to periodically watch GSI's update-info page. Not automated as
of this writing — worth considering for 2号's own scope (a cheap
periodic check, not a full pipeline trigger) if this becomes a
recurring cadence rather than a one-off.

## 2. Scope: what actually needs refreshing

- `jpnational1`/`jpnational5`/`jpnational10`/`jpnationalsea` all need
  their `source_download.py` re-run against `japan-geotiff-dem`'s own
  freshly-regenerated manifest once GSI's next real update lands and
  that repo's own pipeline (`extract → convert → sync → filelists`)
  has processed it.
- **Expected scale, externally cross-checked (D42)**: Oliver's own
  independent diff against Mapterhorn's existing `jpdem1a` source found
  ~106,648 new files and ~20,996 stale-to-remove, against a total
  291,779-file manifest — i.e. roughly a third of the corpus churns
  per real update cycle. 2号 should expect a similar order of
  magnitude, not a small incremental patch.
- `jpnational1`'s own `bounds.csv`/`polygon-store` need regenerating
  after the source refresh (D35: confirmed *not* urgently blocking —
  `aggregation_covering.py` doesn't consume `polygon-store`, and
  `bounds.csv` is header-only — but still needs to happen before it
  goes stale enough to matter for something else).

## 3. Data-quality baseline for 2号

D18's corruption investigation (in `japan-geotiff-dem`) is what found
the `gmldem2tif.rb` bug in the first place. Status as of this writing:

- The tool itself is fixed (`tif_valid?` now forces a real decode).
- All 45 originally-confirmed-corrupted files in the 10
  originally-suspect `4929`/`4930` meshes are fixed and re-verified.
- A full ground-truth sweep of the entire 109-mesh `4929`/`4930` zone
  is in progress at time of writing (`scripts/ground_truth_check.py`
  against all 109 downloaded raw GML zips) — **check its outcome
  before starting 2号's own source refresh**. If it finds anything new,
  that gets fixed the same way (re-convert, re-upload, re-verify,
  regenerate both manifests, propagate to `slate`) before 2号 trusts
  `jpnational1` as clean.
- **Deliberately still deferred**: whether the same corruption-bug
  class exists in 5m/10m (same tool, same `-n $(nproc)` parallelism
  setting, never tested — D18's own "まずは1mに集中しよう" call). Worth
  a real decision before or during 2号: test it, or explicitly accept
  the residual risk again the way 1号 did for the 1m case.
- **Worth considering as a standing practice, not a one-off**: since
  the corruption bug was execution-environment-dependent (a fresh
  re-run of identical code on identical input didn't reproduce it),
  there's no guarantee 2号's own fresh GSI download-and-convert pass is
  immune. A lighter-weight version of `ground_truth_check.py` (or a
  cheap decode-forcing screen like `screen_source.py`, already built)
  run against a *sample* of newly-converted meshes each cycle, not just
  once retroactively, would catch a repeat before it reaches
  publication. Not committed to yet — a real design question for 2号,
  not assumed.

## 4. Infrastructure prerequisites

- **D41's storage-tiering split** (`source-store`/`bundle-store` →
  slow storage, `tmp-store` → fast internal disk): Hidenori was
  procuring slow-storage hardware as of D41. If it's landed by the
  time 2号 starts, this is the natural moment to migrate — a fresh
  generation with no in-flight aggregation to disturb is a much safer
  window than doing it mid-burn. If it hasn't landed, 2号 can still
  start on the current single-volume setup; this isn't a hard blocker.
- **D37's `downsampling_covering.py` preflight gap**: still not
  automated into `publish_cycle.py` as of this writing — every new
  generation needs someone to remember to run it by hand once before
  the first publish cycle, or downsampling silently produces nothing
  forever (D37's own finding). **Fix this before 2号's first publish
  cycle**, not after rediscovering the same gap again.
- **D37/D44's `bundle.py` pmtiles-store race, now fixed** (`hfu-
  mapterhorn` `8b4a50c`): 1号 hit this 3 times out of 8 publish
  cycles (37.5% — see D44's full audit). `bundle.py` now catches the
  race's `FileNotFoundError` per source file and skips just that
  file's tiles for the current pass instead of crashing the whole
  cycle. Carries forward to 2号 automatically (same script, same repo)
  — no separate action needed at 2号's kickoff, but if a *new* crash
  signature ever appears there, don't assume it's the same already-
  fixed race without checking the traceback's actual missing filename
  first.
- **1号's own residue cleanup**: once 1号 fully completes, its
  `pmtiles-store`/`tmp-store`/`aggregation-store` footprint becomes the
  next generation's "old-generation" cleanup candidate, exactly like
  D40/D29's own Kyushu-generation precedent. Reuse that audit
  methodology (position-based cross-reference against the *new*
  generation's own covering, not naive filename/date matching — D29's
  own lesson) rather than re-deriving it. Don't start 2号's own build
  before deciding whether to clean 1号's leftovers first or let them
  coexist temporarily (D29's root-cause mechanism means old-generation
  `pmtiles-store` files at shared positions get silently overwritten in
  place as 2号 processes them anyway — only genuinely orphaned
  positions need an explicit sweep, same as this session's own finding).
- **Worker configuration**: 1号 settled on `AGGREGATION_WORKERS=4`,
  `DOWNSAMPLING_WORKERS=3` (D38/D39) after real measurement. Treat this
  as a starting point for 2号, not a permanent constant — re-measure if
  the hardware changes (see storage tiering above) or if 2号's own
  scale differs meaningfully from 1号's.

## 5. Open format question: LERC for the published source

Oliver asked whether the Source Cooperative-published GeoTIFFs
themselves (not this project's own internal aggregation intermediates)
could match Mapterhorn's own preferred input format — LERC compression,
internally tiled, no overview pyramid. Explicitly **not** the same
question D22 already answered (D22 tested LERC on short-lived,
repeatedly-re-read aggregation intermediates and correctly rejected it
there, 15-35x slower due to `aggregation_merge.py`'s own windowed
re-read pattern — a final, write-once/read-once published file has a
completely different cost profile, plausibly closer to Oliver's own
experience of "small difference switching to LERC").

**Real architecture lead worth investigating for 2号, not committed
to**: if `aggregation_merge.py` were ever redesigned around a
single-pass read per source file (matching Oliver's own pipeline's
access pattern) rather than the current repeated-windowed-read design,
LERC could become viable for *our own* aggregation intermediates too —
addressing D40's storage-trajectory concern from an architecture angle
distinct from D41's physical storage tiering. This is real engineering,
not attempted yet, and would need its own benchmark (same discipline as
D22) before adoption either way.

**Decision needed before or during 2号**: does `source_to_cog.py` (or
an equivalent) get un-skipped for `jpnational1` to produce a
Mapterhorn-ready LERC/tiled/no-overview variant, published alongside
(not instead of) the general-purpose COG this project currently
publishes? Tradeoff already flagged by Oliver himself: not ideal for
general GIS usage (no true COG without overviews, older software may
lack LERC support). Not decided yet.

## 6. Explicitly out of scope for this planning pass

- Actually starting 2号 — gated on GSI shipping real new data, not on
  this document being finished.
- The `mapterhorn/mapterhorn#186` LERC-for-storage-transfer discussion
  Oliver had with `lseelenbinder` — a separate, still-open question
  from everything above (marginal gain observed there: 412MB vs 425MB
  on one Canada tile), revisit only if `source_to_cog.py` work above
  actually starts.

## Resume note

If picking this file up cold: check `DECISIONS.md`'s most recent
entries for 1号's actual completion status first (this document's own
"840/1,979... ETA late 2026-08-27" line goes stale fast), and check
whether the full-109-mesh ground-truth sweep (section 3) actually
finished clean or found something new before assuming section 3 is
settled.
