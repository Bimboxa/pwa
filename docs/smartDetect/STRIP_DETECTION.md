# STRIP_DETECTION (Détection bande dans la loupe)

Drawing tool that detects wall strips inside the loupe ROI on `mouseMove`.
Each detection produces a flashing green preview; pressing `Space` commits
the strips as STRIP annotations inheriting the active template.

Unlike `DETECT_SIMILAR_STRIPS` (toolbar button — scans the full viewport
from a selected source strip), `STRIP_DETECTION` is a *drawing tool* and
operates on the small loupe area centred on the cursor. It lets the user
discover and create walls one at a time by hovering.

## Pipeline overview

```
User activates STRIP_DETECTION tool
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  CACHE BUILD (InteractionLayer.jsx, on tool activation)  │
│                                                          │
│  1. Decode source image into ImageData (full image,      │
│     once per session)                                    │
│  2. Build exclusion mask from ALL visible annotations    │
│     (buildExclusionMask.js)                              │
│       - STRIP        → polygon via getStripePolygons     │
│       - POLYGON      → filled polygon                    │
│       - POLYLINE+close → filled polygon                  │
│       - POLYLINE      → stroked path                     │
│  3. Rebuild mask whenever annotationsUpdatedAt changes   │
└──────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  ON MOUSEMOVE (InteractionLayer.jsx, throttled 80 ms)   │
│                                                         │
│  1. Compute cursor position in image px                 │
│  2. Skip if cursor moved < 1 px                         │
│  3. Read loupe ROI from lastSmartROI                    │
│  4. Call detectStripFromLoupe                           │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  DETECTION (detectStripFromLoupe.js)                    │
│                                                         │
│  Step 1+2 — Per-line dark-run scan                      │
│    - 21 sample lines orthogonal to detection direction  │
│    - Collect dark sub-runs ignoring masked pixels       │
│    - Keep runs ≈ stripWidthPx, OR mergeable pairs       │
│      (combined span ≈ stripWidthPx, ≥ 70% black)        │
│                                                         │
│  Step 3 — Cluster by parallel line                      │
│    - Group cross-sections by center-v proximity         │
│    - Keep one seed per wall axis (leftmost in tangent)  │
│                                                         │
│  Step 4 — Wall-axis extension                           │
│    - extractSegments along tangent from seed midpoint   │
│    - Recover all wall spans (multiple strips per line   │
│      separated by openings ≥ 5 px)                      │
│    - Drop spans ≤ stripWidthPx + 2 px (square dots)     │
│                                                         │
│  Step 5 — Edge shift + stripOrientation                 │
│    - Shift each span by -stripWidthPx/2 along normal    │
│      → centerline lands on the wall edge (STRIP convention)│
│    - Emit stripOrientation = +1 so the strip body       │
│      extends in +normal and covers the dark pixels      │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  RENDERING (TransientDetectedStripsLayer)               │
│                                                         │
│  - Convert each segment to local coords                 │
│  - Compute polygon via getStripePolygons                │
│  - Render flashing green overlay (#00ff00, 0.25→0.6)    │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  COMMIT (Space key)                                     │
│                                                         │
│  - Build STRIP annotations from each detected centerline│
│  - Inherit template props (strokeWidth, fillColor, etc.)│
│  - Override stripOrientation with the value returned    │
│    by the algorithm                                     │
└─────────────────────────────────────────────────────────┘
```

## Inputs

`detectStripFromLoupe({ imageData, loupeBBox, stripWidthPx, orientation,
orthoAngleRad, darknessThreshold, widthTolerance, exclusionMask })`

| Param               | Description                                                               |
|---------------------|---------------------------------------------------------------------------|
| `imageData`         | Full source-image `ImageData` (cached once per session)                   |
| `loupeBBox`         | `{x, y, width, height}` — loupe ROI in image px                           |
| `stripWidthPx`      | Reference wall thickness in image px (from active template)               |
| `orientation`       | `"H"` or `"V"` — axis of the walls being detected                         |
| `orthoAngleRad`     | Snap angle in radians (orthoSnapAngleOffset · π/180)                      |
| `darknessThreshold` | Brightness < this = dark pixel (default 128)                              |
| `widthTolerance`    | Half-width of acceptable run length around stripWidthPx (default 0.30)    |
| `exclusionMask`     | `Uint8Array(width × height)`, 1 = pixel covered by an existing annotation |
| `detectMultiple`    | When false, keep only the parallel line whose centre v is closest to the loupe centre (default `true`) — bound to the "Détections multiples" checkbox |

## Output

```js
[{
  segments: [
    { start: {x, y}, end: {x, y}, stripOrientation: 1 | -1 },
    ...
  ]
}]
```

`stripOrientation` is computed by the algorithm — the caller MUST use it
when creating the STRIP annotation (overriding any template default),
otherwise the strip body would render off the wall.

## Detailed steps

### Step 1+2 — Per-line dark-run scan

For each of 21 sample lines (odd → one passes through the loupe centre)
along the **normal** axis (perpendicular to the wall direction):

1. **Collect raw dark sub-runs** along the line. A pixel is dark iff:
   - It lies inside both the loupe and the source image
   - It is NOT marked in the exclusion mask
   - Its brightness is `< darknessThreshold`

2. **Filter** runs:
   - **Case (a) — single run** of length ∈ stripWidthPx · `[1 - widthTolerance, 1 + widthTolerance]` → keep.
   - **Case (b) — mergeable pair** of consecutive runs whose:
     - combined span (from `r1.start` to `r2.end`) is in the same range, AND
     - black coverage `(len1 + len2) / span ≥ 0.70`.
     This rebuilds walls split by a thin centerline marker or perpendicular trace, while rejecting merges across mostly-white gaps.

