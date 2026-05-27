# GLOBAL_FLOOR_PLAN_DETECTION (Détection globale murs + poteaux)

Whole-plan smart-detect mode triggered by pressing **A** while a drawing
tool is active. Unlike `STRIP_DETECTION` (loupe-based, scans the area
under the cursor on `mouseMove`), this mode runs **once on demand**
against the entire baseMap image, returning every wall / pillar segment
it finds in one pass.

The user sees a green spinner replace the cursor for ~1 s, then a set of
flashing-green segments. Pressing **Space** commits them all as POLYLINE
annotations inheriting the active template; **Escape** aborts the in-flight
run or dismisses the pending results.

## Keyboard

| Key | Mode | Action |
|-----|------|--------|
| **S** | `HOVER` — `STRIP_DETECTION` | Toggle the loupe-based smart-detect (the historical "A" behaviour). |
| **A** | `GLOBAL` — this doc | Run the whole-plan wall + pillar detector once. |
| **Space** | both | Commit pending detections. |
| **Escape** | both | Abort in-flight detection (during spinner) or dismiss pending results without leaving the drawing tool. |
| **F** | both | Cycle the loupe aspect (SQUARE ↔ LANDSCAPE ↔ PORTRAIT) — also drives the strip orientation now that the standalone `O` shortcut has been removed. |

`smartDetectMode` is a Redux state (`HOVER` | `GLOBAL`) that tracks which
mode was last activated; the `CardSmartDetect` panel highlights it.

## Pipeline overview

```
User presses A
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (runGlobalFloorPlanDetection.js)           │
│                                                          │
│  1. Resolve targetThickness in image-px from the active  │
│     newAnnotation.strokeWidth (CM → image-px via         │
│     meterByPx ; PX → image-px via imageScale).           │
│  2. Build exclusion mask from current annotations        │
│     (buildExclusionMask — same util as STRIP_DETECTION). │
│  3. cv.load() then dispatch to the worker handler.       │
│  4. Map raw result → array of `{ kind, polygon,          │
│     centerline, closeLine, strokeWidth }` features:      │
│       - polygon   : 4-corner outline in LOCAL coords     │
│                     (for the flashing-green preview)     │
│       - centerline: 2-point segment in IMAGE coords      │
│                     (for the bulk-create hook)           │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  WORKER HANDLER (detectFloorPlanFeaturesAsync.js)        │
│                                                          │
│  1. Load image → grayscale → THRESH_BINARY_INV (`bw`).   │
│  2. Subtract exclusion mask from `bw` (existing-         │
│     annotation areas are zeroed out so they're skipped). │
│  3. Build `cleanBw` = MORPH_OPEN(bw, k × k square)       │
│     where k ≈ 0.75 × minThickness. Erases hatching,      │
│     dimension lines, text glyphs.                        │
│  4. Big walls — MORPH_OPEN(cleanBw, minWallLength × 1)   │
│     then MORPH_OPEN(cleanBw, 1 × minWallLength) →        │
│     `horizontalWallsImg`, `verticalWallsImg`.            │
│  5. Subtraction — `shortElementsImg = cleanBw AND NOT    │
│     (horizontalWallsImg OR verticalWallsImg)`. Holds     │
│     every feature too short or off-thickness for the big │
│     morphology kernels (square pillars, off-range        │
│     bricks, end fragments).                              │
│  6. Big-wall extraction with PROFILE-THICKNESS TRIMMING  │
│     (see below).                                         │
│  7. Short-element extraction — each contour is           │
│     classified H or V based on its bbox aspect ratio.    │
│  8. Density discrimination on `bwOrig` (pre-mask binary) │
│     — 3-square sampling at 1/4, 1/2, 3/4 of length; keep │
│     the segment when ≥ `densityMinPassingSamples` pass   │
│     `densityThreshold`. Short walls (len ≤ thickness)    │
│     use a single-bbox sample promoted to 3 if it passes. │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  RENDERING (TransientDetectedStripsLayer)                │
│                                                          │
│  Each feature's `polygon` (4 corners around the wall in  │
│  local coords) is fed to the existing strips layer →     │
│  flashing-green animation (#00ff00, 0.3 → 0.6).          │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  COMMIT (Space — useCreateAnnotationsFromDetectedFeatures)│
│                                                          │
│  - Build POLYLINE annotations from each centerline       │
│    (2 points, normalized by baseMap.getImageSize()).     │
│  - Inherit template props from the active newAnnotation  │
│    (strokeColor, annotationTemplateId, …).               │
│  - Override strokeWidth with the per-feature measured    │
│    thickness in CM when meterByPx is set.                │
│  - `closeLine` is always `false` — every feature is a    │
│    simple segment, including ex-pillars.                 │
└──────────────────────────────────────────────────────────┘
```

