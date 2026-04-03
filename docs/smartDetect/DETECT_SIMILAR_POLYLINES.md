# DETECT_SIMILAR_POLYLINES — Line vectorization algorithm

## Overview

Detects horizontal and vertical line segments in architectural plans by clicking on a reference line. The algorithm calibrates from the click point, scans the full image, and returns vectorized polylines with shared topology.

## Pipeline

```
Image source
  ↓ Load + extract target color at click point
  ↓ Build color-match mask (brightness or RGB distance)
  ↓ Calibrate thickness from click point
  ↓ Build exclusion mask from existing annotations
  ↓ [If offsetAngle ≠ 0: rotate image so building axes become H/V]
  ↓
  ├─ Horizontal band scan → H segments
  ├─ Vertical band scan → V segments
  ↓
  ↓ Filter thick zones (solid fills) + asymmetric halos
  ↓ Merge colinear segments
  ↓ Deduplicate parallel segments (antialiasing collapse)
  ↓ Center on median line of dark band
  ↓ Re-deduplicate (±2px tolerance after centering shifts)
  ↓ Fill dashed lines (bridge dark gaps on same axis)
  ↓ Grid alignment (snap to common grid)
  ↓ Cross-axis fill (bridge gaps between H/V endpoints on grid)
  ↓ Snap endpoints to perpendicular segments
  ↓ Topology resolution (L/T/X intersections → split)
  ↓
  ↓ [If offsetAngle ≠ 0: rotate output coordinates back]
  ↓
  Polylines [{x,y},{x,y}] + thickness
```

## Step-by-step

### 1. Color extraction

Extract the **darkest pixel** in a 5px radius around the click point. Using the darkest pixel (not average) ensures the color-match mask captures the full core of similar lines.

### 2. Color-match mask

Two modes depending on target color brightness:

- **Dark lines** (brightness < 80): Use a fixed brightness threshold of **128** (standard binarization midpoint). All pixels with brightness < 128 are marked as matching. This captures the full line including antialiasing gradient.

- **Colored lines**: Use Euclidean RGB distance with configurable tolerance (default 80). `sqrt(dr² + dg² + db²) ≤ tolerance`.

### 3. Calibration

From the click point on the color-match mask:

1. **Snap** to nearest matching pixel (search radius 30px)
2. **Measure core thickness**: count matching pixels in 4 directions (left, right, up, down). Core thickness = min(H extent, V extent).
3. **Measure visual thickness**: same measurement but using brightness < 240 (captures full antialiasing gradient). Used for `strokeWidth` of output annotations.

Derived parameters:
- `bandHeight = thickness × 2`
- `step = thickness / 2`
- `minRunLength = thickness × 5`
- `maxThickness = thickness × 4`
- `mergeTolerance = thickness × 1.5`

### 4. Exclusion mask

Existing annotations (from `useAnnotationsV2`, already filtered by visibility/layers) are rasterized into an exclusion mask. Pixels covered by existing annotations are cleared from the color-match mask and marked in a separate `excludedMask` for the fill passes.

### 5. Rotation (optional)

If `offsetAngle ≠ 0` (from Ortho Snap angle):
1. Rotate the image by `+offsetAngle` using `OffscreenCanvas` so building axes become H/V
2. Rotate click point and existing segments accordingly
3. Run the entire H/V pipeline
4. Rotate output coordinates back by `-offsetAngle`

### 6. Band scanning

#### Horizontal scan

For each `y` from 0 to `height`, stepping by `step`:
1. Extract a horizontal band of height `bandHeight` centered on `y`
2. For each column `x`, count matching pixels in the band
3. Compute `density = matchCount / bandHeight`
4. If `density > 0.4` → column is part of a line run
5. When run ends: if `runLength ≥ minRunLength` → emit H segment `{axis: 'H', position: y, start: x1, end: x2}`

#### Vertical scan

Same algorithm transposed (scan columns, project on rows).

### 7. Filter thick zones

For each segment, sample perpendicular extent at several points:
- **Total extent > maxThickness** → reject (solid fill, not a line)
- **Length < extent × 3** → reject (curve artifact, not H/V line)
- **Asymmetry check**: measure extent separately on each side. If `min(left,right) / max(left,right) < 0.2` → reject (wall-edge antialiasing halo, not a real line)

### 8. Merge colinear

Group segments by axis + position (within `mergeTolerance`). Sort by start coordinate. Merge if gap between consecutive segments < `thickness × 3`.

### 9. Deduplicate parallel

After merge, collapse segments at nearly the same position with overlapping ranges. Averages position, unions range. This handles antialiased lines producing 2-3 parallel detections.