Each kept entry is a candidate cross-section with `(u, vStart, vEnd)`
coordinates in the rotated frame.

### Step 3 — Cluster by parallel line + single-line filter

Sample lines hit the same wall at slightly different `v` ranges (1-2 px
jitter from rounding + tiny thickness variation). Bucketing by exact
`(vStart, vEnd)` would split readings of the same wall into adjacent
buckets. Instead:

1. Compute `center = (vStart + vEnd) / 2` for each candidate.
2. Sort by `center` and sweep linearly.
3. A new candidate joins the current cluster if `|center - clusterMean| ≤ stripWidthPx · 0.5`. Otherwise start a new cluster.
4. Within a cluster, keep only the candidate with the smallest `u` (leftmost in tangent direction).

Result: one seed per parallel wall axis crossed by the sample lines.

5. **Single-line filter (`detectMultiple = false`)** — keep only the seed whose `|center|` is smallest, i.e., the wall axis closest to the loupe centre on the normal axis. The "Détections multiples" checkbox in the drawing helper card toggles this:
   - **checked** → all parallel walls are kept
   - **unchecked** → only the wall under (or nearest to) the cursor is kept (still possibly multiple strips along that line if separated by openings).

### Step 4 — Wall-axis extension

Each seed is a small cross-section perpendicular to a presumed wall. To
recover the wall's actual extent in the loupe:

1. Use the seed midpoint as `refPoint` (lies on the wall axis).
2. Call the shared `extractSegments` helper with:
   - `probeDir = normal`, `scanDir = tangent`
   - `symmetric = true` (probe both sides of the centerline)
   - `densityThreshold = 0.55`
   - `viewportBBox = loupeBBox` (search bounded to loupe)
   - `maxGapPx = 5` — gaps ≥ 5 px are real openings (doors), gaps < 5 px are bridged as noise.

3. `extractSegments` returns ALL wall spans on this axis (a single line can carry several distinct strips separated by openings).

4. Drop spans with length ≤ `stripWidthPx + 2 px` — these are square dots (text artefacts, isolated symbols, chamfer corners).

### Step 5 — Shift to wall edge + stripOrientation

A STRIP annotation's centerline conventionally lies on the **edge** of
the wall, not at its centre — the body extends from there in
`+stripOrientation · normal` by `stripWidthPx`.

We adopt a fixed convention:
- Shift each span by `-stripWidthPx / 2` along the normal → centerline is on the `-normal` edge of the wall.
- Emit `stripOrientation = +1` → body extends in `+normal` and exactly covers the dark pixels.

The caller (`InteractionLayer.jsx`) uses the returned `stripOrientation`
when creating the STRIP annotation, ignoring the template's default for
this field.

## Exclusion mask

The exclusion mask makes detection idempotent: hovering a wall that is
already a STRIP annotation produces no new candidates because its pixels
are reported as "white" by the scan.

Built by `buildExclusionMask.js`:
- Iterates over **all visible annotations** (the `annotations` prop is already filtered by `useAnnotationsV2`).
- STRIP → fills the polygon returned by `getStripePolygons(ann, meterByPx)`.
- POLYGON / closed POLYLINE → fills the polygon.
- Open POLYLINE → strokes with the annotation's `strokeWidth` (CM converted to image px when needed).
- Reads back as `Uint8Array(width × height)`, `1` = covered.

Cached when the tool activates and rebuilt whenever
`annotations.annotationsUpdatedAt` changes (i.e., after each commit via
Space).

## Tunable constants

Defined at the top of `detectStripFromLoupe.js`:

| Constant                | Default | Meaning                                                            |
|-------------------------|---------|--------------------------------------------------------------------|
| `SAMPLE_COUNT`          | 21      | Number of orthogonal sample lines (odd → one through centre)       |
| `MAX_GAP_RATIO`         | 0.30    | Mergeable pair must have ≥ 70% black coverage                      |
| `CLUSTER_TOL_RATIO`     | 0.5     | Parallel-line cluster tolerance = stripWidthPx × this              |
| `MIN_WALL_EXTRA_PX`     | 2       | Wall is "real" iff length > stripWidthPx + this                    |
| `EXTRACT_STEP_PX`       | 2       | Step along tangent during extension probing                        |
| `EXTRACT_MAX_GAP_PX`    | 5       | < this = noise (bridge), ≥ this = real opening                     |
| `EXTRACT_DENSITY`       | 0.55    | Min dark-pixel ratio in the symmetric probe window                 |

## UI controls

- **Activate** the tool from the drawing tools menu of a STRIP template ("Détection bande").
- **Hover** the map to see candidate strips flash in green inside the loupe.
- **`o`** (lowercase) — cycle the crosshair / detection orientation: `H ↔ V`.
- **`Space`** — commit the currently displayed strips as annotations.
- **`Escape`** — clear the preview.

## Related files

- Algorithm: `src/Features/smartDetect/utils/detectStripFromLoupe.js`
- Shared helpers: `src/Features/smartDetect/utils/stripDetectionHelpers.js`
- Exclusion mask: `src/Features/smartDetect/utils/buildExclusionMask.js`
- Wiring (cache, throttle, key handlers): `src/Features/mapEditor/components/InteractionLayer.jsx`
- Tool definition: `src/Features/mapEditor/constants/drawingTools.jsx`
- Preview overlay: `src/Features/mapEditorGeneric/components/TransientDetectedStripsLayer.jsx`
- Sibling tool (full-viewport variant): `DETECT_SIMILAR_POLYLINES.md`
