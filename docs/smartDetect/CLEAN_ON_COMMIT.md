# CLEAN_ON_COMMIT — Clean detected strips against visible POLYLINEs on Space

A normalisation pass that runs inside the strip-detection commit handler
(`MainMapEditorV3.handleCommitSimilarStrips`) when the user presses `Space`
to persist the flashing green preview. It reuses `cleanSegments` to align
junctions between the freshly detected strips and the POLYLINE annotations
already on screen, and to merge duplicate / overlapping collinear walls,
**before** any new annotation is written to the DB.

Related tools:
- `STRIP_DETECTION.md` — the drawing tool that produces the strips.
- `DETECT_SIMILAR_POLYLINES.md` — full-viewport variant (same commit path).
- The underlying cleanup algorithm lives in
  [`src/Features/annotations/utils/cleanSegments.js`](../../src/Features/annotations/utils/cleanSegments.js),
  with the 5 cm border-proximity snap added in #182.

## Why

Before this pass, every commit was standalone: the newly created
POLYLINE(s) landed at the exact centerlines returned by the detector,
with no awareness of neighbours. As a result:

- A vertical strip that stops ~3 cm short of an existing horizontal wall
  stayed short — the user had to re-click the "clean" action to fix the
  junction.
- A detected strip that overlapped a previously committed collinear wall
  produced two duplicates on the same axis instead of one merged
  annotation.

Running `cleanSegments` once at commit time, with both the new strips
AND the existing visible walls in the same input set, fixes both cases
in a single atomic step.

## Trigger & opt-in

| Event                          | Effect                                           |
|--------------------------------|--------------------------------------------------|
| User presses `Space` during strip detection | `handleCommitSimilarStrips({ strips, sourceAnnotation })` fires. |
| `cleanOnCommit === true` (default) | The pass runs; `strips` is replaced by the cleaned list before the create call. |
| `cleanOnCommit === false`     | The pass is skipped; `strips` flows through unchanged. |

The flag lives in `smartDetectSlice.js`:

```js
cleanOnCommit: true,  // initial state
// setter: setCleanOnCommit(boolean)
```

It can be toggled from devtools or wired to a UI checkbox later; the
default is ON.

## Pipeline overview

```
Space pressed
    │
    ▼
┌────────────────────────────────────────────────────────────────────┐
│  handleCommitSimilarStrips({ strips, sourceAnnotation })           │
│                                                                    │
│  if (!cleanOnCommit) → skip to create step                         │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  1. BUILD MERGED SEGMENT LIST                                │  │
│  │                                                              │  │
│  │    a) Existing annotations (from useAnnotationsV2 —          │  │
│  │       same source as the exclusion mask):                    │  │
│  │         - Only POLYLINE, not closed, points.length === 2     │  │
│  │         - Multi-point polylines are SKIPPED                  │  │
│  │         - Keep real annotation id + point ids                │  │
│  │                                                              │  │
│  │    b) Detected strips:                                       │  │
│  │         - id = "tmp_" + nanoid()   ← routing marker          │  │
│  │         - points = centerline endpoints (new nanoid ids)     │  │
│  │         - strokeWidth(Unit) inherited from strip /           │  │
│  │           sourceAnnotation                                   │  │
│  │         - `_strip` reference attached for output routing     │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  2. cleanSegments({ segments: [...existing, ...detected],   │  │
│  │                      meterByPx })                            │  │
│  │    → { updates: [{id, points}], deleteIds: string[] }        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  3. ROUTE RESULT                                             │  │
│  │                                                              │  │
│  │    updateMap  = Map(updates)                                 │  │
│  │    deleteSet  = Set(deleteIds)                               │  │
│  │                                                              │  │
│  │    Detected ("tmp_") ──► cleanedStrips:                      │  │
│  │      - drop if in deleteSet                                  │  │
│  │      - replace centerline by updated points if in updateMap  │  │
│  │      - otherwise unchanged                                   │  │
│  │                                                              │  │
│  │    Existing (non "tmp_") ──► DB write (atomic):              │  │
│  │      - for each updated point: db.points.update(id, {x, y})  │  │
│  │        with coords NORMALISED by imageSize                   │  │
│  │      - for each deleted annotation: db.annotations           │  │
│  │        .bulkDelete([...])                                    │  │
│  │      - one db.transaction("rw", [db.points, db.annotations]) │  │
│  │      - on error: console.error + early return (new strips    │  │
│  │        NOT created)                                          │  │
│  │      - on success: dispatch(triggerAnnotationsUpdate())      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ▼                                                                 │
│  createAnnotationsFromDetectedStrips({                             │
│    strips: cleanedStrips, sourceAnnotation                         │
│  })                                                                │
└────────────────────────────────────────────────────────────────────┘
```

