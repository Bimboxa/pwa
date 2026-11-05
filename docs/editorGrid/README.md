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

## Displayed cell size

One function, `utils/getDisplayedGridStepM.js`, shared by the layer, the snap
and the label (`pxPerMeter = zoom × basePose.k / meterByPx`):

- **dynamic**: the smallest length of the scale indicator sequence
  (`mapEditorGeneric/utils/scaleSteps.js`, also used by `HelperScale`: 1 cm,
  5 cm, 10 cm, 50 cm, 1 m, 5 m…) whose cell is at least 24 px on screen;
- **fixed**: `stepM`, or nothing while its cells are under 6 px on screen
  (neither drawn nor snappable).

In dynamic mode `LabelEditorGridStep` shows « Maille : 50 cm » above the scale
indicator, bottom left of the editor.

## Drawing

`components/LayerEditorGrid.jsx`, mounted by `StaticMapContent` inside the
base pose group, above the base map image and under the annotations. One
`<path>` in base-map **local px**, hairline (`non-scaling-stroke`), light
grey, never hit-tested, `data-capture-hide`.

- anchored on the **bottom-left** corner of the base map, clipped to its
  extent;
- culled to `visibleViewBox` (InteractionContext), capped at 1500 lines;
- re-renders on the flushed map zoom (`useMapZoom`, end of a zoom gesture)
  and on the debounced visible box — not on every camera tick.

## Snap

`utils/getGridSnap.js`: each axis snaps on its own within the usual 12 px
threshold — near a vertical line only `x` is corrected, near a horizontal
line only `y`, near a node both.

Wired in `mapEditor/components/InteractionLayer.jsx` (`computeGridSnap`),
always as the **lowest priority**: only when no vertex / midpoint snap, no
projection within its display range, no distant-point axis lock and no Shift
constraint applies.

| gesture | how |
|---|---|
| drawing a point (`POINT_PLACEMENT_DRAWING_MODES`) | `gridSnapRef` set on mouse move, applied to the preview and — like the axis lock — to the click baseline in `handleWorldClick` |
| vertex drag | `snapOverride` of `usePointDrag` |
| marker-like annotation drag (revolution axes…) | `dragSnapTarget` of the anchor |
| move tool (`MOVE_ANNOTATION`) | destination only (the grab click needs a point of an annotation) |

`GridSnapMarker` (magenta cross, screen space, imperative) shows the snapped
point. Unlike the vertex marker it is not clickable: the snap is applied at
commit wherever the user clicks.

Not snapped: the whole-annotation drag of ordinary shapes (it has no anchor
point), the rotate tool, pick / fill / paste modes, and the 3D editor.
