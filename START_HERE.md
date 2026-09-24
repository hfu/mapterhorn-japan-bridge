# START_HERE.md

**Read this file first, then stop.** It is a map, not a manual: ~5 minutes
to orient, then it points you at the one other document that actually
answers your question. Nothing here is authoritative on its own — every
section names the file that is.

Last reconciled against the code: **2026-09-07**. If today is much later
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
| `optgeo/japan-geotiff-dem` | `slate`, `/Volumes/Migrate-2025-04/github/japan-geotiff-dem-repo/` | Upstream-of-us: GSI DEM → GeoTIFF → Source Cooperative. **Also upstream Mapterhorn's own Japan data source** since 2026-08 (D160). Has its own `CLAUDE.md`/`DECISIONS.md`; ask questions there, not here. |
| `hfu/mapterhorn-monitor` | GitHub Pages | Open MCT dashboard for long runs. Separate repo. |
| `hfu/japan-bridge-lineage` | GitHub Pages | Standalone globe-view showcase of the lineage layer (Vite + MapLibre GL JS, pinned to 5.24.0 -- 6.x's raster-dem loading is broken, see `DECISIONS.md` D146-adjacent history). Separate repo, built for sharing outside the dashboard (e.g. with Oliver Wipfli). |

**Everything computational happens on `slate`.** Whether you need SSH to get
there depends on where *this session* is running — **check first, don't assume**
(D156: a session burned time SSHing to `slate.local` from `slate` itself, where
it fails on key auth and risks tripping sshd's rate limiting):

```
hostname          # slate.local means you are already there — just cd and run
```

If `hostname` looks ambiguous, `diskutil info /Volumes/Migrate-2025-04 | grep Protocol`
settles it: `USB` (any physically-local protocol) means this machine *is* `slate`,
since that disk can only mount as `local` where it is physically attached. From a
genuinely remote session host, it is `ssh hfu@slate.local '...'`.

Two physical disks matter and are easy to confuse:
- `/Volumes/Migrate-2025-04` — code, `source-store`, `aggregation-store`, `bundle-store`
- `/Volumes/pmtiles-store` — `pmtiles-store` and `tmp-store`, symlinked in from `pipelines/`

Refer to them by **mount point, never by `diskN` identifier** — Migrate-2025-04
is USB-attached and re-enumerates: it was `disk6` for weeks, briefly vanished
mid-session on 2026-09-11, and came back as `disk4` (D158). The mount point is
stable; the device node is not.

`stars` (`stars@stars.local`) is the public serving host: martin + Caddy at
`stars.optgeo.org`. Publishing is an `rsync` there, **not** Source Cooperative
(SC choked on the multi-hundred-GB multipart PUT — D13).

Deeper: `CLAUDE.md` § "The three-way split".

## 3. 1号 / 1.5号 / 1.6号 / 2号

Conversational shorthand for **generations**. A generation is one
`aggregation_id` ULID, minted by `aggregation_covering.py`, and it is the
directory key the whole store is organized under.

- **1号** — the first full national build. Complete and **currently live** on
  `stars`. Frozen: nothing writes to it any more.
- **1.5号** — same source data as 1号, structurally rebuilt pipeline
  (generation_id store layer, layer/datatype namespace separation, lineage
  tiles). Mission complete, currently live on `stars` — but see §6 below,
  its published elevation archive has a known, already-fixed-in-code bug
  (nodata pixels rendering as fake 0m) not yet republished.
- **1.6号 — launched 2026-09-17 (D173), currently live on `stars`.** Same
  source data as 1.5号 again, plus D165's pipeline fixes (including the
  nodata bug above) and the land-area maxzoom upsampling feature (D149-151
  design, D166 implementation). `generation_id` `01M2EAPPYXT8RWNC6TXBRT36JE`.
  Patched live 2026-09-19 for a real, nationwide "壁" (wall) 3D-terrain
  artifact traced to a genuine upstream Copernicus GLO-30 inventory gap
  (D174-D178) — see `HANDOVER.md`'s current top section for the full arc.
- **1.7号 — minted 2026-09-24, national build running now.** Same source
  data as 1.6号 again (not a data-update generation — Hidenori's own
  decision to keep 2号 reserved for that), bundling D180's coastal
  seam-blur fix and D182's z13-z16 wall extension. `generation_id`
  `01M39W0T76QKN3GYJCPWX5MDHM`. See `HANDOVER.md`'s current top section
  for exactly what's running and what's left.
- **2号** — the real next-*data* build, gated on GSI shipping a new DEM1A
  quarterly update. Now launches AFTER 1.6号 AND 1.7号, not before. Working
  estimate: end of November 2026.

**The label → ULID table lives in `PLAN.md` section 0 and nowhere else.**
Do not copy it into other files; go read it. To find what the code thinks is
current: `ls pipelines/aggregation-store/` (newest ULID last) — and note that
`bundle.py` defaults to `get_aggregation_ids()[-1]`, i.e. *the latest
directory that exists*, which is why a generation's directory is
deliberately not pre-created before launch. **For 1.6号 specifically, minting
the ULID and adding it to `utils.LAND_UPSAMPLE_ZOOM_BY_GENERATION` must
happen at the same time, before any aggregation work starts for it** — D166's
own finding #3 documents exactly what silently goes wrong if that table
entry is added after some items are already built.

Deeper: `PLAN.md` §0 (IDs), §6 (1.5号 scope), §1 (2号 trigger), `DECISIONS1.md`
D166 (1.6号's own design + implementation).

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

- **Authoritative right now:** `DECISIONS1.md` **D179-D183** and `HANDOVER.md`'s
  topmost "Current state" section (compacted 2026-09-24 — read that section
  in full before touching anything, it is dense and everything in it is
  current).
- **1.6号 remains launched and live on `stars`** (D173, then patched with
  the wall fix D174-D178, 2026-09-19) — unaffected by what follows below.
- **1.7号 (`01M39W0T76QKN3GYJCPWX5MDHM`, minted 2026-09-24) is a NEW
  generation, currently building.** Same source data as 1.6号, bundling two
  fixes: D180 (a nationwide "loose coastline" artifact — real 1m DEM1A
  relief smoothed away by up to 102m near the coast, root-caused to
  `aggregation_merge.py`'s own coastal seam-blur being miscalibrated for
  z16, fixed and verified via two independent Opus design reviews that
  converged on the same design) and D182 (the z13+ deeper-zoom wall
  extension D177 had left an open empirical question — now confirmed real
  near Takeshima, root-caused to be much broader than one gap, and fixed).
  **1.7号's own national aggregation run is running right now** in a
  detached `screen` session on `slate` (`agg_1_7go`) — check
  `HANDOVER.md`'s "Current state" section for exactly how to check on it
  and what still needs to happen after aggregation finishes (downsampling,
  bundle, merge, THEN re-applying the wall-fix scripts to 1.7号's own fresh
  archive, THEN verification, THEN Hidenori's own separate go-ahead before
  any `stars` publish).
- **2号 stays reserved exclusively for GSI's next real DEM1A data update**
  (Hidenori's own explicit 2026-09-24 decision) — not triggered as of the
  last live check (2026-09-24, still 2026-07-31). Launches after both
  1.6号 and 1.7号.
- All work through the 2026-09-24 session (`hfu-mapterhorn` `dcd2e75`,
  `mapterhorn-japan-bridge` `07b1a20`) is **pushed** to both repos'
  `origin/main`. Still always check `git log origin/main..HEAD` before
  assuming a later session's work is pushed — this has bitten the project
  before.
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
