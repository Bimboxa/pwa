# 3D mesh cells ("maillage" / mailles)

How the 3D-native mesh feature works: creating mailles from annotation faces
in the 3D viewer (one by one, or all at once from the cut lines) and
numbering them.

Everything lives in [`src/Features/threedMesh/`](../../src/Features/threedMesh/)
plus the `meshingMode` state in
[`threedEditorSlice.js`](../../src/Features/threedEditor/threedEditorSlice.js).

> **Not to be confused with** the older 2D mesh editor
> (`src/Features/mesh/`, right-panel "Maillage" on the 2D map editor), which
> materializes cells as real annotations (`isMeshCell: true`) linked through
> the `relAnnotationMeshCells` table. The two features coexist but share no
> code and no data.

This complements [`POINTS_AND_TRANSFORMS.md`](POINTS_AND_TRANSFORMS.md)
(annotation geometry in 3D) — read it for how the annotation meshes that
mailles are created _from_ get built.

---

## TL;DR for Claude

- Mailles are rows of the **`db.meshes3d`** table — they are **NOT
  annotations**, do not appear in `useAnnotationsV2`, and do **not** use
  `db.points`.
- Geometry is a **snapshot in three.js world coordinates (meters)**:
  `faces: [{ contour: [{x,y,z}], holes: [[{x,y,z}]], normal: {x,y,z} }]`.
  A maille does not follow its source annotation if the annotation moves.
- A maille can be **multi-face** (faces on different planes, produced by
  "Fusionner").
- `number` is allocated once and **never reused** (max over all scope rows
  _including soft-deleted ones_). Display label =
  `label ?? prefix + number` (default prefix `"M-"`).
- Mailles are no longer cut directly: the cells are prepared with **cut
  lines** (`Features/threedCutLines`, see its README), then created with
  « Mailler » (all at once) or « Ajouter une maille » (one piece).
- The module tools are **commands of the commands toolbar** (MESHES layout):
  `ADD_MESH`, `CREATE_MESHES`, `NUMBER_MESHES`. There is no bottom meshing
  toolbar any more.

---

## Data model

Schema ([`db.js`](../../src/App/db/db.js), version 24):

```js
meshes3d: "id,projectId,scopeId,[projectId+scopeId]";
```

Record shape (created by
[`createMesh3dService.js`](../../src/Features/threedMesh/services/createMesh3dService.js)):

| Field                  | What it stores                                                                                                                                      | Space / notes                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                   | nanoid                                                                                                                                              |                                                                                                                                                                                       |
| `projectId`, `scopeId` | scoping; all reads go through the `[projectId+scopeId]` compound index                                                                              |                                                                                                                                                                                       |
| `number`               | auto-number, allocated in the create transaction as `1 + max(number)` over **all** rows of the scope **including soft-deleted** ones → never reused |                                                                                                                                                                                       |
| `label`                | optional user override of the display label                                                                                                         |                                                                                                                                                                                       |
| `baseColor`            | source annotation's color (`fillColor ?? strokeColor`)                                                                                              | fill is a lightened, per-number-varied shade of it ([`getMesh3dCreationColors.js`](../../src/Features/threedMesh/utils/getMesh3dCreationColors.js)) so touching mailles stay distinct |
| `color`, `edgeColor`   | resolved display colors                                                                                                                             |                                                                                                                                                                                       |
| `surface`              | cached total area (m²) = sum of face areas ([`computeMesh3dSurface`](../../src/Features/threedMesh/utils/computeFaceArea.js))                       | recomputed on every merge / face change                                                                                                                                               |
| `faces`                | `[{ contour, holes, normal }]`                                                                                                                      | **three.js world coordinates, meters**                                                                                                                                                |
| `sourceInfo`           | `{ annotationId }` of the face the maille was created from                                                                                          | informational only — no live link                                                                                                                                                     |

The table is registered in the audit, soft-delete and ownership table sets of
`db.js`: rows get `createdAt` / `updatedAt` / `deletedAt` and are only ever
soft-deleted.

Display label: [`getMesh3dDisplayLabel.js`](../../src/Features/threedMesh/utils/getMesh3dDisplayLabel.js)
returns `label ?? prefix + number`. The prefix is stored per scope
(`scope.mesh3dSettings.labelPrefix`, default `DEFAULT_MESH3D_LABEL_PREFIX =
"M-"`) so it travels with Krto exports — read/written by
[`useMesh3dLabelPrefix.js`](../../src/Features/threedMesh/hooks/useMesh3dLabelPrefix.js).

