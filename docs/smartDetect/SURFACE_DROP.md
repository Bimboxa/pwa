# SURFACE_DROP (Remplissage)

Tool that detects and fills a surface by clicking on it. Uses OpenCV flood fill
to detect the contour boundary, then post-processes the result to align vertices
to an orthogonal grid and simplify pillar shapes.

## Pipeline overview

```
User clicks on map (SURFACE_DROP tool)
    │
    ▼
┌─────────────────────────────────────────┐
│  PRE-PROCESSING (InteractionLayer.jsx)  │
│                                         │
│  1. Convert click coords to image px    │
│  2. Collect existing POLYGON boundaries │
│  3. Send to OpenCV worker               │
└─────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────┐
│  DETECTION (detectContoursAsync.js — worker) │
│                                              │
│  1. Convert image to grayscale               │
│  2. Binary threshold (target gray ± tol.)    │
│  3. Morphological close (fill small gaps)    │
│  4. Draw existing annotations as barriers    │
│  5. Flood fill from click point              │
│  6. Extract contours (main + cuts/holes)     │
│  7. Approximate with approxPolyDP            │
│                                              │
│  Returns: { points, cuts }                   │
└──────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────┐
│  POST-PROCESSING (alignPolygonsToGrid.js)       │
│                                                 │
│  1. Determine grid orientation (from snap angle)│
│  2. Rotate all polygons to axis-aligned space   │
│  3. Classify segments (orthogonal / diagonal)   │
│  4. Build shared grid (cluster X/Y coordinates) │
│  5. Snap vertices to grid (with max disp. cap)  │
│  5b. Simplify pillars (simplifyPillar.js)       │
│  6. Rotate back to original orientation         │
│  7. Clean up (remove collinear/close vertices)  │
│                                                 │
│  Returns: { points, cuts }                      │
└─────────────────────────────────────────────────┘
    │
    ▼
  Temp annotation → User confirms → Save to DB
```

## Pre-processing: annotation barriers

**File:** `InteractionLayer.jsx` (SURFACE_DROP block)

Before running the flood fill, visible annotations are collected and passed
to the worker as `boundaries`. Two types qualify:

1. **POLYGON** annotations (≥ 3 points)
2. **Closed POLYLINE** annotations — either `closeLine: true` or first
   point = last point (≥ 3 points)

Closed polylines are treated as solid filled polygons for barrier purposes.
Their points are converted from local image coords to source image pixel coords.

**File:** `drawBoundariesOnBinary.js`

The worker draws these boundaries as filled black regions on the binary mask
using `cv.fillPoly`. This prevents the flood fill from crossing existing
annotations — they act as walls. Surfaces are filled (not stroked) to avoid
visible white gaps between the fill and the annotation.

## Detection: OpenCV flood fill

**File:** `detectContoursAsync.js`

| Parameter | Default | Description |
|-----------|---------|-------------|
| `colorTolerance` | 15 | Gray level tolerance (±) for binary threshold |
| `morphKernelSize` | 3 | Morphological kernel size (pixels) |
| `morphIterations` | 2 | Number of morphological close passes |
| `floodWindowSize` | 256 | Default ROI size around click point |

Steps:
1. **Grayscale** — `cv.cvtColor(RGBA → GRAY)`
2. **Binary mask** — pixels within ± `colorTolerance` of the clicked pixel's gray value
3. **Morphological close** — fills small gaps in walls (dilate then erode)
4. **Annotation barriers** — existing polygons drawn as black (see above)
5. **Flood fill** — 4-connectivity from click point, fills connected region
6. **Contour extraction** — `cv.findContours` with `RETR_CCOMP` (hierarchy)
7. **Simplification** — `cv.approxPolyDP` reduces vertex count
8. **Main + cuts** — largest contour = main boundary, child contours = holes (pillars)

## Post-processing: grid alignment

**File:** `alignPolygonsToGrid.js`

Takes all polygons together (main contour + cuts) and aligns them to a shared
orthogonal grid. This ensures consistent coordinates between the main surface
and its pillar holes.

### Parameters

