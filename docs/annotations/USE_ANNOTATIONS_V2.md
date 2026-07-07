# useAnnotationsV2 — Data Pipeline & Performance Architecture

## TL;DR for Claude

`useAnnotationsV2` ([src/Features/annotations/hooks/useAnnotationsV2.js](../../src/Features/annotations/hooks/useAnnotationsV2.js)) is the single source of resolved annotations for the whole app (2D editor, 3D viewer, listings panel, legend, print…). It is mounted **~6-8 times simultaneously** in the map editor, with different options per caller.

Three invariants to preserve when editing it (all from issue #290):

1. **Never mutate an object in stage B** — always spread (`{...a, qties}`). The identity-stabilization cache compares this run's output against cached objects from the previous run; an in-place mutation makes an object compare equal to itself and breaks change detection.
2. **Never remove the `db.annotations.count()` / `db.points.count()` reads** at the top of the liveQuery callback. They look useless; they are what keeps every instance's liveQuery *observing* those tables now that the heavy reads are served from shared module caches (Dexie only re-runs a liveQuery on writes to tables its callback actually read).
3. **Do not add `annotationsUpdatedAt` back to the liveQuery deps.** Dexie observes natively every table read inside the callback; the Redux tick made each commit run the whole pipeline twice per instance. Any flow that needs to force a refresh must write to an observed table instead (see the "Relancer la soustraction" button in `SectionAnnotationSubtractions.jsx`, which touch-writes the source annotation).

## The two stages

```
┌─ Stage A — async Dexie liveQuery (per instance, re-runs on DB writes) ─┐
│ tracked count() reads (observation keep-alive)                        │
│ annotation rows        ← shared module cache (promise per query key)  │
│ js filters (listing/layer/scope/solo-independent)                     │
│ listings               ← module cache (_listingsCache)                │
│ layers sort, image files (batched)                                    │
│ point rows             ← shared per-id module cache (+ inflight dedup)│
│ resolvePoints → pixel space, cuts, guideLine, proxies, profiles       │
│ entities (withEntity)  ← module cache (_entitiesCache)                │
└────────────────────────────────────────────────────────────────────────┘
┌─ Stage B — sync useMemo (per instance, re-runs on Redux/props change) ─┐
│ template overrides → qties (withQties) → subtractions → solo filter    │
│ → tempAnnotations → sort (sortByOrderIndex) → groupByBaseMap           │
│ → identity stabilization (stabilizeAnnotationsIdentity)                │
└────────────────────────────────────────────────────────────────────────┘
```

## Identity stabilization (stage B output)

Problem it solves: the pipeline rebuilds every annotation object on each run, so even untouched annotations got new references → `memo(NodeAnnotationStatic)` was defeated → ~1000 SVG nodes re-rendered on every commit.

[stabilizeAnnotationsIdentity.js](../../src/Features/annotations/utils/stabilizeAnnotationsIdentity.js) keeps a **per-hook-instance** cache (`useRef` — never module-level, because `withEntity/withQties/withListingName` change the object shape per instance) mapping `id → previous object`. Each run, every output object is compared structurally against the cached one; if equal, the **previous reference** is returned. The array identity itself is also preserved when nothing changed.

- Bounded structural equality: depth 5, beyond → treated as different (cache miss = new ref, never a stale hit; correctness is preserved, only reuse efficiency is lost). `NaN === NaN`, functions ignored.
- `subtractionTargets` (embedded full annotations) compared **by id only**, with a second pass: a source is refreshed when one of its targets changed this run (otherwise 3D carve / qties could read stale target geometry through a reused source reference).
- `baseMap` / `entity` compared by reference, else `id + updatedAt`.
- Why structural equality and not an `id + updatedAt` key: moving a vertex writes `db.points` **without touching the annotation row**, and the resolved output also depends on template / baseMap / listings / subtractions / solo state. Comparing the pipeline *output* is correct by construction.
- Log: `[debug_perf] useAnnotationsV2 [caller] stability: X/Y reused (Zms)` — on a unitary commit, expect `(N-1)/N reused` and only the touched annotation('s node) re-rendering.

## Shared stage-A IDB reads

Problem it solves: the ~6 mounted instances each re-ran the full stage A on every commit. Their **filter signatures differ** (withEntity, scope, hidden listings, hideBaseMapAnnotations…), so the *result* cannot be shared — but the underlying IDB reads are identical. Six concurrent heavy reads serialize on IndexedDB: measured `DB fetch` ramping 300ms → **1.3s** per commit with ~550 annotations / ~5k points.

Two module-level caches in `useAnnotationsV2.js`:

- `_annotationsRowsCache: Map<queryKey, Promise<rows[]>>` — key is the exact IDB query (`baseMaps:<ids>` / `listing:<id>` / `project:<id>`). The first instance stores the **promise** (so followers piggyback even while the read is in flight). Consumers copy the array (`[...]`) before filtering — the layers block sorts in place. Row objects are never mutated downstream (resolve/enrich steps spread into new objects — keep it that way).
- `_pointsRowsCache: Map<pointId, row|null>` + `_pointsInflightFetches` — per-id cache; only ids neither cached nor in flight hit `bulkGet`. A `_pointsCacheGeneration` counter guards against a race: a `bulkGet` that resolves *after* an invalidation discards its rows instead of caching stale data (the invalidating write re-triggers every liveQuery anyway).

### Reactivity contract (the subtle part)

A Dexie liveQuery re-runs only on writes to tables **its own callback read**. A follower instance that consumed only cached rows would stop observing and go blind. Hence:

- **Observation keep-alive**: every callback starts with `await Promise.all([db.annotations.count(), db.points.count()])` — cheap tracked reads observing the full tables. (Slightly broader than the old per-range observation: writes to *other* base maps now also re-run the queries; they complete fast thanks to the caches.)
- **Same-tab invalidation**: Dexie table hooks (`creating/updating/deleting`) fire synchronously during the write, *before* any liveQuery re-run reads the cache. Annotations: full clear. Points: per-id delete + generation bump — **including `creating`**: a point id can be negatively cached (`null` = "no such row") when a read raced its creation, and the creating hook is what drops that stale null.
- **Cross-tab invalidation**: table hooks don't fire for other tabs' writes; the global `Dexie.on("storagemutated")` (the same signal that re-runs liveQueries cross-tab) clears everything — but **only for foreign mutations**: local writes set a `_sawLocalWrite` flag in the hooks, and the listener skips the full clear when it is set (they were already precisely invalidated). Without that skip, every local commit wiped the whole points cache and forced a full ~N-thousand-point refetch per commit — the main source of IDB contention during drag/draw commits. Note `_listingsCache` / `_entitiesCache` predate this and rely on same-tab hooks only.

### Expected debug output

```
[debug_perf] useAnnotationsV2 [caller] (545 annotations):
  DB fetch:       Xms (3 listingIds, shared rows hit|MISS)
  ...
  points/qties:   Xms (4980 pts, 12 from db)
```

Per commit: exactly **one** `shared rows MISS` per distinct query key (the leader), all other instances `hit`; `from db` ≈ only the points touched by the commit (plus the full set once, on the first run after load). If every instance logs `MISS`, the invalidation is firing between instance runs — check for a write loop.

## Write side: one transaction per drawing commit

The re-run cost above is paid **once per committed Dexie transaction** (each top-level transaction fires one `storagemutated` → one liveQuery re-run wave across all instances). The drawing commit (`useHandleCommitDrawing`) therefore DEFERS all its writes — new point rows, snap-insertion updates on target annotations, cut/carved points — into `pendingPointRows` / `pendingAnnotationUpdates`, and flushes them in ONE transaction together with the annotation write:

- create path: `createAnnotation(ann, { pointRowsToSave, annotationUpdatesInTx })` → `useCreateEntity`'s `options.tx` branch wraps `db.files.put` + `db.annotations.add` + points + mapping rels in a single `db.transaction`;
- update path (drawn cut on an existing annotation): `updateAnnotation(updates, { pointRowsToSave, annotationUpdatesInTx })` wraps everything similarly.

Rules when touching these flows:
- **Non-Dexie awaits must stay outside the transaction** (file data prep, `updateItemSyncFile`, image decoding…) — a non-Dexie await inside a Dexie transaction commits it prematurely.
- New writes added to the drawing commit should be pushed to the pending arrays (or added to the `tx.writes` callback), not written immediately — an immediate write adds a full re-run wave.
- Bonus of deferral: an early return in the carve/merge paths no longer leaves orphaned point rows in `db.points`.

Same idea elsewhere: `pasteAnnotationService` and `useUpdateAnnotations` already batch their writes in a single transaction — follow that pattern for any new multi-record mutation.

## Caller map (map editor, MAP viewer)

| caller | feeds | notable options |
|---|---|---|
| `MainMapEditorV3` | StaticMapContent (the SVG nodes) | withEntity, sort, scope, hidden listings |
| `useVisibleAnnotations` | tools/lasso/hollow-out | same filters, no entity |
| `useLegendItems` | legend | by baseMapId, hidden listings |
| `useAnnotationTemplateQtiesByIdForBaseMap` | qties panel | by baseMapId, scope, withQties |
| `useEntities` | entities panels | **no filters** (project-wide), withQties |
| `useSelectedAnnotation` | selection panel | **no filters** (project-wide) |
| `PopperMapListings` | listings popper | ignoreSolo, withQties, hideBaseMapAnnotations |

`useEntities` and `useSelectedAnnotation` share the `project:<id>` rows key; most others share `baseMaps:<id>`.

## History (issue #290)

Zoom-side fixes live elsewhere: rAF-coalesced camera + `--map-zoom` freeze in `MapEditorViewport.jsx` (flag `FREEZE_MAP_ZOOM_DURING_GESTURE`), viewport culling via `visibleViewBox` in `InteractionContext` → `StaticMapContent` (`filterAnnotationsByViewBox`), renderer memoization (`NodeAnnotationStatic` + `Node*Static`).
