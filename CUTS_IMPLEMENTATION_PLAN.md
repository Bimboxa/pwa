# Cuts (Holes) in Closed Polylines - Implementation Complete

## Overview
✅ **IMPLEMENTED**: Support for "cuts" (holes) in closed polylines. Polylines can now have holes defined by nested cut polylines.

## Data Structure

### Annotation Structure
```javascript
{
  id: "...",
  type: "POLYLINE",
  points: [...], // Main polyline points
  closeLine: true,
  cuts: [        // Array of cut polylines (holes)
    {
      id: "cut-1", // Required: unique ID for the cut
      points: [...], // Points defining the hole (relative coordinates 0-1)
      closeLine: true // Cuts should always be closed
    },
    ...
  ]
}
```

## Implementation Details

### 1. ✅ Path Building with Cuts

**File: `NodePolyline.jsx` - `buildPathAndMap` function**

- Modified to accept `cuts` parameter
- Builds path strings for each cut using the same logic as main path
- Supports square-circle-square arc patterns in cuts
- Combines paths: `mainPath + " " + cutPath1 + " " + cutPath2 + ...`

### 2. ✅ Rendering with Holes

**File: `NodePolyline.jsx` - Fill rendering**

- Uses `fill-rule="evenodd"` when cuts exist
- Automatically creates holes in the fill
- Hatching patterns respect holes (works with evenodd)
- Cut outlines rendered separately with orange/yellow styling when editing

### 3. ✅ Editing Cuts

**State Management:**
- `editingCutId`: Tracks which cut is being edited
- `tempCuts`: Temporary state for cut editing preview
- Cut anchors rendered separately when `editingCutId` matches

**Editing Behavior:**
- Cut anchors appear in orange (#ffaa00) when not editing, bright orange (#ff6600) when editing
- Cut outlines use dashed stroke when not editing, solid when editing
- Cut point dragging updates cut independently from main polyline
- Main polyline re-renders automatically when cut changes

### 4. Cut Creation (TODO - Not Yet Implemented)

To create cuts, you'll need to:
- Add a UI mode or context menu option to "Add Cut"
- When in cut creation mode, drawing a new closed polyline adds it to the `cuts` array
- Validate containment within main polyline (optional)

**Example cut creation code:**
```javascript
// When completing a polyline in "add cut" mode:
const newCut = {
  id: nanoid(), // Generate unique ID
  points: drawnPoints,
  closeLine: true
};

const updatedAnnotation = {
  ...existingAnnotation,
  cuts: [...(existingAnnotation.cuts || []), newCut]
};
```

## How to Use

### Adding Cuts to an Annotation

```javascript
await updateAnnotation({
  ...annotation,
  cuts: [
    {
      id: "cut-1",
      points: [
        { x: 0.3, y: 0.3, type: "square" },
        { x: 0.4, y: 0.3, type: "square" },
        { x: 0.4, y: 0.4, type: "square" },
        { x: 0.3, y: 0.4, type: "square" },
      ],
      closeLine: true
    }
  ]
});
```

### Editing Cuts Programmatically

Cuts are edited the same way as the main polyline - update the `cuts` array:

```javascript
// Update a specific cut
const updatedCuts = annotation.cuts.map(cut => 
  cut.id === targetCutId 
    ? { ...cut, points: newPoints }
    : cut
);

await updateAnnotation({
  ...annotation,
  cuts: updatedCuts
});
```

### Visual Indicators

- **Main polyline**: Blue/red anchors, solid stroke
- **Cut polylines**: Orange/yellow anchors, dashed stroke (when not editing)
- **Editing cut**: Bright orange anchors, solid stroke

## Next Steps (Optional Enhancements)

1. **Cut Creation UI**: Add button/menu to create new cuts
2. **Cut Selection**: Click to select and edit a specific cut
3. **Cut Deletion**: Right-click menu to delete a cut
4. **Validation**: Ensure cuts are fully contained within main polyline
5. **Cut Transformation**: Move/scale entire cuts as a unit

## Notes

- Cuts use the same point types (square/circle) as main polylines
- Arc patterns (square-circle-square) work in cuts
- Cuts must be closed (`closeLine: true`)
- Fill-rule evenodd ensures proper hole rendering regardless of winding order