## Worker payload

`cv.detectFloorPlanFeaturesAsync({ imageUrl, targetThickness, …})`

| Param | Default | Description |
|---|---|---|
| `imageUrl` | — | baseMap image URL (fetched inside the worker). |
| `targetThickness` | — | Target wall / pillar thickness in **image pixels**. Required. |
| `tolerance` | `max(2, round(0.3 × target))` | ± around `targetThickness` for the big-wall pass. |
| `minWallLength` | `max(20, round(4 × target))` | Length of the horizontal / vertical morphology kernels. Also the threshold separating "big walls" from "short elements". |
| `exclusionMaskBuffer` | `null` | Flat `Uint8` mask (1 = masked) covering existing annotations. Same size as the image. |
| `maskWidth` / `maskHeight` | `0` | Expected image size — sanity check on the mask. |
| `densityThreshold` | `0.70` | Minimum foreground fraction inside a sample square. Lower for noisy scans, raise for clean vector exports. |
| `densityMinPassingSamples` | `2` | Number of sample squares (out of 3) that must reach the threshold for a wall to survive. 2-of-3 tolerates one interruption (door, perpendicular crossing). |

Output:

```js
{
  horizontalWalls: [{ x1, y1, x2, y2, thickness }, …],  // image-px
  verticalWalls:   [{ x1, y1, x2, y2, thickness }, …],
  pillars:         [],                                  // always empty
  imageSize:       { width, height },
}
```

`pillars` stays empty by design — every detected feature is classified
as a horizontal or vertical wall segment, including former pillars. The
field is kept in the payload for forward compatibility.

## Detailed steps

### Step 3 — Global cleanup (`cleanBw`)

```js
const kSize = Math.max(3, Math.floor(minThickness * 0.75));
cv.morphologyEx(bw, cleanBw, cv.MORPH_OPEN, k × k square kernel);
```

A `k × k` opening (erosion-then-dilation) wipes any feature thinner than
`kSize` in either direction. For `targetThickness = 8` cm-equivalent
pixels, `minThickness = 3`, `kSize = 3` — a single-pixel diagonal line
(hatching) gets eroded entirely, while an 8-pixel-wide wall is preserved.

All downstream passes (big walls + subtraction) operate on `cleanBw`, so
hatching, text glyphs and thin dimension lines never reach the wall
extraction logic.

### Step 4 — Big walls (long morphology)

Two openings on `cleanBw`:

- **Horizontal** kernel `minWallLength × 1` → `horizontalWallsImg`.
  Survives only foreground regions with at least `minWallLength`
  consecutive horizontal pixels in a row.
- **Vertical** kernel `1 × minWallLength` → `verticalWallsImg`.

Each contour with a bbox thickness in `[minThickness, maxThickness]`
becomes a wall segment.

### Step 5 — Morphological subtraction

```
shortElementsImg = cleanBw AND NOT (horizontalWallsImg OR verticalWallsImg)
```

The leftover contains everything **not** captured by the big-wall pass:
isolated square pillars, off-range bricks (thicker than `maxThickness`),
short wall fragments — and minor artefacts (see "Known limitations"
below). Each contour is classified H or V based on `rect.width ≥
rect.height` and pushed as a small wall segment with no thickness
filter (since by design these elements can be outside `[minThickness,
maxThickness]`).

### Step 6 — Profile-thickness trimming

When a big-wall morphology output extends past the real wall (dilation
overshoot on a wall with a small outgrowth, or anti-aliased fringe), the
contour bbox is wider than the actual wall. To recover the true bounds:

