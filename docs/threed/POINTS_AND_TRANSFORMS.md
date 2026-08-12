# Points & 3D transforms

How annotation points feed the 3D mesh builders, what each per-ref offset
means, and how "sliding" refs behave.

This complements [`docs/annotations/POINTS_STORAGE.md`](../annotations/POINTS_STORAGE.md),
which focuses on the 2D storage model. Read that first if you're not
familiar with `db.points` / `annotation.points`.

---

## Data model — what lives where

Two tables collaborate to describe a vertex:

```
db.points        →  { id, x, y, baseMapId, projectId, listingId, … }
annotation.points →  [ { id, type?, offsetTop?, offsetBottom?, isSliding? }, … ]
```

| Where                  | What it stores                                                                                                                                                                      | Coordinate space                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `db.points`            | `{ id, x, y }` — the **shared 2D position** of a vertex. The same id can be referenced by many annotations.                                                                         | **Normalized** to `[0, 1]` against `baseMap.image.imageSize`. |
| `annotation.points[i]` | The **per-annotation properties** of that ref: drawing handle shape (`type`: `"square"` / `"circle"`), per-vertex altitude (`offsetTop`, `offsetBottom`), and the `isSliding` flag. | n/a — pure data.                                              |
| `annotation.offsetZ`   | A **per-annotation vertical lift** (in meters). Applied uniformly to every vertex of the annotation.                                                                                | meters.                                                       |
| `annotation.height`    | Extrusion height (meters). 0 = flat surface.                                                                                                                                        | meters.                                                       |

Two annotations that share a corner reference the **same `db.points.id`**, but
each can carry its **own** `offsetTop` / `offsetBottom` / `type` / `isSliding`
on that corner (those live in `annotation.points[i]`, not in `db.points`).

---

## Coordinate conversion (pixels ↔ meters)

`db.points` is normalized. Most algorithms work in **pixel space** or **meter
space**. The basemap supplies the conversion:

```
imageSize  : { width, height }   – px (from baseMapRecord.image.imageSize)
meterByPx                       – meters per pixel

x_pixel  = x_norm * imageSize.width
y_pixel  = y_norm * imageSize.height
x_meter  = x_pixel * meterByPx
y_meter  = y_pixel * meterByPx
```

Plane fits (`getPolygonZPlane`) and slope computations (`getPolygonSlope`)
consume **pixel-space** points and internally scale to meters via
`meterByPx`. Their output is returned in meters.

---

## Z formulas

The basemap's "lay-flat" rotation is on the parent group, so the
per-annotation Z axis is the basemap-local Z (in 3D world that becomes
world +Y once the parent transform applies). `verticalLift` below is the
annotation's `offsetZ`.

### POLYGON (slab / floor / ceiling)

Triangulated by `triangulateAnnotationGeometry`. Per vertex `i`:

```
top_z_i    = verticalLift + height + offsetBottom_i + offsetTop_i
bottom_z_i = verticalLift +          offsetBottom_i               (only when height > 0)
```

For a flat polygon (`height = 0`), only the top face is drawn. For an
extruded polygon (`height > 0`), the geometry is a slanted prism with the
top face per the formula above and a planar bottom face below.

### POLYLINE wall (`extrudePolylineWall`)

The wall is extruded straight up from a 2D line. Per segment endpoint:

```
bottom_z_i = verticalLift + offsetBottom_i
top_z_i    = verticalLift + height + offsetTop_i      ← top stays fixed
```

Note: `offsetBottom_i` only affects the **bottom** of the wall; the top
does **not** rise with it. This is intentional — when a wall sits on a
sloping floor, its base follows the floor while its ceiling stays at a
fixed height.

If at some corner the `offsetBottom` exceeds `height + offsetTop` the
local "span" (`top − bottom`) goes negative. `extrudePolylineWall`
handles this by:

1. Walking each segment `(i, j)` and computing `span_i`, `span_j`.
2. If both negative → segment dropped entirely.
3. If only one negative → segment split at the linearly-interpolated
   knife-edge (where `span = 0`); the positive half is rendered, the
   negative half is dropped.
4. Any segment index listed in `annotation.hiddenSegmentsIdx` is skipped
   regardless (user-defined hidden segments).

The `expandArcsInPathWithHiddenMap` util remaps hidden indices through
arc expansion so the runtime mesh stays consistent with the persistent
data even when polylines carry S-C-S arc samples.

---

## Sliding refs (`isSliding: true`)

A ref tagged `isSliding: true` is **decorative**: it exists in the data
model but is **not** used to build the 3D mesh. It either:

- Was **auto-inserted** by a feature that derives its position from
  surrounding geometry, and gets re-derived at every commit.
- Was **user-marked** via `PanelPropertiesPoints` (the _Point coulissant
  (isSliding)_ checkbox), typically on a polygon corner where the user
  wants connected walls to track the polygon's plane at that location.

### Where sliding refs are filtered

| Layer                                                   | Filtered? | Why                                               |
| ------------------------------------------------------- | --------- | ------------------------------------------------- |
| `createAnnotationObject3D` (persistent 3D mesh)         | yes       | The mesh always operates on raw geometry.         |
| `loadAnnotationSnapshot` (transient mesh during a drag) | yes       | Same reason — drag preview reflects raw geometry. |

`stripSlidingFromAnnotation` is the util that produces the filtered
`points` + remapped `hiddenSegmentsIdx`. It also drops any hidden segment
adjacent to a sliding corner — those existed only because of an auto-split.

### Visual cue

In `NodePolylineStatic`, when an annotation is selected and its vertices
are rendered, a sliding vertex draws with a **dashed stroke (`3,2`)**
instead of the usual solid one, so it's clear which vertices are derived
vs. user-controlled.

---

## Quick reference — what to call from where

| Goal                                      | Util                                      |
| ----------------------------------------- | ----------------------------------------- |
| Get a filtered annotation for the 3D mesh | `stripSlidingFromAnnotation(annotation)`  |
| Fit the polygon's top-surface plane       | `getPolygonZPlane({ points, meterByPx })` |
| Evaluate that plane at (x, y)             | `getZAtXY(plane, xPx, yPx, meterByPx)`    |

All utils live under `src/Features/annotations/utils/`.

> **Removed:** the 3D move gizmo (`MoveGizmoThreed`) and its vertical-move
> features (_Δz_, _Pente %_, edge / vertex sub-selection, ramp layout,
> propagation to connected walls) were deleted. The utils that served it
> only — `getPolygonEdgeSlopePct`, `classifyPolylineCornerVsPolygonZ`,
> `splitPolylineAtSpanInversions`, `getRampRailChains`, `buildRampLayout`,
> `rampOffsetTopByPointId`, `getGuideLineAxis`, `findConnectedAnnotations` —
> went with it. Recover them from git history if the feature comes back.

---

## Common pitfalls

- **Modifying `annotation.points[i].x` / `y` directly is ignored.** XY is
  resolved from `db.points`. Write XY only via `db.points.update` /
  `db.points.add`. See `docs/annotations/POINTS_STORAGE.md`.
- **Forgetting to read `annotation.height ?? 0`.** Some annotations are
  surface-only (height = 0), some are extruded.
- **Polygon's per-sliding-ref `offsetTop` / `offsetBottom` are unused
  by the mesh.** Their authoritative z is the polygon's plane evaluated
  at the ref's (x, y). Don't trust the stored offsets for sliding refs.
