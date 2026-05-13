# Points & 3D transforms

How annotation points feed the 3D mesh builders, what each per-ref offset
means, and how the gizmo's vertical-move feature (slope %, edge / vertex
sub-selection) propagates to connected annotations and to "sliding" refs.

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

| Where | What it stores | Coordinate space |
|---|---|---|
| `db.points` | `{ id, x, y }` — the **shared 2D position** of a vertex. The same id can be referenced by many annotations. | **Normalized** to `[0, 1]` against `baseMap.image.imageSize`. |
| `annotation.points[i]` | The **per-annotation properties** of that ref: drawing handle shape (`type`: `"square"` / `"circle"`), per-vertex altitude (`offsetTop`, `offsetBottom`), and the `isSliding` flag. | n/a — pure data. |
| `annotation.offsetZ` | A **per-annotation vertical lift** (in meters). Applied uniformly to every vertex of the annotation. | meters. |
| `annotation.height` | Extrusion height (meters). 0 = flat surface. | meters. |

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

Plane fits (`getPolygonZPlane`) and slope computations
(`getPolygonSlope`, `getPolygonEdgeSlopePct`) consume **pixel-space**
points and internally scale to meters via `meterByPx`. Their output is
returned in meters.

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
   regardless (see "Sliding refs" below for how those indices arise at
   commit time).

The `expandArcsInPathWithHiddenMap` util remaps hidden indices through
arc expansion so the runtime mesh stays consistent with the persistent
data even when polylines carry S-C-S arc samples.

---

## Sliding refs (`isSliding: true`)

A ref tagged `isSliding: true` is **decorative**: it exists in the data
model but is **not** used to build the 3D mesh. It either:

- Was **auto-inserted** by a feature that derives its position from
  surrounding geometry (e.g. the slope-move's inflection points on
  polylines — see below), and gets re-derived at every commit.
- Was **user-marked** via `PanelPropertiesPoints` (the *Point coulissant
  (isSliding)* checkbox), typically on a polygon corner where the user
  wants connected walls to track the polygon's plane at that location.

### Where sliding refs are filtered

| Layer | Filtered? | Why |
|---|---|---|
| `createAnnotationObject3D` (persistent 3D mesh) | yes | The mesh always operates on raw geometry. |
| `loadAnnotationSnapshot` (transient mesh during a drag) | yes | Same reason — drag preview reflects raw geometry. |
| `findConnectedAnnotations` / move-mode shared-corner setup | **no** | Sliding refs are needed to identify which polylines share a corner with the moved polygon. |
| `MoveGizmoThreed.handleApply` (commit) | partially | Only auto-managed polyline sliding refs are stripped + recomputed. Polygon sliding refs are KEPT. |

`stripSlidingFromAnnotation` is the util that produces the filtered
`points` + remapped `hiddenSegmentsIdx`. It also drops any hidden segment
adjacent to a sliding corner — those existed only because of an auto-split.

### Visual cue

In `NodePolylineStatic`, when an annotation is selected and its vertices
are rendered, a sliding vertex draws with a **dashed stroke (`3,2`)**
instead of the usual solid one, so it's clear which vertices are derived
vs. user-controlled.

---

## The move gizmo's per-corner shift

`MoveGizmoThreed` is the entry point for the vertical-move features
(*Δz*, *Pente %*, edge / vertex sub-selection). The key idea: each shared
corner C between the moved POLYGON and a connected POLYLINE gets a
**shift coefficient `k_C`** computed once at move-mode entry, then both
the live drag and the commit apply:

```
shift_at_C = k_C * dn
```

where `dn` is the current drag delta (live) or the final committed delta.

### How `k_C` is computed

At move-mode entry, the polygon's raw corners are fitted to two planes:

| Plane | `z` values fed into the fit | Use |
|---|---|---|
| **`oldPlane`** | each raw corner's stored `offsetTop` | Gives the **pre-move** polygon z at any (x, y), used for classification and as `polygonZ` at sliding corners. |
| **`unitPlane`** | `1` for raw corners in `subPointIds` (or every raw corner in whole-mode), `0` otherwise | Gives `k_C` at any (x, y): `getZAtXY(unitPlane, x, y) = k_C`. |

For each shared corner C between the moved polygon and a connected polyline:

