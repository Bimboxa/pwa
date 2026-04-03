# Selection System

## Overview

The selection system is managed by a centralized Redux slice (`selectionSlice.js`). It handles **single selection**, **multi-selection** (Shift+Click & Lasso), and **sub-selection** (vertices, parts/segments).

All selectable elements on the map render `data-*` attributes on their SVG nodes. The `InteractionLayer` reads these attributes on click/lasso events and dispatches the appropriate actions.

---

## Selected Item Shape

Each item in `state.selection.selectedItems` has the following properties:

| Property     | Type            | Description                                                                 | Example                          |
|-------------|-----------------|-----------------------------------------------------------------------------|----------------------------------|
| `id`        | `string`        | **Primary key** of the selection item. Used for matching/toggling/removing. | `"abc123"`                       |
| `nodeId`    | `string`        | The related annotation ID (from `data-node-id`). Used to look up annotation data. | `"abc123"`                       |
| `type`      | `string`        | High-level category (from `data-node-type`)                                  | `"ANNOTATION"`, `"BASE_MAP"`     |
| `nodeType`  | `string \| null` | Annotation sub-type (from `data-annotation-type`)                            | `"POLYLINE"`, `"MARKER"`, `"RECTANGLE"`, `"IMAGE"`, `"TEXT"`, `"LABEL"`, `"POINT"`, `"STRIP"` |
| `entityId`  | `string \| null` | The parent entity ID (from `data-node-entity-id`). Used to look up entity data. | `"entity_456"`                   |
| `listingId` | `string \| null` | The listing to which this annotation belongs (from `data-node-listing-id`)   | `"listing_xyz"`                  |
| `context`   | `string \| null` | Rendering context (from `data-node-context`)                                 | `"BG_IMAGE"`, `undefined`        |
| `partId`    | `string \| null` | Currently selected sub-part (segment, cut, etc.)                             | `"abc123::SEG::0"`, `"abc123::CUT::1"`, `null` |
| `partType`  | `string \| null` | Type of the selected sub-part (from `data-part-type`)                        | `"MAIN"`, `"SEG"`, `"CUT"`, `"VERTEX"`, `null` |
| `pointId`   | `string \| null` | ID of the selected vertex point                                              | `"pt_001"`, `null`               |

---

## Data Attributes on SVG Nodes

Each `Node*Static` component renders the following `data-*` attributes on its root SVG group or shape:

| Attribute               | Set by                          | Description                                |
|------------------------|---------------------------------|--------------------------------------------|
| `data-node-id`         | All Node*Static components      | The annotation's unique ID                 |
| `data-node-entity-id`  | All Node*Static components      | The parent entity ID                       |
| `data-node-listing-id` | All Node*Static components      | The parent listing ID                      |
| `data-node-type`       | All Node*Static components      | Always `"ANNOTATION"` for annotations      |
| `data-annotation-type` | All Node*Static components      | `"POLYLINE"`, `"MARKER"`, `"RECTANGLE"`, etc. |
| `data-node-context`    | `NodeTextStatic` (and BG items) | `"BG_IMAGE"` when relevant                 |
| `data-interaction`     | Most Node*Static components     | `"draggable"`, `"resize-annotation"`, etc. |
| `data-part-id`         | Sub-parts (segments, cuts)      | Composite ID like `"abc::SEG::0"`          |
| `data-part-type`       | Sub-parts (segments, cuts, fill)| `"MAIN"`, `"SEG"`, `"CUT"`                |
| `data-point-id`        | Vertex nodes                    | Point/vertex ID                            |

---

## Actions (from `selectionSlice.js`)

| Action                      | Payload                                    | Description                                                        |
|----------------------------|--------------------------------------------|--------------------------------------------------------------------|
| `setSelectedItem`          | `item \| null`                             | Replaces the entire selection with a single item. Pass `null` to clear. |
| `setSelectedItems`         | `item[]`                                   | Replaces the entire selection with multiple items (used by lasso). |
| `toggleItemSelection`      | `item`                                     | Adds or removes the item from the selection (Shift+Click).         |
| `addSelectedItem`          | `item`                                     | Adds an item only if not already selected.                         |
| `removeSelectedItem`       | `id`                                       | Removes the item with the given `id`.                              |
| `setSubSelection`          | `{ id?, pointId?, partId?, partType? }`    | Updates sub-selection (vertex, part) on an already-selected item.  |
| `clearSelection`           | —                                          | Clears all selected items.                                         |

---

## Selectors (from `selectionSlice.js`)

| Selector                 | Returns                                | Description                                   |
|-------------------------|----------------------------------------|-----------------------------------------------|
| `selectSelectedItems`   | `item[]`                               | All selected items.                           |
| `selectSelectedItem`    | `item \| null`                         | First selected item (legacy / single-select). |
| `selectSelectedPointId` | `string \| null`                       | The `pointId` of the first item that has one. |
| `selectSelectedPartId`  | `string \| null`                       | The `partId` of the first item that has one.  |

---

## Selection Flows

### 1. Single Click (no modifier)

```
User clicks annotation
  → InteractionLayer reads data-* attributes from hit element
  → Builds newItem { id, nodeId, type, nodeType, entityId, listingId, context, partId: null, partType: null }
  → dispatch(setSelectedItem(newItem))
  → Shows PopperEditAnnotation toolbar
```

### 2. Shift + Click (multi-select)

```
User Shift+clicks annotation
  → InteractionLayer builds newItem (same as above)
  → dispatch(toggleItemSelection(newItem))
  → If selectedItems.length > 1, shows PopperEditAnnotations toolbar
```

### 3. Lasso Selection

```
User drags a lasso rectangle
  → useLassoSelection hook computes which annotation bboxes intersect
  → Calls handleLassoSelection({ annotationIds, selectionBox, anchorPosition })
  → For each annotationId, looks up the annotation to populate full item shape
  → dispatch(setSelectedItems(newItems))
  → Shows PopperEditAnnotations toolbar
```

### 4. Sub-Selection (Vertex / Part)

```
User clicks a vertex (when annotation is already selected)
  → InteractionLayer detects [data-node-type="VERTEX"]
  → dispatch(setSubSelection({ pointId, partType: "VERTEX" }))

User clicks a part/segment (when annotation is already selected)
  → InteractionLayer detects [data-part-id]
  → dispatch(setSubSelection({ partId, partType }))
```

### 5. Clear Selection

```
User clicks on empty space / base map
  → dispatch(clearSelection())
```

---

## Component Coverage

All `Node*Static` components render the required `data-*` attributes:

- ✅ `NodePolylineStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeMarkerStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodePointStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeStripStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeRectangleStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeImageStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeLabelStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
- ✅ `NodeTextStatic` — `data-node-id`, `data-node-entity-id`, `data-node-listing-id`, `data-node-type`, `data-annotation-type`
