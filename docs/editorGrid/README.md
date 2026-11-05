# Editor grid (« Grille » command)

`src/Features/editorGrid` — a metric grid drawn over the current base map of
the **2D editor**, whose lines are snap targets while drawing / moving.

It is a **view setting of the device** (`editorGrid` slice, persisted in
localStorage), not a property of the base map: nothing is written to the
base map record, and the grid never appears in captures / prints.

## Settings

| key | meaning |
|---|---|
| `enabled` | grid drawn + snappable |
| `stepM` | cell size in metres (fixed mode) |
| `dynamic` | « Grille dynamique »: the cell size follows the zoom |

`hooks/useEditorGrid.js` returns them as the editor must apply them: the grid
stays off wherever the commands toolbar is hidden (Viewer module, capture
framing, PDF editor…), since its toggle is not reachable there.

## Command

`commandsToolbar/commands/toggleGrid` (`TOGGLE_GRID`, 2D editor, needs the
base map scale) — the **first** command of the toolbar (section « Grille » of
the default and Fonds de plan layouts). `ButtonToggleGrid` is the toggle plus
a small arrow opening the options: cell size (presets or a typed value in
metres) and « Grille dynamique ». Picking an option turns the grid on.

## Displayed grid: secondary cells + main grid

One function, `utils/getDisplayedGrid.js`, shared by the layer, the snap and
the label (`pxPerMeter = zoom × basePose.k / meterByPx`). It returns
`{ stepM, majorEvery }`: `stepM` is the cell of the lines drawn (the
**secondary** grid, thin lines — also the snap grid), and one line out of
`majorEvery`, counted from the grid origin, belongs to the **main** grid
(thicker line).

- **dynamic**: `stepM` is the smallest length of the scale indicator sequence
  (`mapEditorGeneric/utils/scaleSteps.js`, also used by `HelperScale`: 1 cm,
  5 cm, 10 cm, 50 cm, 1 m, 5 m…) whose cell is at least 24 px on screen; the
  main grid is the **next** length of the sequence (10 cm → 50 cm,
  50 cm → 1 m…);
- **fixed**: `stepM` cells with a main line every 5. While the cells are under
  6 px on screen only the main grid stays (drawn and snappable); under 6 px
  for the main grid too, nothing.

In dynamic mode `LabelEditorGridStep` shows « Maille : 10 cm · trait fort :
50 cm » above the scale indicator, bottom left of the editor.

## Drawing

`components/LayerEditorGrid.jsx`, mounted by `StaticMapContent` inside the
base pose group, above the base map image and under the annotations. Two
`<path>` in base-map **local px** (secondary grid 0.5 px, main grid 1 px),
hairline (`non-scaling-stroke`), light grey, never hit-tested,
`data-capture-hide`.

- anchored on the **bottom-left** corner of the base map, clipped to its
  extent;
- **turned by the ortho snap angle** of the editor
  (`mapEditor.orthoSnapAngleOffset`, around that corner — `utils/gridAxes.js`,
  the frame shared with the snap): the lines are parallel to the directions
  the Shift ortho constraint snaps to. A rotated grid overflows the base map
  rectangle, so the layer clips it (`clipPath`);
- culled to the visible area plus half a viewport of margin, capped at 3000
  lines;
- follows the **live camera**: the dynamic cell size switches during the zoom
  gesture, not after it.

### Live camera, without a render per frame

`MapEditorViewport` publishes its camera through `MapCameraContext`
(`mapEditorGeneric/hooks/useMapCamera.js`), notified on every applied
transform (one per animation frame). It is read through
`useMapCameraSelector(selector)` only: the component re-renders when the
selected value changes.

- The layer selects a **grid frame** `{ stepM, majorEvery, box }`
  (`utils/getGridFrame.js`), which keeps the previous frame — same reference,
  no re-render — while the displayed grid is the same and the visible area
  is still inside the box already drawn. The grid is thus rebuilt when the
  cell size switches or the view leaves the drawn region, a handful of times
  per gesture.
- The label selects its own text.

This is deliberately NOT `useMapZoom`: that zoom is flushed 150 ms after the
gesture (it drives the `--map-zoom` CSS variable, whose per-tick update would
restyle thousands of annotation paths). The grid has no such cost — its
strokes are non-scaling.

## Snap

`utils/getGridSnap.js`, on every line drawn (secondary and main grid alike),
in the grid frame (so with the same rotation as the drawing): each grid axis
snaps on its own within the usual 12 px threshold — near a line of one family
only that coordinate is corrected, near a node both.

Wired in `mapEditor/components/InteractionLayer.jsx` (`computeGridSnap`),
always as the **lowest priority**: only when no vertex / midpoint snap, no
projection within its display range, no distant-point axis lock and no Shift
constraint applies.

| gesture | how |
|---|---|
| drawing a point (`POINT_PLACEMENT_DRAWING_MODES`) | `gridSnapRef` set on mouse move, applied to the preview and — like the axis lock — to the click baseline in `handleWorldClick` |
| vertex drag | `snapOverride` of `usePointDrag` |
| marker-like annotation drag (revolution axes…) | `dragSnapTarget` of the anchor |
| move tool (`MOVE_ANNOTATION`) | the destination (the grab click needs a point of an annotation) |
| rotate tool (`ROTATE_ANNOTATION`) | the pivot, the reference axis (2/3) and the target (3/3) |

`GridSnapMarker` (magenta cross, screen space, imperative) shows the snapped
point. Unlike the vertex marker it is not clickable: the snap is applied at
commit wherever the user clicks.

Not snapped: the whole-annotation drag of ordinary shapes (it has no anchor
point), pick / fill / paste modes, and the 3D editor.