Shared constants:
[`mesh3dConstants.js`](../../src/Features/threedMesh/utils/mesh3dConstants.js)
(`MESH3D_EXTRUDE_M = 0.005`, `MESH3D_SNAP_PX = 10`,
`DEFAULT_MESH3D_COLOR`, `MESH3D_SELECTION_TYPE = "MESH3D"`).

---

## UI entry points

| Component                                                                                                                                                                                 | Role                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `commandsToolbar/commands/addMesh`, `createMeshes`, `numberMeshes`                                                                                                                        | Commands of the MESHES layout: « Ajouter une maille » (tool `CREATE`), « Mailler » (every maille from the cut lines, `createMeshesFromCutLinesService`), « Numéroter » (tool `NUMBER`). The `CREATE` / `NUMBER` tools show their body in the drawing helper (`selectActiveMeshHelperTool` → `SectionMeshCreateHelperContent` / `SectionMeshNumberHelperContent`, the latter carrying the « Démarrage » field) |
| [`MeshingOverlayThreed.jsx`](../../src/Features/threedMesh/components/MeshingOverlayThreed.jsx)                                                                                           | HTML overlay: "+ nouvelle maille" cursor helper and area chips. Fed by [`meshingOverlayStore.js`](../../src/Features/threedMesh/services/meshingOverlayStore.js)                                                                                                                                                                                                                                              |
| [`ThreedMeshes.jsx`](../../src/Features/threedMesh/components/ThreedMeshes.jsx)                                                                                                           | Renders all persisted mailles into the scene (see Rendering)                                                                                                                                                                                                                                                                                                                                                  |
| [`PanelMeshesViewer.jsx`](../../src/Features/threedMesh/components/PanelMeshesViewer.jsx)                                                                                                 | Left drawer of the module: mailles list (optionally grouped by orientation) + export                                                                                                                                                                                                                                                                                                                          |
| [`PanelPropertiesMeshesModule.jsx`](../../src/Features/threedMesh/components/PanelPropertiesMeshesModule.jsx)                                                                             | Module properties panel (empty selection): description and the settings cards (`SectionMeshes3dSettings`: `hideAnnotationsIn3d`, surface decimals, label options `mesh3dLabels`, numbering prefix)                                                                                                                                                                                                            |
| [`ToolbarEditMesh3d.jsx`](../../src/Features/threedMesh/components/ToolbarEditMesh3d.jsx) / [`ToolbarEditMeshes3d.jsx`](../../src/Features/threedMesh/components/ToolbarEditMeshes3d.jsx) | Edit popper for 1 / ≥2 selected mailles (rename, color, batch color, **Fusionner**, delete)                                                                                                                                                                                                                                                                                                                   |

Redux state (`threedEditorSlice.meshingMode`):

```js
meshingMode: {
  active: false,
  tool: "SELECT",          // "SELECT" | "CREATE" | "NUMBER"
  numberingNext: 1,        // « Numéroter »: number given to the next clicked maille
  surfaceBuffer: "",       // « Ajouter une maille »: typed target surface (m²)
  surfaceInputArmed: false,
}
```

Meshing mode is mutually exclusive with drawing / move / dimension modes.
The Maillage module forces the mode on
([`MainThreedEditor.jsx`](../../src/Features/threedEditor/components/MainThreedEditor.jsx),
which also mounts `<ThreedMeshes />` and `<MeshingOverlayThreed />`).

---

## Pointer handling while meshing

[`useMeshingPointerHandlers.js`](../../src/Features/threedMesh/hooks/useMeshingPointerHandlers.js)
owns the pointer while `meshingMode.active` (MainThreedEditor's own
hover/click paths short-circuit):

- Hover work is coalesced through `requestAnimationFrame` (`runHover`).
- A click is only a click if the pointer moved ≤ `DRAG_THRESHOLD_PX = 4` px
  between down and up — otherwise it's an orbit drag.
- `pickScene(e)` raycasts **an explicit target list** (`obj.isMesh &&
!obj.isLine2 && !obj.isLineSegments2`), _not_ the whole scene recursively:
  fat lines extend `Mesh` but their raycast throws on an empty/stale
  `LineGeometry`, which would break every meshing pick. Hits are then
  filtered by `filterIntersectionsByClipping` (active clipping plane) and
  `filterIntersectionsByVisibility`. The first hit resolves to
  `{kind: "MESH3D", mesh3dId, faceIndex}` or `{kind: "ANNOTATION", nodeId}`
  by walking up `userData`.
