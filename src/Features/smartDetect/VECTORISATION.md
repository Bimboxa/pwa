# Vectorisation Pipeline

## Overview

The vectorisation pipeline detects walls on architectural floor plans (raster images) and converts them into polyline annotations with measured thickness. It runs in a Web Worker (`vectoriseWallsAsync.js`) using OpenCV.js.

### Inputs
- **imageUrl** — the base map image (floor plan scan/PDF)
- **boundaries** — polygons defining the building perimeter, with **cuts** defining individual rooms
- **meterByPx** — scale factor (meters per pixel)
- **offsetAngle** — orthogonal alignment correction angle

### Outputs
- **polylines** — arrays of `{x, y}` points in pixel coordinates
- **thicknesses** — wall thickness in pixels for each polyline

### Key data structures
- **wWallMask** (`Uint8Array`) — binary mask where 1 = dark pixel (wall material), 0 = background
- **wRoomMask** (`Uint8Array`) — binary mask where 1 = inside a flood-fill room polygon, 0 = outside building
- **distMat** (`cv.Mat`) — distance transform of the wall mask; value at each pixel = distance to nearest non-wall pixel (half-thickness at medial axis)
- **cutPolygons** — room boundary polygons in ROI coordinates, used for envelope tracing

---

## Pre-processing (steps 1–6)

1. **Load image** — decode into OpenCV Mat
2. **Rotate** — apply `offsetAngle` to align walls with H/V axes
3. **Create masks** — from boundary polygons:
   - Fill boundary polygons → room mask (white = room interior)
   - Fill cuts → holes in room mask (black = wall/pillar zones)
4. **Binarise** — threshold the image to get the wall mask
5. **Distance transform** — compute `distMat` from the wall mask
6. **HoughLinesP** — detect raw line segments from the wall mask skeleton

---

## Phase 1 — Peripheral orthogonal walls

> **Goal**: detect and connect all horizontal/vertical walls on the building perimeter.

### Phase 1.0 — Classification & filtering

| Step | Function | Description |
|------|----------|-------------|
| 1.0a | angle classification | Classify raw HoughLinesP segments into H, V, or diagonal based on angle tolerance (±15°) |
| 1.0b | `filterByLen` | Remove short segments: H/V < 10cm, diagonal < 50cm (skeleton noise) |
| 1.0c | `_mergeColinear` | Merge segments on the same axis within position tolerance (3cm) and gap tolerance (10cm) |
| 1.0d | `_filterThickZones` | Remove segments crossing zones thicker than 80cm (not real walls) |
| 1.0e | `_classifyPeripheral` | Split H/V segments into **peripheral** vs **interior** by probing the room mask perpendicular to each segment. Peripheral = asymmetric (one side is outside the building). Segments < 20cm default to interior. |

### Phase 1.1 — Process peripheral ortho walls (`_processWallGroup`)

| Step | Function | Description |
|------|----------|-------------|
| 1.1a | `_buildGridLines` / `_snapToGrid` | Cluster wall positions into grid lines (2cm tolerance), snap all segments to nearest grid line |
| 1.1b | `_mergeColinear` | Re-merge after grid snap (tolerance = 1px) |
| 1.1c | `_fillGapsOnGridLines` | Fill small gaps (< 30cm) on same grid line if dark pixels bridge them |
| 1.1d | `_extendToWallExtent` | Extend segment endpoints along their axis until dark pixels end, respecting perpendicular barriers (crossing walls) |
| 1.1e | `_measureThickness` | Sample distance transform along each segment → median × 2 = full thickness |
| 1.1f | `_snapEndpoints` | Snap H/V endpoint pairs that are close (5cm) to share exact coordinates |
| 1.1g | `_extendEndpoints` | Extend endpoints up to 1.5× max thickness where dark pixels connect |
| 1.1h | `_resolveTopology` | Split segments at H-V intersections to create proper junctions |
| 1.1i | `_chainColinearSegments` | Chain collinear segments across small gaps into single polylines |
| 1.1j | `_fillEndpointGaps` | Analyse dark pixel zones at free endpoints, create connectors |
| 1.1k | `_removeJunctionNoise` | Remove short fragments near junctions (< 40cm and near another wall) |
| 1.1l | stub filter | Remove polylines shorter than 1.5× their thickness |
| 1.1m | `_removeZigzags` | Remove direction reversals in polylines |
| 1.1n | `_simplifyColinearPoints` (RDP) | Ramer-Douglas-Peucker simplification (3cm tolerance) |
| 1.1o | `_createStepJunctions` | Detect offset parallel walls connected by an orthogonal band, create L-shaped connectors |
| 1.1p | post-step cleanup | Stub filter + zigzag removal after step junctions |
| 1.1q | `_simplifyPolylinesOnGrid` | Remove intermediate points that lie on the same grid line |

