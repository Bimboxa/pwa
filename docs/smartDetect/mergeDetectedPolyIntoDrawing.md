# mergeDetectedPolyIntoDrawing

## Purpose

Merges a detected orthogonal polyline (from the ORTHO_PATHS BFS algorithm) into the current drawing points array, preserving point order and avoiding overlaps.

## Context

When the user draws a polyline using the ORTHO_PATHS Smart Detect mode:

1. **Click** → a point is added to `drawingPoints`, and the BFS traces the dark line from that click
2. **Space** → the detected polyline is merged into `drawingPoints` via this function
3. The user can then click again to extend, triggering another BFS + merge cycle

The detected polyline is **orthogonal** (only horizontal/vertical segments) and passes through **A'** — the BFS start point, which is the click position snapped to the median line of the dark band.

## Algorithm

### Inputs

- `drawingPoints`: the current array of drawing points. The **last point** is always the click that triggered the BFS.
- `detectedPolyRaw`: the polyline returned by the BFS worker. A continuous path from `endA` through `A'` to `endB`.

### Step 1: Find A'

A' is the point in `detectedPolyRaw` closest to the click point (last of `drawingPoints`). This is the BFS start point snapped to the median line.

```
detectedPolyRaw: [endA, ..., A', ..., endB]
                              ^
                          splitIdx
```

### Step 2: Split into two arms

The detected polyline is split at A' into two arms, each walking **away** from A':

```
arm1: [A', ..., endA]   (toward poly start, reversed)
arm2: [A', ..., endB]   (toward poly end)
```

Both arms start with A' as their first point.

### Case 1: First point (drawingPoints has 1 point)

No existing drawing to connect to. Orient the full polyline so the **longest arm** (by path length) is last — this becomes the drawing tip.

```
Result: [shortEnd, ..., A', ..., longEnd]
```

The user can then continue drawing from `longEnd`.

### Case 2: Extending (drawingPoints has ≥ 2 points)

There is an existing drawing to extend. **Previous points are NEVER modified.**

**Pick the forward arm**: compare the Euclidean distance from each arm's end to `prevPoints[-1]` (the last point before the click). The arm whose end is **farther** goes forward — it extends the drawing in a parallel or perpendicular direction.

```
prevPoints: [P1, P2, ..., Pn]     ← untouched
clickPt (replaced by A')

forward arm: [A', F1, F2, ..., Fk]  ← appended
```

**Result**: `[P1, P2, ..., Pn, A', F1, F2, ..., Fk]`

The click point is replaced by A' (snapped to median), and the forward arm extends the drawing.

## Visual Example

```
Step 1: User clicks P1, BFS detects horizontal line
        drawingPoints = [P1]
        detectedPoly  = [leftEnd ── A' ──────── rightEnd]

        After merge (longest arm = right):
        drawingPoints = [leftEnd, A', ..., rightEnd]

Step 2: User clicks near rightEnd, BFS detects vertical line going down
        drawingPoints = [..., rightEnd, clickPt]
        detectedPoly  = [topEnd ── A' ── bottomEnd]

        prevEnd = rightEnd (close to topEnd)
        forward arm = [A', ..., bottomEnd] (farther from prevEnd)

        After merge:
        drawingPoints = [leftEnd, ..., rightEnd, A', ..., bottomEnd]
```

## Key Properties

- **Order preservation**: `prevPoints` are never modified or reordered
- **Orthogonal continuity**: the forward arm is kept in full, preserving H/V segments
- **Median snap**: A' replaces the raw click point, centering on the dark band
- **Direction**: forward arm always goes parallel or perpendicular to the drawing direction

## File Location

`src/Features/smartDetect/utils/mergeDetectedPolyIntoDrawing.js`

## Dependencies

None (pure function, no imports).
