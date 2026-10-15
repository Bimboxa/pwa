# Pattern repetition while drawing (« Répétition du motif »)

While a click-drawn path is in progress (2D `InteractionLayer` and 3D
`useDrawingPointerHandlers`), typing `*N` repeats the pattern just drawn N more
times: a "copy-paste while drawing", e.g. one riser + tread then `*3` → 4 steps.

## Grammar and keys

| Key / buffer | Effect |
|---|---|
| `*` | opens the count (= `*1`), only when a pattern exists (≥ 1 segment, not closed) |
| `*3` | 3 repetitions (max `MAX_COPIES` = 99, shared with « Déplacer ») |
| `⌫` | erases one character (`*3` → `*` → nothing) |
| click | appends the repeated points; **no point at the cursor**, the drawing goes on |
| `Entrée` | appends the repeated points, then ends the annotation |
| `Échap` | drops the pending repetition only |

While a repetition is pending, the rubber band is replaced by a dashed ghost of
the repeated points and the cursor badge shows `×N`. Length digits / `.` / `;`
are not accepted until it is validated or dropped.

Modes: `PATTERN_REPEAT_DRAWING_MODES` (`CLICK`, `POLYLINE_CLICK`,
`POLYGON_CLICK`, `STRIP`). The 3D editor covers POLYLINE / POLYGON, template
or template-less (« Dessin ») — STRIP is not drawable in 3D.

## Pattern

- Pattern = points from the last repetition anchor (or the first point) to the
  last point. Translation `delta = last − first` (x / y, plus z in 3D); copy `k`
  appends `pattern[1..m] + k × delta`.
- The last appended point carries `{ patternAnchor: true, motifLength: m }`. The
  next pattern starts there. When nothing was drawn since, `*N` repeats the
  previous pattern (`motifLength` segments) again.
- The tags live in the drawn points themselves (`drawingPoints` 2D,
  `threedEditor.drawingMode.inProgressPolyline` 3D), so erasing points or
  resetting the drawing needs no extra state. The commits ignore the extra
  fields.
- Copies are independent points: `existingPointId`, `snapSegment`, `meshKey`,
  `nodeId` and `faceNormal` are dropped. `type` (arcs) and `baseMapId` are
  kept.

## Code map

- `src/Features/mapEditor/utils/patternRepeat.js`: pure buffer + pattern logic,
  with node tests `patternRepeat.test.mjs`.
- `mapEditor.patternRepeatBuffer` (`mapEditorSlice`): shared by both editors,
  like `constraintBuffer`. It is cleared by `setEnabledDrawingMode` and when
  the path in progress empties. Opening it drops the typed length.
- 2D: `InteractionLayer.applyPendingPatternRepeat()` (world + marker clicks,
  Enter) and `DrawingLayer.setPatternRepeatPreview()` (ghost).
- 3D: `useDrawingPointerHandlers` (`onPatternRepeatKey`,
  `applyPendingPatternRepeat`, `appendDrawingVertices`) and the
  `DrawingOverlayThreed` ghost.
- `useDeleteMesh3dPartsOnKeyboard` lets Backspace reach the 3D drawing (only
  the browser default is blocked), so the count and the typed length can be
  erased.
- Helper card: `SectionDrawingPatternRepeat` (under « Contraintes »).