### Phase 1.2 — Junction resolution (`_insertJunctionPoints`)

| Step | Function | Description |
|------|----------|-------------|
| 1.2a | T-junction insertion | For each endpoint near the **body** of another polyline, insert a projected point into the other polyline and snap the endpoint to it |
| 1.2b | L-junction snapping | For orthogonal endpoint pairs, compute line intersection and replace both endpoints with the shared point |
| 1.2c | duplicate removal | Remove consecutive duplicate points (< 1px) |
| 1.2d | stub filter | Remove polylines shorter than max(1.5× thickness, 8cm) |

---

## Phase 2 — Peripheral envelope closure (curves & obliques)

> **Goal**: connect the free endpoints of peripheral ortho walls to close the building envelope. The connecting segments follow the building outline (curves, obliques).

### Phase 2.0 — Identify free endpoints (`_closePeripheralEnvelope`)

| Step | Description |
|------|-------------|
| 2.0a | Collect all polyline endpoints (start/end of each polyline) |
| 2.0b | Identify **free** endpoints = not shared with any other polyline within snap tolerance (15cm) |
| 2.0c | Pair free endpoints by **greedy nearest neighbor** (closest free endpoint from a different polyline) |

### Phase 2.1 — Trace boundary path

| Step | Function | Description |
|------|----------|-------------|
| 2.1a | `_traceAlongCutBoundary` | Find the nearest cut polygon, project both endpoints onto it, extract the shortest arc between projections |
| 2.1b | `_resamplePath` | Resample the boundary arc at ~10px intervals for dense coverage |
| 2.1c | `_snapToMedialAxis` | Snap each sample point to the local maximum of the distance transform (wall center) within a search radius |

### Phase 2.2 — Fit line or arc (`_fitLineOrArc`)

| Step | Description |
|------|-------------|
| 2.2a | Determine endpoint axis constraint (H or V) from connected ortho wall direction |
| 2.2b | Adjust endpoints: slide along H/V axis to the medial-axis-snapped position |
| 2.2c | **Collinearity test**: compute max perpendicular deviation from the straight line adjA→adjB. If < 50% wall thickness → output **straight line** (2 points) |
| 2.2d | **Circle fit**: fit a circle through 3 points (start, middle, end). If all recentered points are within 1× thickness of the circle → output **circular arc** with evenly-spaced points |
| 2.2e | **Fallback**: output cleaned polyline with consecutive points at least 1.5× thickness apart |

### Phase 2.3 — Connect to ortho walls

| Step | Description |
|------|-------------|
| 2.3a | Slide the ortho wall endpoint along its H/V axis to match the envelope path endpoint → **single shared point** at junction |
| 2.3b | Thickness = average of the two adjacent ortho wall thicknesses |

---

## Phase 3 — Interior orthogonal walls

> **Goal**: detect walls inside the building (room dividers). Uses the same `_processWallGroup` pipeline as Phase 1.1, with peripheral walls as barriers.

**Status**: disabled (TODO), to be enabled after Phase 1 + 2 are validated.

| Step | Description |
|------|-------------|
| 3.0 | Use interior H/V segments from Phase 1.0e classification |
| 3.1 | Run `_processWallGroup(intH, intV, periPolylines, ctx)` — peripheral walls are passed as `contextPolylines` to act as extension barriers |
| 3.2 | Merge with peripheral results |
| 3.3 | Run junction resolution on the combined set |

---

## Feature flags

| Flag | Location | Description |
|------|----------|-------------|
| `ENABLE_CLOSE_ENVELOPE` | `_postProcessSegments` line 267 | Set to `false` to skip Phase 2 entirely (compare with/without envelope closure) |
