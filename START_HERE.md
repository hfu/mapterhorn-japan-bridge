# START_HERE.md

**Read this file first, then stop.** It is a map, not a manual: ~5 minutes
to orient, then it points you at the one other document that actually
answers your question. Nothing here is authoritative on its own — every
section names the file that is.

Last reconciled against the code: **2026-09-06**. If today is much later
than that, treat the "current status" section as a lead, not a fact, and
re-derive it from `DECISIONS.md`'s last few entries.

---

## 1. What this project is

Produce Mapterhorn-format terrain tiles (PMTiles, Terrarium encoding, 512px)
for **all of Japan**, priority-merged from GSI's 基盤地図情報 DEM at seven
accuracy tiers, and serve them from `stars`.

It is an **interim bridge**. When upstream `mapterhorn/mapterhorn`'s own
`jpdem1a` source picks up the GSI survey updates we are ahead of, this whole
effort — both repos and the Source Cooperative product — is meant to be
retired. Design decisions are allowed to be "good enough for a temporary
bridge"; that is deliberate, not sloppiness.

Deeper: `README.md` (public framing), `CLAUDE.md` § Mission.

## 2. Topology — who runs where

| Thing | Where | What it is |
|---|---|---|
| `hfu/mapterhorn-japan-bridge` | GitHub Pages only; docs live in git | **Docs + preview viewer. No pipeline code.** You are reading its docs now. |
| `hfu/mapterhorn` | `slate`, `/Volumes/Migrate-2025-04/github/hfu-mapterhorn/` | The **actual pipeline**, in `pipelines/`. A real fork of upstream — keep it close to upstream, bug fixes only. |
| `optgeo/japan-geotiff-dem` | `aalto` | Upstream-of-us: GSI DEM → GeoTIFF → Source Cooperative. Has its own `CLAUDE.md`/`DECISIONS.md`; ask questions there, not here. |
| `hfu/mapterhorn-monitor` | GitHub Pages | Open MCT dashboard for long runs. Separate repo. |
| `hfu/japan-bridge-lineage` | GitHub Pages | Standalone globe-view showcase of the lineage layer (Vite + MapLibre GL JS, pinned to 5.24.0 -- 6.x's raster-dem loading is broken, see `DECISIONS.md` D146-adjacent history). Separate repo, built for sharing outside the dashboard (e.g. with Oliver Wipfli). |

**Everything computational happens on `slate` over SSH.** From a session host:

```
ssh slate-via-spacex 'cd /Volumes/Migrate-2025-04/github/hfu-mapterhorn/pipelines && ...'
```

Two physical disks matter and are easy to confuse:
- `/Volumes/Migrate-2025-04` (disk6) — code, `source-store`, `aggregation-store`, `bundle-store`
- `/Volumes/pmtiles-store` (disk8) — `pmtiles-store` and `tmp-store`, symlinked in from `pipelines/`

`stars` (`stars@stars.local`) is the public serving host: martin + Caddy at
`stars.optgeo.org`. Publishing is an `rsync` there, **not** Source Cooperative
(SC choked on the multi-hundred-GB multipart PUT — D13).

Deeper: `CLAUDE.md` § "The three-way split".

## 3. 1号 / 1.5号 / 2号

Conversational shorthand for **generations**. A generation is one
`aggregation_id` ULID, minted by `aggregation_covering.py`, and it is the
directory key the whole store is organized under.

- **1号** — the first full national build. Complete and **currently live** on
  `stars`. Frozen: nothing writes to it any more.
- **1.5号** — same source data as 1号, structurally rebuilt pipeline
  (generation_id store layer, layer/datatype namespace separation, lineage
  tiles). A staging + regression run, so 2号 does not carry "new code" and
  "new data" as two unknowns at once.
- **2号** — the real next build, gated on GSI shipping a new DEM1A quarterly
  update. Working estimate: end of November 2026.

**The label → ULID table lives in `PLAN.md` section 0 and nowhere else.**
Do not copy it into other files; go read it. To find what the code thinks is
current: `ls pipelines/aggregation-store/` (newest ULID last) — and note that
`bundle.py` defaults to `get_aggregation_ids()[-1]`, i.e. *the latest
directory that exists*, which is why 1.5号's directory is deliberately not
pre-created before launch.

Deeper: `PLAN.md` §0 (IDs), §6 (1.5号 scope), §1 (2号 trigger).

## 4. Where to look for what

| Question | File |
|---|---|
| Why is it like this? | `DECISIONS.md` (D1–D124, append-only ADR log) |
| How does the code actually work today? | `PIPELINE_DESIGN.md` |
| What are we planning to do next, and why? | `PLAN.md` |
| What happened last session / what do I do first? | `HANDOVER.md` (top section only) |
| Day-to-day operating rules, repo split, source priority | `CLAUDE.md` |
| How to babysit a multi-hour run | `MONITORING_REQUIREMENTS.md` |
| Anything before 2026-09-01 | `HANDOVER-archive.md` |

`DECISIONS.md` is ~8,000 lines. **Never read it linearly.** Use
`grep -n "^## D" DECISIONS.md` to get the index, then read the 3–5 entries
you actually need. Entries are numbered chronologically and later entries
routinely *correct* earlier ones (D74→D75→D76→D78; D101→D102;
D113→D114→D115). Always read the later one.

## 5. The invariants that have actually caused incidents

These are not style preferences. Each one below cost real data or real days.

1. **`pmtiles-store` paths must always come from
   `utils.get_pmtiles_folder(x, y, z, layer, datatype, generation_id)`.**
   Never glob `pmtiles-store/*` directly in new code. The layer
   (aggregation/downsampling) and generation namespaces collide by
   *coordinates* — a `{z}-{x}-{y}` that exists in both layers is common
   (3,344 of 6,373 positions in 1号). Conflating them is what deleted 3,344
   legitimate aggregation outputs. `generation_id` is deliberately a required
   argument so a half-updated call site fails loudly. (D74–D76, D95, D107, D124)

2. **A `.done` marker means "this once succeeded", not "this is still valid".**
   1号's markers were empty touch files; a rename upstream of them left 7,079
   permanently-stale markers that no run would ever retry. Since D124 they are
   JSON manifests carrying datatype coverage and an inputs fingerprint, so
   freshness is checked — but 1号's legacy empty markers still exist and
   parse as freshness-unknown. **Never treat a `.done` count as proof of
   correctness**; cross-check with `check_downsampling_done_integrity.py`
   and `check_pmtiles_integrity.py`. (D53, D69, D100, D119, D124)

3. **`TMPDIR` must point at a big volume, always.** The `pmtiles` Python
   `Writer` and the Go `pmtiles` CLI both buffer the entire archive into the
   OS temp dir, which on macOS is the small boot volume. This has filled the
   boot disk, corrupted a 310GB archive, and caused repeated ENOSPC crashes.
   Python scripts now force-override it at import; for the Go CLI **invoke
   `./pmtiles ...` from `pipelines/`, never bare `pmtiles`** — the wrapper
   script sets it for you. (D104, D105, D120, D124)

4. **Never put upstream's `jpdem1a` into `source-store/` alongside ours.**
   Equal maxzoom, alphabetical tie-break, so its stale data silently wins.
   Keep it in `source-catalog/` and out of the store. (D6)

5. **Source priority is seven real tiers, merged per pixel:**
   `1 > 5a > 5b > 5c > 10a > 10b > sea`. Lower letter = better survey and must
   win. This was silently inverted once by alphabetical filename sorting.
   (D18, D20; enforcement lives in `utils.get_grouped_source_items()`)

6. **Verify before assuming a doc is current.** This project moves faster
   than its own documentation; three of the four incidents above were found
   *after* a document confidently described the opposite. When a doc's claim
   is load-bearing for what you are about to do, check it against the code.

## 6. Current status

> This section is the one part of this file that is expected to rot.
> It is a pointer, not a record.

- **Authoritative right now:** `DECISIONS.md` **D145/D146** and `HANDOVER.md`'s
  topmost "Current state" section.
- As of 2026-09-06: **1.5号 is mission complete.** Both of D96's founding
  goals are done — D95's namespace separation validated at real national
  scale with zero incidents, and the lineage feature implemented, published,
  and extended to a lower zoom floor (D146) for a nationwide overview. Both
  elevation (314.66GB) and lineage (204.6MB) archives are live on `stars`,
  verified clean. A standalone showcase site (`hfu/japan-bridge-lineage`)
  was also built and shared externally (Oliver Wipfli). 1号's own data was
  never touched throughout.
- **Next: 2号**, gated on GSI shipping a new DEM1A update (`PLAN.md` §1 —
  still not triggered as of a 2026-09-06 live check). Launch-readiness was
  reviewed the same day (`PLAN.md` §8): code/infra are essentially ready
  (2号 needs no pipeline code changes, by 1.5号's own design), but a few
  items are still open — the JGD2011→JGD2024 CRS change (§1) hasn't been
  verified against `aggregation_reproject.py`, 5m/10m's corruption-bug-class
  exposure is untested, and the dirty-tracking design question (D57) is
  undecided. **2号 itself launches in a fresh session, not whichever session
  did this prep** (Hidenori's own call).
- All work through D146 is **pushed** to both repos' `origin/main`. Still
  always check `git log origin/main..HEAD` before assuming a later session's
  work is pushed — this has bitten the project before.
- `publish_cycle.py` is **hard-guarded off** (it `sys.exit(1)`s immediately,
  D115) and was never used for 1.5号's own publish either — publishing has
  been fully manual since 1号, per the runbook that's now in `DECISIONS.md`
  D124/D142/D145. Do not remove the guard without doing the repair it names.

## 7. Conventions

- **Language**: converse with Hidenori in **Japanese**; everything committed
  to a repo — code, comments, prose, commit messages — in **English**.
  (Some older docs violate this; new writing should not.)
- **Docs are ALL_CAPS.md** at repo root.
- **Every non-trivial decision gets a `## D{n}` entry in `DECISIONS.md`**,
  including the ones that turned out to be wrong — corrections are appended
  as new entries, earlier entries are not rewritten.
- **Ask before anything irreversible**: `rsync` to `stars`, deleting from
  `pmtiles-store`, detaching disk5, launching a national run.
