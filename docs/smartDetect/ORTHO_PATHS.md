# ORTHO_PATHS — Smart Detect Automatic Orthogonal Polyline Tracing

## Overview

ORTHO_PATHS is a Smart Detect mode that automatically traces orthogonal (horizontal/vertical) dark lines on architectural plans from a single click. It drastically speeds up wall vectorization by replacing manual point-by-point drawing with automatic path detection.

## User Workflow

```
1. Select POLYLINE annotation tool (click mode)
   → ORTHO_PATHS mode activates automatically

2. Click on a dark line on the plan
   → BFS algorithm traces the line in all orthogonal directions
   → The longest continuous path through the click is displayed as a flashing green polyline

3. Press Space to validate
   → Detected points are added to the current drawing (not committed as annotation yet)
   → User can continue clicking to extend the polyline

4. Repeat 2-3 as needed, then commit the polyline (double-click / Enter)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interaction                           │
│                                                                 │
│  InteractionLayer.jsx                                           │
│  ├─ Click → converts to pixel coords → calls runOrthoPaths()   │
│  ├─ Space → mergeDetectedPolyIntoDrawing() → update drawing    │
│  └─ Escape → clear detection                                   │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│   SmartDetectLayer     │    │    TransientOrthoPathsLayer      │
│   (Loupe + mode UI)    │    │    (Flashing green preview)      │
│                        │    │                                  │
│  ├─ Pre-caches image   │    │  ├─ SVG polylines                │
│  ├─ Mode selector      │    │  ├─ Flash animation (opacity)    │
│  └─ runOrthoPaths()    │    │  └─ vectorEffect: non-scaling    │
│       ↓                │    └──────────────────────────────────┘
│   cv.traceOrthoPathsAsync()                                    │
└────────────┬───────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Web Worker (cv.worker.js)                   │
│                                                                 │
│  traceOrthoPathsAsync.js                                        │
│  ├─ 1. Load image data                                          │
│  ├─ 2. Snap click to band center (median line)                  │
│  ├─ 3. Measure line thickness → compute stepSize                │
│  ├─ 4. Build visited map from excluded segments                 │
│  ├─ 5. BFS exploration (4 directions, fork at intersections)    │
│  ├─ 6. Simplify polylines (remove collinear points)             │
│  ├─ 7. Reconstruct longest path through click point             │
│  └─ 8. Adjust segments to band median lines (orthogonal snap)   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Algorithms

### 1. BFS Orthogonal Path Tracer

**File:** `public/opencv/handlers/traceOrthoPathsAsync.js` (worker)
**Mirror:** `src/Features/smartDetect/utils/traceOrthoPaths.js` (sync reference)

The BFS explores dark pixels from the click point:

- **Snap to median:** The click is first snapped to the nearest dark pixel, then centered on the dark band by measuring H/V extent and offsetting to the midpoint.
- **Step size:** Auto-detected from line thickness at the click point (`stepSize = max(thickness, 6)`).
- **Exploration:** A queue processes tasks in 4 orthogonal directions (N/S/E/W). Each step advances by `stepSize` pixels.
- **Intersection detection:** At each position, perpendicular directions are checked. A branch is confirmed only if dark pixels exist at both 1× and 2× stepSize (avoids false branches from line thickness).
- **Visited map:** A `Uint8Array(width × height)` tracks explored pixels. Previously committed segments and existing annotations are pre-rasterized into this map.
- **Safety:** Max 200,000 iterations to prevent infinite loops.

### 2. Longest Path Reconstruction

**Function:** `findLongestPathThroughStart()` in the worker files

The BFS produces multiple segments (one per direction/branch). This function reconstructs the longest continuous polyline through the click point:

1. Build an adjacency index: for each segment's start point, store its index.
2. Identify "root segments" (those starting at the click point).
3. Try all pairs of root segments: reverse one, concatenate with the other.
4. Extend each end by following connected segments at intersections (greedy: pick the longest).
5. Return the longest merged polyline.

### 3. Median Line Adjustment

**Function:** `adjustSegmentsToMiddleLine()` in the worker files

After reconstruction, each segment is adjusted to run along the band's center:

1. **Force H/V:** Classify each segment as H or V by dominant direction, then snap the minor axis.
2. **Merge same-direction:** If two consecutive segments go the same way (H+H or V+V), merge them by removing the intermediate point → strict H/V/H/V alternation.
3. **Sample band centers:** For each segment, sample 4 points along it. At each sample, measure the dark band extent perpendicular to the direction and compute the center.
4. **Intersection of median lines:** Each corner = intersection of two perpendicular median lines:
   - `H(y=Y₁) ∩ V(x=X₂)` → corner at `(X₂, Y₁)`
   - This guarantees perfect orthogonality.
5. **Endpoint alignment:** First and last points are forced to share the perpendicular coordinate of their adjacent corner.

### 4. Drawing Points Merge

**File:** `src/Features/smartDetect/utils/mergeDetectedPolyIntoDrawing.js`
**Documentation:** `src/Features/smartDetect/utils/mergeDetectedPolyIntoDrawing.md`

When Space is pressed, the detected polyline is merged into the current drawing:

- **Case 1 (first click):** Orient the full polyline so the longest arm from A' is last (= drawing tip).
- **Case 2 (extending):** Previous points are NEVER modified. The "forward arm" (going away from the existing drawing) is appended. The click point is replaced by A' (snapped to median).

## File Reference

### Core Algorithm
| File | Description |
|------|-------------|
| `public/opencv/handlers/traceOrthoPathsAsync.js` | Worker: BFS tracer + median adjustment + longest path reconstruction |
| `src/Features/smartDetect/utils/traceOrthoPaths.js` | Sync mirror of the BFS algorithm (keep in sync with worker) |
| `src/Features/smartDetect/utils/mergeDetectedPolyIntoDrawing.js` | Merge detected polyline into drawing points |

### Worker Infrastructure
| File | Description |
|------|-------------|
| `public/opencv/cv.worker.js` | Worker entry — registers `traceOrthoPathsAsync` handler |
| `src/Features/opencv/services/opencvService.js` | Service — exposes `traceOrthoPathsAsync()` method |

### UI Components
| File | Description |
|------|-------------|
| `src/Features/mapEditorGeneric/components/SmartDetectLayer.jsx` | Loupe UI, mode selector (ORTHO_PATHS), image pre-caching, `runOrthoPaths()` API |
| `src/Features/mapEditorGeneric/components/TransientOrthoPathsLayer.jsx` | Flashing green SVG polylines for detection preview |
| `src/Features/mapEditorGeneric/components/DrawingLayer.jsx` | Drawing preview with `setPoints()` for immediate updates |

### Interaction Logic
| File | Description |
|------|-------------|
| `src/Features/mapEditor/components/InteractionLayer.jsx` | Click handler (BFS trigger), Space handler (merge), visited segments management |
| `src/Features/mapEditor/components/MainMapEditorV3.jsx` | `onCommitDrawing` callback with promise propagation |

## Configuration

| Parameter | Default | Description |
|-----------|---------|-------------|
| `darknessThreshold` | 128 | Max brightness (0-255) for a pixel to be considered "dark" |
| `windowSize` | 6 | Side length of the sampling window for darkness averaging |
| `MAX_ITERATIONS` | 200,000 | BFS safety limit |
| `maxTraceSteps` | 300 | Max steps per direction for median line detection |

## Exclusion Mechanism

To avoid re-tracing already drawn segments, the BFS receives `visitedSegments`:

1. **Existing annotations** (from DB): POLYLINE/POLYGON annotations on the current base map, converted from local to pixel coords.
2. **Committed ortho segments** (`committedOrthoSegmentsRef`): segments validated by Space during the current drawing session (in native pixel coords from the worker).

These are rasterized into the visited map using `rasterizeSegment()` with a radius of `stepSize` pixels, ensuring the BFS cannot step into already-traced areas.
