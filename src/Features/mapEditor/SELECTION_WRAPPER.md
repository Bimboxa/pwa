# Selection & Editing Wrapper — Architecture

## Overview

The selection/wrapper system allows users to select one or more annotations on the
map and manipulate them (move, resize, rotate) through a unified bounding-box
wrapper. The wrapper is exclusively for **point-based** annotation types
(`POLYLINE`, `POLYGON`, `STRIP`). Other types (RECTANGLE, MARKER, TEXT, etc.) use
their own built-in drag handles.

---

## Selection state

Selection lives in two Redux slices:

| Slice | Key state | Purpose |
|-------|-----------|---------|
| `selectionSlice` | `selectedItems[]`, sub-selection (`pointId`, `partId`) | Source of truth for what is selected |
| `mapEditorSlice` | `wrapperMode` (boolean) | Controls whether the wrapper is shown for a single selection |

### Selection item shape

```js
{
  id, nodeId,               // annotation ID
  type: "NODE",
  nodeType: "ANNOTATION",
  annotationType,           // "POLYLINE" | "POLYGON" | "RECTANGLE" | ...
  entityId, listingId,
  nodeContext,              // "BASE_MAP" | "BG_IMAGE"
  pointId, partId, partType // sub-selection (vertex / segment)
}
```

---

## Click flow

```
User clicks on the map
  → InteractionLayer.handleWorldMouseClick()
  → Detect target via nativeTarget.closest("[data-node-type]")
  → Priority:
      1. VERTEX click  → setSubSelection({ pointId })   → vertex editing mode
      2. PART click    → setSubSelection({ partId })     → segment editing mode
      3. ANNOTATION    → setSelectedItem(item)            → annotation selected
         + Shift held  → toggleItemSelection(item)        → multi-selection
  → Redux updates → EditedObjectLayer re-renders
```

---

## Wrapper display rules

Computed in `EditedObjectLayer.jsx`:

```js
const POINT_BASED_TYPES = ["POLYLINE", "POLYGON", "STRIP"];

const showWrapper =
  pointBasedAnnotations.length > 0 &&       // at least one point-based type
  (isMultiSelection || wrapperMode) &&       // multi-select OR wrapperMode on
  !selectedPointId;                          // no vertex currently selected
```

| Scenario | Wrapper visible | Vertices visible |
|----------|:--------------:|:----------------:|
| Single POLYLINE, `wrapperMode = false` | no | yes |
| Single POLYLINE, `wrapperMode = true` (Move button) | **yes** | no |
| Multiple annotations selected | **yes** | no |
| Vertex selected (`selectedPointId`) | no | yes |
| Single RECTANGLE / MARKER / TEXT | no | n/a (own handles) |

`wrapperMode` is toggled by the **Move** button in the toolbar.

---

## Annotation types vs editing mode

| Type | Wrapper | Edit method | Key properties |
|------|:-------:|-------------|----------------|
| POLYLINE | yes | Vertex editing / wrapper | `points[]`, `strokeWidth`, `cuts[]` |
| POLYGON | yes | Vertex editing / wrapper | `points[]`, `fillColor`, `cuts[]` |
| STRIP | yes | Vertex editing / wrapper | `points[]`, `width` |
| RECTANGLE | no | Component's own handles | `x`, `y`, `width`, `height`, `rotation` |
| CIRCLE | no | Component's own handles | `x`, `y`, `radius` |
| MARKER | no | Drag position | `x`, `y`, `iconKey` |
| SEGMENT | no | Endpoint drag | start/end points |
| TEXT | no | Drag position + inline edit | `x`, `y`, `text`, `fontSize` |
| IMAGE | no | Component's own handles | `x`, `y`, `width`, `height` |

---

## AnnotationEditingWrapper component

SVG group rendered **on top** of selected annotations in `EditedObjectLayer`.

### Visual elements

- **Dashed rectangle** — draggable hit area (`data-interaction="draggable"`)
- **4 corner handles** (NW, NE, SW, SE) — resize (`data-interaction="resize-annotation"`)
- **Rotation handle** — circle above top edge (`data-interaction="rotate-annotation"`)

All handles are zoom-independent (counter-scaled via `scale(1 / zoom)`).
Handles are hidden during active drag for performance.

### Rotation pivot