```
minProfileCount = max(2, floor(minThickness × 0.5))
```

For each big-wall bbox:

1. **Left scan** — walk left → right, count foreground pixels per
   column (over the bbox height). The first column with `colCount ≥
   minProfileCount` is the trimmed start.
2. **Right scan** — walk right → left, find the last such column.
3. Apply the same logic on rows for vertical walls.

This filters fringe pixels (1 foreground pixel in the column = below
threshold) without rejecting legitimate anti-aliased walls.

Short elements (from the subtraction pass) are **not** trimmed — their
bbox is used as-is.

### Step 8 — Density discrimination

For each candidate wall, sample three `thickness × thickness` squares on
the centerline at 1/4, 1/2, 3/4 of length:

- Each sample reads `bwOrig` (the **pre-mask** inverted binary) so that
  a wall partially overlapping an exclusion zone is still scored against
  the true plan content.
- Count foreground fraction; if `≥ densityThreshold`, the sample
  "passes".
- Keep the wall if `≥ densityMinPassingSamples` (default 2) samples
  pass.

For walls shorter than their own thickness (former pillars), a single
bbox sample is promoted to `SAMPLE_OFFSETS.length` (3) when it passes,
so the 2-of-3 rule still accepts them.

## Tunable parameters

| Knob | When to change |
|---|---|
| `densityThreshold` (default `0.70`) | Lower to `0.6` on noisy / scanned plans. Raise to `0.85` on clean vector exports for stricter filtering. |
| `densityMinPassingSamples` (default `2`) | Drop to `1` to keep walls with a single solid spot (very lenient, useful when many walls cross perpendicular walls or doors). Raise to `3` for strict full-length verification. |
| `tolerance` | Widen to accept a range of wall thicknesses around `targetThickness`. Already auto-set to ±30 % of target. |
| `minWallLength` | Lower to detect shorter walls via the big-morphology pass. Default `max(20, 4 × target)` works for typical floor plans. |

## Known limitations

- **Sliver artefacts at wall ends** — the big-wall morphology
  occasionally loses 1 px at each extremity due to erosion-then-dilation
  rounding. The subtraction step then leaves a 1×N (or N×1) strip,
  classified as a short element with thickness 1. The current
  short-element filter `if (rect.width < 4 && rect.height < 4) continue;`
  uses `&&` so slivers (e.g. `width = 1`, `height = 8`) are NOT
  filtered. On commit they produce nearly-invisible POLYLINEs with
  strokeWidth 1.
- **Solid filled labels / arrows** — any solid black shape (filled label
  background, arrow heads) that matches the thickness range will be
  detected. The density filter only helps when the bbox contains
  significant white space (text glyphs, hatching).
- **Outgrowths within the profile threshold** — protrusions wider than
  `minProfileCount` rows (e.g. a 4×4 outgrowth on an 8-px wall, threshold
  ≈ 4) survive the profile trim.

## Critical files

| Layer | Path |
|---|---|
| Worker handler (algorithm) | `public/opencv/handlers/detectFloorPlanFeaturesAsync.js` |
| Worker registration | `public/opencv/cv.worker.js` |
| Service entry (main thread) | `src/Features/opencv/services/opencvService.js` (`detectFloorPlanFeaturesAsync(payload)`) |
| Orchestrator | `src/Features/smartDetect/utils/runGlobalFloorPlanDetection.js` |
| Bulk-create hook | `src/Features/smartDetect/hooks/useCreateAnnotationsFromDetectedFeatures.js` |
| Keyboard handler + abort | `src/Features/mapEditor/components/InteractionLayer.jsx` (A / S handlers, `globalDetectionAbortRef`, `detectedGlobalFeaturesRef`) |
| Panel UI | `src/Features/smartDetect/components/CardSmartDetect.jsx` |
| State | `src/Features/mapEditor/mapEditorSlice.js` (`smartDetectMode`, `globalDetectionRunning`) |
| Preview rendering | `src/Features/mapEditorGeneric/components/TransientDetectedStripsLayer.jsx` |
| Spinner cursor | `src/Features/mapEditorGeneric/components/ScreenCursorV2.jsx` (`showSpinner` / `hideSpinner` imperative API) |