- Keys: **Escape** returns from `CREATE` / `NUMBER` to `SELECT`; with the
  `CREATE` tool, **S** arms the typed target surface.
- `NUMBER` tool: a click on a maille writes `numberingNext` as its `number`
  (clearing the `label` override), then `numberingNext + 1`.

### SELECT tool — creating a maille

1. Hovering an annotation face shows the coplanar stipple (same
   `getCoplanarRegion` / `buildFaceHoverOverlay` as the selection-mode hover,
   from `threedEditor/js/utilsAnnotationsManager/faceHoverHighlight.js`) plus
   a "+ nouvelle maille" cursor chip.
2. Click → `handleSelectClick`:
   - `getCoplanarRegion(geometry, faceIndex)` collects the coplanar triangle
     region under the cursor;
   - [`buildFacesFromRegion.js`](../../src/Features/threedMesh/utils/buildFacesFromRegion.js)
     runs the pure boundary extraction
     ([`extractRegionBoundaryLoops.js`](../../src/Features/threedMesh/utils/extractRegionBoundaryLoops.js))
     on the region and converts the result to **world coordinates** via
     `mesh.matrixWorld` (normal via the normal matrix) →
     `[{contour, holes, normal}]`;
   - `createMesh3dService` persists the row (with the source annotation's
     color as `baseColor`).
3. Clicking an existing maille selects it (`shift+click` toggles,
   `nodeType: "MESH3D"` items in the selection slice); empty click deselects.

---

## Plane basis — what "vertical" and "horizontal" mean

The face math runs in a 2D orthonormal basis of the face plane, built by
[`computePlaneBasis.js`](../../src/Features/threedMesh/utils/computePlaneBasis.js):

- `v` = projection of **world up** (`{0,1,0}` — the 3D scene is Y-up) onto
  the plane → the in-plane "vertical".
- `u = v × n` (right-handed `(u, v, n)`).
- Near-horizontal faces (`|n · up| > 0.95`, floors/roofs) have no meaningful
  in-plane vertical → fallback `u` = projected world X, `v = n × u`
  (`isHorizontalFace: true`).

[`planeProjection.js`](../../src/Features/threedMesh/utils/planeProjection.js)
converts both ways: `projectPointTo2d` / `projectLoopTo2d` (world → plane
`(u, v)`, meters) and `liftPointTo3d` / `liftLoopTo3d` (plane → world).

---

## Merge & other edits

- **Fusionner** ([`mergeMeshes3dService.js`](../../src/Features/threedMesh/services/mergeMeshes3dService.js)):
  N selected mailles → one. Faces may lie on **different planes** (that's why
  `faces` is an array). The survivor is the maille with the **lowest
  number** (keeps id / number / label / color); the others are soft-deleted;
  `surface` = sum of all face areas.
- Rename / recolor: [`useUpdateMesh3d.js`](../../src/Features/threedMesh/hooks/useUpdateMesh3d.js)
  (batch color in `ToolbarEditMeshes3d`).
- Delete: [`useDeleteMeshes3d.js`](../../src/Features/threedMesh/hooks/useDeleteMeshes3d.js)
  — soft delete; numbers are never reused.
- There is **no move/transform gizmo** for mailles: they are static world
  snapshots edited only by merge / rename / number / recolor / delete.

---

## Rendering & picking

[`ThreedMeshes.jsx`](../../src/Features/threedMesh/components/ThreedMeshes.jsx)
(mounted once in MainThreedEditor) reads `db.meshes3d` via
[`useMeshes3d.js`](../../src/Features/threedMesh/hooks/useMeshes3d.js) and
rebuilds a `ThreedMeshes` group on any data / selection / label-options /
prefix change:

- Each face → a shell extruded **5 mm along its normal**
  (`MESH3D_EXTRUDE_M`, [`buildFaceGeometry.js`](../../src/Features/threedMesh/utils/buildFaceGeometry.js))
  so it never z-fights with the source annotation face.
- Each maille → a label sprite
  ([`createMesh3dLabelSprite.js`](../../src/Features/threedMesh/services/createMesh3dLabelSprite.js))
  anchored at the centroid of its **largest** face, lifted `LABEL_LIFT_M =
0.05` m along that face's normal. Content follows the panel's "Étiquette"
  options (`threedEditor.mesh3dLabels`: `visible` / `showNumber` /
  `showQties`); a **selected** maille always shows number + surface.