| Constant | Default | Description |
|----------|---------|-------------|
| `DEFAULT_GRID_TOLERANCE_RATIO` | 0.006 | Grid clustering tolerance (ratio of bbox diagonal) |
| `DEFAULT_MAX_DISPLACEMENT_RATIO` | 0.02 | Max vertex movement (ratio of bbox diagonal) |
| `MIN_WALL_THICKNESS_M` | 0.15 m | Min wall thickness — caps tolerance to 7.5 cm |
| `DEFAULT_ANGLE_TOLERANCE` | π/12 (~15°) | Max deviation from 0°/90° to classify as orthogonal |
| `DEFAULT_CURVE_MIN_SEGMENTS` | 4 | Min short segments in a row to detect a curve |
| `DEFAULT_MIN_VERTEX_DISTANCE` | 0.3 | Min distance between adjacent vertices (cleanup) |
| `DEFAULT_COLLINEAR_THRESHOLD` | 0.05 rad (~2.9°) | Threshold for removing collinear vertices |

### Steps

1. **Grid orientation** — Uses `orthoSnapAngleOffset` from mapEditor (degrees).
   When 0 or null, uses 0° (no rotation). Auto-detection was removed because
   hatching patterns (e.g. 45° parking hatches) fool the dominant-angle detector.

2. **Rotation** — All points rotated to axis-aligned space so that grid snapping
   becomes simple X/Y coordinate clustering.

3. **Segment classification** — Each segment is classified as orthogonal
   (within `angleTolerance` of 0°/90°), diagonal, or curved.
   `classifySnappableVertices` marks a vertex as snappable if **at least one**
   adjacent segment is orthogonal (OR, not AND). This handles wall endpoints
   where the short transverse segment may be slightly off-axis.

4. **Grid building** — All X and Y coordinates from snappable vertices across
   ALL polygons are clustered together using `clusterValues()`. This produces
   shared grid lines (`gridX[]`, `gridY[]`).

5. **Vertex snapping** — Each snappable vertex is snapped to the nearest grid
   line (within tolerance). A displacement cap prevents vertices from jumping
   across walls (capped to half `MIN_WALL_THICKNESS_M` when `meterByPx` is known).

6. **Pillar simplification** — See below.

7. **Rotate back** — Inverse rotation to original coordinate system.

8. **Cleanup** — Per polygon: remove close vertices, remove collinear vertices.

## Post-processing: pillar simplification

**File:** `simplifyPillar.js`

Applied to each cut polygon after grid snapping (step 5b). Detects small
polygons that represent pillars/columns and replaces them with clean shapes.

### Parameters

| Constant | Default | Description |
|----------|---------|-------------|
| `PILLAR_MAX_DIAGONAL_M` | 5.0 m | Max bbox diagonal to qualify as a pillar |
| `AREA_RATIO_RECTANGULAR` | 0.85 | Area ratio above this → rectangular |
| `AREA_RATIO_CIRCULAR` | 0.65 | Area ratio below this → irregular (skip) |

### Classification logic

Uses the ratio `polygon area / bounding box area`:

| Ratio | Shape | Reference |
|-------|-------|-----------|
| ≥ 0.85 | Rectangular | Perfect square = 1.0 |
| 0.65 – 0.85 | Circular | Perfect circle ≈ 0.785 (π/4) |
| < 0.65 | Irregular | Not simplified |

### Output

- **Rectangular** → 4 AABB corners with `type: "square"`
- **Circular** → 4 points in S-C-S-C pattern at 0°/90°/180°/270°.
  The renderer (`NodePolylineStatic.jsx`) detects this pattern and draws
  perfect circular arcs via `circleFromThreePoints()`.

## Key files

| File | Role |
|------|------|
| `src/Features/mapEditor/components/InteractionLayer.jsx` | Click handler, boundary collection, worker call |
| `public/opencv/handlers/detectContoursAsync.js` | OpenCV flood fill + contour detection |
| `public/opencv/handlers/drawBoundariesOnBinary.js` | Draw annotation barriers on binary mask |
| `src/Features/geometry/utils/alignPolygonsToGrid.js` | Grid alignment (all polygons together) |
| `src/Features/geometry/utils/simplifyPillar.js` | Pillar rectangle/circle simplification |
| `src/Features/geometry/utils/orthogonalizePolyline.js` | Legacy per-polygon orthogonalization (not used by SURFACE_DROP) |