## Input composition

The merged list passed to `cleanSegments` mixes two origins. A
`tmp_` id prefix on the synthetic detected-strip records is the only
marker needed to route outputs back to the right sink afterwards.

| Field                | Existing annotation                | Detected strip                      |
|----------------------|------------------------------------|-------------------------------------|
| `id`                 | real annotation id                 | `"tmp_" + nanoid()`                 |
| `points[i].id`       | real point id (stable in DB)       | fresh `nanoid()`                    |
| `points[i].{x,y}`    | image-pixel coords (from `useAnnotationsV2`) | image-pixel coords (already local in the strip pipeline) |
| `points[i].type`     | inherited                          | `"square"`                          |
| `strokeWidth`        | from annotation                    | `strip.strokeWidth ?? sourceAnnotation.strokeWidth` |
| `strokeWidthUnit`    | from annotation                    | idem                                |
| Extras               | —                                  | `_strip` (original strip, for routing) |

All coordinates are in **image-pixel** space. This is the same space
`cleanSegments` expects (`meterByPx` is the physical-world bridge for
the border-proximity threshold). No conversion is needed because
`useAnnotationsV2` already resolves normalized point coords via
`resolvePoints × imageSize`, and the strip detector works in image-px
throughout (base map has `imageScale = 1`).

### Why 2-point-only filter

The existing annotations fed into the pass are limited to **non-closed
2-point POLYLINEs**. Detected strips are always 2-point by construction,
so they match trivially. Multi-point user-drawn polylines are
deliberately skipped:

- Splitting them into virtual segments at commit time would replicate
  the logic already in `useCleanSegments` but adds a per-point delete /
  replace burden on the DB.
- A silent mutation of a user's compound wall on what looks like a
  strip-detection commit would be surprising.
- The manual "Clean" action remains the tool for compound walls; this
  pass is deliberately narrow.

## `cleanSegments` — what changes in the geometry

Full reference: the algorithm header comment in
`src/Features/annotations/utils/cleanSegments.js`. A short summary of
the passes that matter at commit time:

1. **Collinear merge** — parallel segments within 1 px perpendicular
   distance whose projected intervals overlap or touch get fused into a
   single segment; duplicates are marked for deletion.
2. **1.5 — Early border-proximity snap** (from #182) — endpoint outside
   another segment's stroke within 5 cm physical distance and with its
   perpendicular projection inside that segment's extent is pulled 1 px
   inside the nearest border. Direction-preserving (anchored at the
   other endpoint).
3. **2 — L/T junction snap** — endpoints within 5 cm of another
   segment's border are snapped to the correct side (current side when
   approaching from outside, anchor side when already inside).
4. **2.5 — Past-extent snap** — endpoints whose projection falls just
   past the end of another segment get aligned exactly on that
   segment's end border.
5. **Id unification** — endpoints that end up within 1 px of each other
   after all snaps share a single point id (topology glue).

When `meterByPx === 0` (base map with no scale), passes 1.5, 2, 2.5 fall
through without applying the physical threshold. Collinear merge and id
unification still work, so the commit degrades gracefully to "no
physical-threshold snap but still duplicate cleanup".

## Output routing

The router partitions `cleanSegments`'s output using the `tmp_` id prefix:

### Detected strips (id starts with `tmp_`)

Emitted as the new `cleanedStrips` list consumed by
`createAnnotationsFromDetectedStrips`:

- If the id is in `deleteIds` → the strip is dropped (usually because
  it merged into an existing collinear wall; the existing wall will be
  extended instead, via its own `updates` entry).
- If the id is in `updates` → the strip's centerline is replaced by the
  new point coords; `strokeWidth`, `stripOrientation`, and all other
  fields on `_strip` are preserved.
- Otherwise → the strip flows through untouched.

### Existing annotations (id does NOT start with `tmp_`)

Written directly to the DB in a single atomic transaction:

