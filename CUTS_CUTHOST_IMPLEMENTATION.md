# Cuts (Holes) with cutHost Implementation

## Overview
✅ **IMPLEMENTED**: Closed polylines can now have holes (cuts) created by `cutHost` polylines. When a polyline is created with `cutHost: true`, it automatically detects which closed polylines it intersects/contains and adds itself as a cut to those polylines.

## How It Works

### 1. Creating a cutHost Polyline

When you create a polyline annotation with `cutHost: true`:

```javascript
await createAnnotation({
  type: "POLYLINE",
  points: [...],
  closeLine: true,
  cutHost: true,  // This marks it as a cutHost
  baseMapId: "...",
  // ... other properties
});
```

**What happens (`createAnnotationService.js`):**
1. The annotation is saved to the database
2. The service finds all closed polylines on the same `baseMapId`
3. For each closed polyline, it checks if the cutHost cuts through it using `doesPolylineCutClosedPolyline`
4. If it cuts, a cut entry is added to the closed polyline's `cuts` array with:
   - `id`: Unique ID for the cut
   - `cutHostId`: Reference to the cutHost annotation ID
   - `points`: Copy of the cutHost's points
   - `closeLine`: `true` (cuts are always closed)

### 2. Cut Data Structure

Cuts are stored in the `cuts` array of closed polylines:

```javascript
{
  id: "polyline-1",
  type: "POLYLINE",
  points: [...], // Main boundary
  closeLine: true,
  cuts: [
    {
      id: "cut-1",
      cutHostId: "cutHost-polyline-id", // Reference to cutHost annotation
      points: [...], // Copy of cutHost points (synced)
      closeLine: true
    },
    ...
  ]
}
```

### 3. Updating a cutHost

When you edit a cutHost polyline (change its points):

**What happens (`updateAnnotationService.js`):**
1. The cutHost annotation is updated
2. All cuts that reference this cutHost (`cutHostId === cutHost.id`) are updated:
   - Their `points` are synced with the cutHost's new points
3. The service re-checks which closed polylines the cutHost now cuts:
   - If it newly cuts a polyline, adds the cut
   - If it no longer cuts a polyline, removes the cut

### 4. Deleting a cutHost

When you delete a cutHost polyline:

**What happens (`useDeleteAnnotation.js`):**
1. Finds all annotations on the same `baseMapId` that have cuts
2. Removes all cuts that reference this cutHost (`cutHostId === cutHost.id`)
3. Updates the annotations (removes empty cuts arrays)
4. Deletes the cutHost annotation

### 5. Rendering Cuts

Cuts are rendered in `NodePolyline.jsx`:
- Uses `fill-rule="evenodd"` to create holes in the fill
- Cut outlines are rendered separately with orange/yellow styling
- Cut anchors can be shown for editing (though cuts with `cutHostId` should ideally be edited via the cutHost)

## Key Files

### Services
- **`createAnnotationService.js`**: Handles cutHost creation and adds cuts to closed polylines
- **`updateAnnotationService.js`**: Handles cutHost updates and syncs cuts, re-checks intersections
- **`useDeleteAnnotation.js`**: Handles cutHost deletion and removes related cuts

### Components
- **`NodePolyline.jsx`**: Renders cuts as holes using compound paths with `fill-rule="evenodd"`

### Utilities
- **`doesPolylineCutClosedPolyline.js`**: Detects if a cutHost intersects or is contained within a closed polyline

## Detection Logic

`doesPolylineCutClosedPolyline` checks if a cutHost "cuts" a closed polyline by:
1. **Intersection check**: Any segment of the cutHost intersects any segment of the closed polyline
2. **Containment check**: Most points of the cutHost are inside the closed polyline (point-in-polygon test)

If either condition is true, the cutHost is considered to "cut" the closed polyline.

## Usage Example

```javascript
// 1. Create a closed polyline
const mainPolyline = await createAnnotation({
  type: "POLYLINE",
  points: [
    { x: 0.1, y: 0.1, type: "square" },
    { x: 0.9, y: 0.1, type: "square" },
    { x: 0.9, y: 0.9, type: "square" },
    { x: 0.1, y: 0.9, type: "square" },
  ],
  closeLine: true,
  baseMapId: "...",
  // ... other properties
});

// 2. Create a cutHost polyline that cuts through it
const cutHost = await createAnnotation({
  type: "POLYLINE",
  points: [
    { x: 0.3, y: 0.3, type: "square" },
    { x: 0.4, y: 0.3, type: "square" },
    { x: 0.4, y: 0.4, type: "square" },
    { x: 0.3, y: 0.4, type: "square" },
  ],
  closeLine: true,
  cutHost: true, // This marks it as a cutHost
  baseMapId: mainPolyline.baseMapId, // Same baseMap
  // ... other properties
});

// Result: The mainPolyline will automatically have a cut added to its cuts array
// The hole will appear when rendering the mainPolyline
```

## Notes

- Cuts must be on the same `baseMapId` as the closed polylines they cut
- Cuts are automatically synced when cutHosts are edited
- Cuts are automatically removed when cutHosts are deleted
- Cut points are copied from the cutHost (not references), but kept in sync
- The detection logic uses intersection and containment checks for robustness