- Uses `rotationCenter` from the annotation if available (persisted after first rotation)
- Falls back to bbox center if no `rotationCenter` exists

---

## Wrapper bbox computation

`computeWrapperBbox(annotations, rotation?, rotationCenter?)`

1. Collects all points from all annotations (main path + cuts)
2. If `rotation !== 0`: un-rotates points around `rotationCenter` to get canonical positions
3. Computes axis-aligned bounding box `{ x, y, width, height }`

The caller applies the rotation visually via SVG `transform="rotate(…)"`.

---

## Transform operations

`applyWrapperTransformToPoints({ annotations, wrapperBbox, deltaPos, partType })`

Returns `Map<pointId, { x, y }>` — the new pixel position for each point.

### MOVE (`partType = null`)

Translates every point by `deltaPos.x`, `deltaPos.y`.

### RESIZE (`partType = "RESIZE_SE" | "RESIZE_NW" | …`)

1. Determines anchor (opposite corner from dragged handle)
2. Computes scale factors `scaleX = newWidth / oldWidth`, `scaleY = newHeight / oldHeight`
3. Repositions each point relative to anchor: `anchor + (pt - anchor) * scale`
4. Minimum size guard: 20px

### ROTATE (`partType = "ROTATE"`)

1. Computes bbox center
2. Rotates each point around center by `deltaPos.x` degrees

---

## Database commit

`commitWrapperTransform(params)` — single Dexie transaction.

### Point deduplication

Annotations may share points (e.g. two polygons sharing a common edge). When
transforming, only selected annotations should move:

```
For each point in the transform:
  if ALL annotations referencing it are selected → update in-place (exclusive)
  if SOME annotations referencing it are NOT selected → duplicate (shared)
```

Duplicated points get a new `nanoid()` ID, and the selected annotations' `points[]`
and `cuts[]` arrays are updated to reference the new ID.

### Rotation metadata

- **ROTATE**: accumulates `rotation` on each annotation. On first rotation, stores
  `rotationCenter` (bbox center, normalized to image coords).
- **MOVE**: translates `rotationCenter` by the move delta.
- **RESIZE**: clears `rotation` and `rotationCenter` (resize "bakes in" the rotation
  since points are already rotated in DB).

### Transaction contents

All operations run in a single `db.transaction("rw", db.points, db.annotations)`:

1. Update exclusive points positions
2. Add duplicated points
3. Update annotation references for duplicated points
4. Handle rotation delta
5. Translate `rotationCenter` on MOVE
6. Clear rotation metadata on RESIZE

---

## Live drag (optimistic overlay)

During drag, the wrapper uses the same optimistic overlay pattern as annotation drag
(see `DRAG_ARCHITECTURE.md`):

1. `pendingMovesRef.set("wrapper", { deltaPos, partType })` — ref, no re-render
2. Static annotations rendered with `opacity: 0`
3. `TransientAnnotationLayer` renders the live preview at 60fps
4. On mouseUp → `commitWrapperTransform()` → DB transaction
5. `useLiveQuery` detects changes → static layer restores `opacity: 1` → overlay removed

---

## Multi-selection

| Method | Action |
|--------|--------|
| Click | `setSelectedItem(item)` — replaces selection |
| Shift+Click | `toggleItemSelection(item)` — adds/removes from selection |
| Lasso | `setSelectedItems(items)` — selects all annotations in rectangle |

When multiple point-based annotations are selected, the wrapper automatically
encompasses all of them with a single unified bounding box.

---

## Key files

| File | Role |
|------|------|
| `selectionSlice.js` | Redux state: `selectedItems[]`, sub-selection |
| `mapEditorSlice.js` | Redux state: `wrapperMode`, `editedNode` |
| `InteractionLayer.jsx` | Click detection, drag cycle, state dispatching |
| `EditedObjectLayer.jsx` | Decides what to render: wrapper vs vertices |
| `AnnotationEditingWrapper.jsx` | SVG wrapper with resize/rotate handles |
| `computeWrapperBbox.js` | Unified bbox from multiple annotations |
| `applyWrapperTransformToPoints.js` | Point position math (move/resize/rotate) |
| `commitWrapperTransform.js` | DB transaction with point deduplication |
| `InteractionContext.jsx` | `pendingMovesRef`, optimistic overlay state |