- For each updated point, `db.points.update(pointId, { x, y })` with
  **normalized** coords (divide by `imageSize.width` / `imageSize.height`
  — the storage model documented in
  [`docs/annotations/POINTS_STORAGE.md`](../annotations/POINTS_STORAGE.md)).
- Deleted annotation ids go through `db.annotations.bulkDelete(...)`
  (soft-delete middleware handles `deletedAt`; the hard-delete helper
  is not needed here).
- Both operations share one `db.transaction("rw", [db.points,
  db.annotations], ...)` — all-or-nothing.
- On success, `dispatch(triggerAnnotationsUpdate())` bumps the tick that
  invalidates the `useAnnotationsV2` live query and the cached
  exclusion mask.
- On error, `console.error` is logged and the handler returns early:
  `createAnnotationsFromDetectedStrips` is NOT called, so the user ends
  up with the pre-commit state intact.

## Guarantees

- **No id collision**: synthetic detected records always carry a
  `tmp_` prefix; the router's `startsWith("tmp_")` filter is exact.
- **Atomic DB write**: cleanup either fully succeeds or leaves the DB
  untouched. A partial update followed by a failed create cannot occur.
- **Graceful no-scale fallback**: `meterByPx === 0` (or missing) skips
  the physical-threshold snap passes inside `cleanSegments` — merges
  still work, snaps just don't.
- **Multi-point polyline safety**: the `points.length === 2` filter
  guarantees no silent mutation of compound walls at commit time.
- **Undo parity**: the Dexie undo middleware already covers
  `db.points` / `db.annotations` writes, so `Ctrl+Z` reverts the DB
  delta in one step, and the strip creation (itself undoable) in
  another.

## Source of annotations

The handler closes over the `annotations` array from `useAnnotationsV2`,
which is the **same** source passed down to `InteractionLayer` and used
by `buildExclusionMask.js`. This is intentional: the pass sees exactly
the walls the user sees on screen (visibility / layer filtering applied)
and exactly the walls used to mask out already-drawn pixels during
detection. There is no alternative annotation source; keep this
invariant when refactoring.

## Verification scenarios

1. **Adjacent-wall snap** — draw a horizontal POLYLINE, detect a
   vertical wall that stops ~3 cm short of it, press `Space`. The new
   POLYLINE's tip should land exactly on the horizontal wall's border
   (1 px inside, per `SNAP_DEPTH_PX`).
2. **Merge on detect** — commit a wall, detect a second collinear wall
   that overlaps the first, press `Space`. The two merge into one
   POLYLINE: one `delete` on the detected tmp id and one `update` on
   the existing annotation's endpoint (or vice-versa, depending on
   which one `cleanSegments` elects as the kept id).
3. **No scale set** — unset `meterByPx` on the base map. Commit still
   works; only the 5 cm physical-threshold snap is skipped.
4. **Multi-point POLYLINE nearby** — draw a compound L-shaped polyline,
   then commit detected strips next to it. The compound polyline must
   NOT be modified (filtered out by `length === 2`).
5. **Toggle off** — dispatch `setCleanOnCommit(false)`. Commits should
   write the detected centerlines as-is, with no DB touches on existing
   annotations.
6. **Atomicity** — force a throw inside the transaction (e.g. invalid
   point id). The handler must log, return early, and leave the DB
   state unchanged; the detected strips must NOT get created.

## Related files

- Handler & wiring: `src/Features/mapEditor/components/MainMapEditorV3.jsx`
  (`handleCommitSimilarStrips`, near the `// ── CLEAN-SEGMENTS PASS ──`
  marker).
- Flag: `src/Features/smartDetect/smartDetectSlice.js` (`cleanOnCommit`,
  `setCleanOnCommit`).
- Algorithm: `src/Features/annotations/utils/cleanSegments.js`.
- Annotation source: `src/Features/annotations/hooks/useAnnotationsV2.js`
  (+ `resolvePoints`).
- Exclusion-mask source (same annotations):
  `src/Features/smartDetect/utils/buildExclusionMask.js`.
- Strip creation: `src/Features/mapEditor/hooks/useCreateAnnotationsFromDetectedStrips.js`.
- Points storage model:
  [`docs/annotations/POINTS_STORAGE.md`](../annotations/POINTS_STORAGE.md).
