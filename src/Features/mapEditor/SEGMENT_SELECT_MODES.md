# Segment Select Modes

## Overview

Some drawing tools don't actually draw new geometry — they let the user **click on an existing segment** to perform an action on it (cut, technical return, etc.).

These modes share common UX requirements that differ from standard drawing modes:

- No smart detect (SMART_DETECT) needed
- No snapping needed
- Cursor should be `pointer` (not `crosshair`)
- The ScreenCursor overlay should be hidden
- Hovered segments should be highlighted in **neon green** (`#76ff03`)

## The `SEGMENT_SELECT_MODES` constant

All segment-selection behaviors are driven by a single constant defined in `InteractionLayer.jsx`:

```js
const SEGMENT_SELECT_MODES = ["TECHNICAL_RETURN", "CUT_SEGMENT"];
```

Adding a new segment-selection tool only requires appending its key to this array.

## What the constant controls

| Behavior | Standard drawing mode | Segment select mode |
|---|---|---|
| Smart Detect | Enabled (`showSmartDetectRef = true`) | Disabled |
| Snapping | Enabled | Disabled (`preventSnapping = true`) |
| Cursor | `crosshair` | `pointer` |
| CSS override (`& *`) | `crosshair !important` | `pointer !important` |
| ScreenCursorV2 | Visible | Hidden |

## Visual feedback: `selectMode` prop

A `selectMode` prop is derived from `enabledDrawingMode` in `StaticMapContent.jsx` and passed down through the component chain:

```
StaticMapContent  (derives selectMode from Redux enabledDrawingMode)
  -> NodeAnnotationStatic  (passes through)
    -> NodePolylineStatic  (applies hover highlight)
```

### Possible values

| Value | Meaning | Triggered by |
|---|---|---|
| `"SEGMENT"` | User is picking a segment | `TECHNICAL_RETURN`, `CUT_SEGMENT` |
| `"VERTEX"` | (Future) User is picking a vertex | — |
| `null` | Default — no special selection mode | All other modes |

### Effect in `NodePolylineStatic`

When `selectMode === "SEGMENT"`, the `getPartStyle()` function overrides the hovered segment style:

```js
if (selectMode === "SEGMENT" && hoveredPartId === currentPartId) {
  return { stroke: "#76ff03", fill: "#76ff03", strokeWidth: computedStrokeWidth + 2 };
}
```

This takes priority over both standard hover and sub-selection styles.

## How to add a new segment-selection tool

1. Add the tool key to `SEGMENT_SELECT_MODES` in `InteractionLayer.jsx`
2. Add the click handler in the `handleWorldClick` function (similar to `TECHNICAL_RETURN` / `CUT_SEGMENT` blocks)
3. The cursor, snapping, smart detect, ScreenCursor, and hover highlight will all be handled automatically