- **Raw corner in `subPointIds`** → `k_C = 1`.
- **Raw corner not in `subPointIds`** → `k_C = 0` (corner doesn't propagate).
- **Sliding corner on the polygon** → `k_C = unitPlane(C.x, C.y)`. For
  the simple rectangle case where a sliding point A sits 30% along the
  moved edge direction, this gives `k_A = 0.3` — A's z follows 30% of
  the drag delta, matching the slope.

### How the wall corner gets shifted

Once `k_C` and the classification (`"BOTTOM"`, `"TOP"`, or `null`) are
known, the wall's per-corner update is:

| Classification | Effect |
|---|---|
| `"BOTTOM"` — wall is above the polygon (or touching it from above); rests on the floor | `offsetBottom += k_C * dn` |
| `"TOP"` — wall is below the polygon (or touching it from below); reaches up to the ceiling | `offsetTop += k_C * dn` |
| `null` — wall straddles the polygon level | no propagation |

The classification is performed by `classifyPolylineCornerVsPolygonZ`
using the pre-move `polygonZ` at C, the wall's height, and its current
offsets at C. It is computed once at move-mode entry and reused
throughout the drag.

### Live drag vs. commit — same coefficients

The transient mesh (`buildTransientFaceMesh`) and the commit
(`handleApply`) both use:

- `entry.fieldByPointId` — the classification map.
- `entry.shiftCoeffByPointId` — the `k_C` map.

The drag rebuilds the transient at every frame with
`shiftByPointId.set(id, k_C * dn)`; the commit applies the same
`k_C * dz` to the persisted ref. So the visual during the drag matches
the final state on commit, including at sliding corners.

---

## Auto-inflection on POLYLINE walls (slope-induced)

When a slope move pushes a wall corner into a non-physical span
(`top_z < bottom_z`), `splitPolylineAtSpanInversions` is run at commit
time on the connected polyline:

1. Walks each segment and computes spans at both endpoints.
2. For a sign-flip segment, inserts a new vertex at the linearly-
   interpolated knife-edge (`span = 0`) and tags it `isSliding: true`.
3. Persists the new id into `db.points` (with the polyline's
   `projectId` / `baseMapId` / `listingId`) and into `annotation.points`.
4. Records the now-negative half in `annotation.hiddenSegmentsIdx`.

At the **next** commit on the same polyline these auto refs are stripped
first (`stripSlidingFromAnnotation`) and the corresponding `db.points`
rows are deleted, then the inflection is recomputed fresh from the new
state. This is the "redefined at each commit" property of sliding refs.

The 3D renderer never sees the sliding refs (filtered by
`createAnnotationObject3D`); it gets a clean polyline and handles
inversion through its own sign-flip split. The hidden-segment indices
are honored for any user-defined hidden segments that survive the strip.

---

## Quick reference — what to call from where

| Goal | Util |
|---|---|
| Get a filtered annotation for the 3D mesh | `stripSlidingFromAnnotation(annotation)` |
| Fit the polygon's top-surface plane | `getPolygonZPlane({ points, meterByPx })` |
| Evaluate that plane at (x, y) | `getZAtXY(plane, xPx, yPx, meterByPx)` |
| Current slope of a polygon along an edge | `getPolygonEdgeSlopePct({ points, edgePointIds, meterByPx })` |
| Δz to reach a target slope % | `deltaZForTargetSlope({ points, edgePointIds, meterByPx, targetSlopePct, currentEdgeZ })` |
| Classify a wall corner vs. a polygon plane | `classifyPolylineCornerVsPolygonZ({ polygonZ, polyline… })` |
| Split a polyline at span-inversion points | `splitPolylineAtSpanInversions({ refs, height, closeLine, existingHiddenIdx, pointsById, newPointFactory })` |

All utils live under `src/Features/annotations/utils/`.

---

## Common pitfalls

- **Modifying `annotation.points[i].x` / `y` directly is ignored.** XY is
  resolved from `db.points`. Write XY only via `db.points.update` /
  `db.points.add`. See `docs/annotations/POINTS_STORAGE.md`.
- **Forgetting to read `annotation.height ?? 0`.** Some annotations are
  surface-only (height = 0), some are extruded.
- **Sliding refs in `entry.sharedIds` but not in the snapshot.** The
  transient snapshot strips sliding refs, but `findConnectedAnnotations`
  (which feeds `sharedPointIds`) does not. When iterating sliding shared
  corners, fetch their XY from `db.points`, not from
  `snapshot.pointsById`.
- **Polygon's per-sliding-ref `offsetTop` / `offsetBottom` are unused
  by the mesh.** Their authoritative z is the polygon's plane evaluated
  at the ref's (x, y). Don't trust the stored offsets for sliding refs.
