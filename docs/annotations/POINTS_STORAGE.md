# Annotations & Points — Storage Model

## TL;DR for Claude

When you write annotation geometry to the DB, **never** store pixel coordinates inline on `annotation.points`. The DB stores point coordinates separately, in normalized `[0..1]` form. Storing pixel inline x/y will silently fail to update the rendered geometry.

The correct pattern, copy-pasteable:

```js
// 1. Push the new point(s) to db.points (NORMALIZED to [0..1] vs imageSize).
const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
const { width, height } = imageSize ?? { width: 1, height: 1 };

const newPointId = nanoid();
await db.points.add({
  id: newPointId,
  x: pxX / width,
  y: pxY / height,
  projectId,
  baseMapId,
});

// 2. Reference the point by id in the annotation. NO inline x/y.
await db.annotations.update(annotationId, {
  points: [{ id: newPointId }, { id: otherPointId }],
});
```

## The two tables

| Table | What it stores | Coord space |
|---|---|---|
| `db.points` | `{ id, x, y, projectId, baseMapId }` | **Normalized `[0..1]`** vs `baseMap.image.imageSize` |
| `db.annotations` | `{ id, type, points: [{id, type?}], ... }` | `points` is an array of **`{id}` references** to `db.points` |

The `points` field on an annotation is **just a reference list**. The actual geometry lives in `db.points`. There is also a legacy fallback that allows inline `{id, x, y, type}` on `annotation.points`, but **see "Why inline x/y silently fails" below**.

## Read path: `useAnnotationsV2` + `resolvePoints`

When annotations come out of the DB into React, [`useAnnotationsV2.js`](../../src/Features/annotations/hooks/useAnnotationsV2.js) builds a `pointsIndex` from `db.points` and calls [`resolvePoints`](../../src/Features/annotations/utils/resolvePoints.js) for each annotation:

```js
// resolvePoints.js (simplified)
return points.map((point) => {
  const pointFromIndex = pointsIndex[point.id];
  if (pointFromIndex) {
    // PRIMARY: db.points wins. Multiplied by imageSize → pixel coords.
    return {
      ...point,
      x: pointFromIndex.x * imageSize.width,
      y: pointFromIndex.y * imageSize.height,
    };
  } else if (hasXorY) {
    // LEGACY fallback: inline x/y on the annotation.
    // ALSO multiplied by imageSize — i.e. inline x/y are stored as [0..1] too.
    return {
      ...point,
      x: point.x * imageSize.width,
      y: point.y * imageSize.height,
    };
  }
  return point;
});
```

Two consequences:

1. **In React, points are in pixel space.** Anything reading from a hook (`useAnnotationsV2`, the toolbar, drawing layers) sees pixel x/y.
2. **In the DB, points are in `[0..1]`.** Both via `db.points` (canonical) and via legacy inline x/y on `annotation.points`.

## Write path: don't shortcut it

When a feature wants to update an annotation's geometry (cleaning, merging, repairing, splitting…), the input data it gets from React is in **pixel coords**. If you want those updates to stick, you must:

1. **Compute** the new geometry in pixel space (so it lines up with what the user sees).
2. **Normalize** before writing: `x_db = x_px / imageSize.width`, `y_db = y_px / imageSize.height`.
3. **Persist via `db.points`**, not inline. Mint fresh point IDs; don't overwrite existing `db.points` entries (other annotations may share those IDs — see "Sharing point IDs" below).
4. **Reference** the new point IDs from `annotation.points = [{id}, {id}]`. Drop any inline `x`/`y` here.

### Why inline x/y silently fails

`resolvePoints` checks `pointsIndex` **first**. If `point.id` matches an entry in `db.points`, the inline `x/y` you wrote is ignored. So writing inline pixel values to an annotation that already has a corresponding `db.points` entry produces:

- DB does change (you can read it back via Dexie — the inline values are there).
- React sees the OLD position (because `db.points` won the lookup).
- Worse: if you "normalize" the inline pixel values and save them as inline, `resolvePoints` would multiply them by `imageSize` AGAIN at read time → garbage coords.

## Patterns by reference

These hooks are good copy-from references:

- **Add new geometry** → [`useMergeAnnotations.js`](../../src/Features/annotations/hooks/useMergeAnnotations.js) (POLYGON branch around line 254): adds new points to `db.points` (normalized) inside a transaction, then updates the annotation to reference them.
- **Reuse existing point IDs** → [`useSplitAnnotationsInSegments.js`](../../src/Features/annotations/hooks/useSplitAnnotationsInSegments.js) (line 83): when splitting a polyline, the new segment annotations just reference the parent's point IDs — no new `db.points` entries needed.
- **Modify geometry** → [`useCleanSegments.js`](../../src/Features/annotations/hooks/useCleanSegments.js): full pipeline of "compute in pixel space → mint fresh point IDs → bulkAdd to `db.points` (normalized) → reference from annotations".

## Sharing point IDs

Two endpoints at the same physical location should share the same point id. This represents the connection between annotations (junctions, corners, T-joints). The downside: if you UPDATE the position of a shared point id by writing a new `db.points` entry over the old one, you'll move every annotation referencing it.

Two safe strategies:

- **Mint fresh IDs for moved points.** Old IDs become unreferenced (orphans in `db.points` — harmless until garbage-collected). Within the SAME write batch, deduplicate so coincident output points still share a single fresh id (this preserves connections across the batch but doesn't affect annotations outside the batch). This is what `useCleanSegments` does.
- **Reuse IDs only when the position is unchanged.** Useful when the bulk of points stay put (e.g. moving one vertex of a polyline).

## Image size: which property to use

```js
const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
```

`useAnnotationsV2` uses the method first, then the property. **Match that order** in any write path so the same `imageSize` is used for normalization and resolution. Otherwise normalization will divide by a value different from what `resolvePoints` later multiplies by.

## Common bug signatures

| Symptom | Likely cause |
|---|---|
| Annotation geometry "doesn't change" after an update | Wrote inline `x/y` while `db.points` has an entry for that id (pointsIndex wins) |
| Annotation jumps far off-screen after an update | Wrote pixel `x/y` to inline (or to `db.points`) without normalizing — `resolvePoints` multiplied by `imageSize` again |
| One annotation moves and unrelated ones move too | Overwrote a `db.points` entry whose id is shared by other annotations |
| Annotation disappears | Possibly normalized to extreme values (e.g. divided by `width=1` fallback because `imageSize` was unreachable) → check `baseMap?.getImageSize?.()` is non-null |