- Any annotation or maille selection dims the non-selected mailles (same
  mechanism as `ThreedSelectionDimmer`).
- `hideMeshes3d` (Panel Maillage toggle) skips rendering and clears the
  object store; `hideAnnotationsIn3d` hides annotations to leave only
  basemaps + mailles.

Picking is split across two stores published by every rebuild to
[`mesh3dObjectsStore.js`](../../src/Features/threedMesh/services/mesh3dObjectsStore.js):

| Store                                                                     | Used by                                                                             | Why it exists                                                                                                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `faceMeshes` (one `THREE.Mesh` per face, `userData.mesh3dId + faceIndex`) | `useMeshingPointerHandlers.pickScene` (hover, tools) and MainThreedEditor selection | regular mesh raycast                                                                                                                           |
| `sprites` (label sprites, `userData.mesh3dId`)                            | a dedicated sprite raycast in MainThreedEditor's click handler (~line 478)          | sprites are **not** meshes — the annotation raycast filters `.isMesh` and would never see them, so clicking a label wouldn't select the maille |

---

## Quantities & export

- `surface` (m²) is cached on the row and recomputed on any face change
  (`computeMesh3dSurface` = Σ [`computeFaceArea`](../../src/Features/threedMesh/utils/computeFaceArea.js),
  shoelace in the face's plane basis, holes subtracted). Formatting:
  [`formatSurfaceM2.js`](../../src/Features/threedMesh/utils/formatSurfaceM2.js).
- The left drawer (`SectionMeshes3dExport`) exposes the recap as an Excel download —
  sheet **"Maillage"** (`Maille`, `Surface (m²)`, `Nb faces`, `Couleur`) built
  by [`createSheetMeshes3d.js`](../../src/Features/excel/utils/createSheetMeshes3d.js).
- Mailles do **not** participate in annotation quantity aggregation — they
  are not annotations at all (unlike the 2D mesh cells, which are annotations
  excluded from aggregation via their `isMeshCell` flag).

---

## Common pitfalls / bug signatures

| Symptom                                                                 | Cause                                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Maille geometry lands far from the model / at the origin                | `faces` written in local/basemap coordinates — they must be **world** coords (use `buildFacesFromRegion`, which applies `matrixWorld`) |
| Maille doesn't follow its annotation after a move                       | Expected: `faces` is a snapshot, `sourceInfo.annotationId` is informational only                                                       |
| Mailles missing from annotation lists / quantities / `useAnnotationsV2` | Expected: mailles live in `meshes3d`, not `annotations`                                                                                |
| Numbers have gaps after deletions                                       | Expected: numbering counts soft-deleted rows and is never compacted                                                                    |
| Clicking a maille label does nothing                                    | The sprite raycast path (via `getMesh3dSprites()`) was bypassed — sprites are invisible to the `.isMesh` annotation raycast            |
| Raycast throws `Cannot read properties of undefined` during meshing     | A `Line2`/`LineSegments2` leaked into the raycast targets — `pickScene` must keep excluding fat lines                                  |

---

## Quick reference — what to call from where

| Task                                       | Call                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Read the scope's mailles (live)            | `useMeshes3d({ projectId, scopeId })`                                                |
| Create a maille from faces                 | `createMesh3dService({ projectId, scopeId, faces, baseColor, sourceInfo })`          |
| Convert a hovered coplanar region to faces | `getCoplanarRegion(geometry, faceIndex)` → `buildFacesFromRegion(mesh, region.tris)` |
| Create every maille from the cut lines     | `createMeshesFromCutLinesService({ editor, projectId, scopeId, angleDeg })`          |
| Merge mailles                              | `mergeMeshes3dService([ids])` (lowest number survives)                               |
| Update / delete                            | `useUpdateMesh3d()` / `useDeleteMeshes3d()`                                          |
| Face plane 2D basis                        | `computePlaneBasis(normal, origin)` + `projectLoopTo2d` / `liftLoopTo3d`             |
| Face / maille area                         | `computeFaceArea(face)` / `computeMesh3dSurface(faces)`                              |
| Display label & prefix                     | `getMesh3dDisplayLabel(mesh3d, prefix)` + `useMesh3dLabelPrefix()`                   |
| Currently rendered 3D objects (picking)    | `getMesh3dFaceMeshes()` / `getMesh3dSprites()` from `mesh3dObjectsStore`             |
| Overlay chips (areas, cursor)              | `setMeshingOverlay(...)` / `clearMeshingOverlay()` from `meshingOverlayStore`        |