### 10. Center on median

For each segment, sample the perpendicular brightness profile at several points. Find the center of the dark band (brightness < 200) and adjust `position` to the median center. Uses median for robustness against outliers.

### 10b. Re-deduplicate after centering

The `_centerOnMedian` step may shift segments from the same physical line to slightly different positions (±1-2px), especially after image rotation where interpolation creates sub-pixel offsets. A second `_deduplicateParallel` pass with a tight tolerance of **2px** collapses these back onto a single position. This ensures `_fillDashedLines` (which uses strict position matching `===`) sees all fragments of the same line at the exact same coordinate.

### 11. Fill dashed lines

Merge consecutive segments on the **same axis and exact same position** when the gap between them is covered by a dark band.

Gap verification uses the **same method as the band scanner**: for each pixel along the gap, project perpendicular across `bandHeight` and require density > 0.4. Additionally checks **continuity** — if a white streak exceeds `maxWhiteStreak` pixels, the gap is broken and fill is rejected. Also checks the exclusion mask to avoid bridging across existing annotations.

### 12. Grid alignment

Collect all significant coordinates:
- Y values: H segment positions + V segment endpoints
- X values: V segment positions + H segment endpoints

**Cluster** nearby values (within `gridTolerance = thickness × 0.75`) into representative grid values (cluster average). **Snap** all segment coordinates to the nearest grid value.

This aligns segments that are visually on the same line but were detected at slightly different positions due to antialiasing or scan stepping.

### 13. Cross-axis fill (fillGridGaps)

For each **horizontal grid line** Y (from V segment endpoints only — cross-axis):
1. Collect all X coordinates touching this Y: from H segment start/end + V segment positions
2. Sort by X
3. For each consecutive pair, check if the gap is **continuous** (no white streak > `maxWhiteGap`) and not excluded
4. If yes → create new H segment

Same logic for vertical grid lines (from H segment endpoints only).

This connects e.g. two V segments whose endpoints are on the same Y grid line by creating an H segment if a dark line exists between them.

### 14. Snap endpoints

For each H segment endpoint, find the nearest perpendicular V segment within `snapTolerance = thickness × 2`. Extend or retract the endpoint to meet the V segment exactly. And vice versa.

### 15. Topology resolution

For each pair of (H, V) segments:
1. Compute intersection point `(V.position, H.position)`
2. Check if intersection is within both segments' ranges
3. Classify:
   - **THROUGH** (intersection is interior to segment)
   - **END** (intersection is at segment endpoint)
4. Node type: END+END → L, END+THROUGH → T, THROUGH+THROUGH → X
5. **Split** THROUGH segments at intersection points

### 16. Output

Array of polylines `[{x, y}, {x, y}]` in image pixel coordinates + detected `thickness` (visual).

## Commit flow (Space key)

1. InteractionLayer calls `onCommitDrawingRef.current` with `options.bulkPolylines`
2. MainMapEditorV3 routes to `handleBulkCommit` in `useHandleCommitDrawing`
3. **Topology deduplication**: endpoints at the same location (within 1.5px snap tolerance) share a single point ID
4. **Bulk transaction**: all points, entities and annotations created via `db.transaction` + `bulkAdd`
5. Single Redux dispatch at the end

## Files

| File | Role |
|------|------|
| `public/opencv/handlers/detectSimilarPolylinesAsync.js` | Worker handler (core algorithm) |
| `src/Features/opencv/services/opencvService.js` | Service method `detectSimilarPolylinesAsync()` |
| `public/opencv/cv.worker.js` | Worker message routing |
| `src/Features/mapEditor/components/InteractionLayer.jsx` | Click → detect, Space → commit, Escape → cancel |
| `src/Features/mapEditor/hooks/useHandleCommitDrawing.js` | `handleBulkCommit` for batch creation |
| `src/Features/mapEditorGeneric/components/SmartDetectLayer.jsx` | SIMILAR_LINE mode in loupe |
| `src/Features/mapEditorGeneric/components/TransientDetectedPolylinesLayer.jsx` | Blinking green overlay |
| `src/Features/mapEditorGeneric/components/ScreenCursorV2.jsx` | Spinner + rotated cursor lines |
| `src/Features/annotations/constants/drawingShapeConfig.js` | Tool registration |
| `src/Features/mapEditor/constants/drawingTools.jsx` | Tool definition + icon |
| `src/Features/icons/IconDetectSimilarPolylines.jsx` | SVG icon |
| `src/Features/annotations/components/SectionShortcutHelpers.jsx` | Keyboard shortcuts UI |
