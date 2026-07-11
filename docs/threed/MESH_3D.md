# 3D mesh cells ("maillage" / mailles)

How the 3D-native mesh feature works: creating mailles from annotation faces
in the 3D viewer, cutting them with vertical / horizontal / free lines, and —
in detail — how the **snapping** of the cut tools works.

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
- All cut-tool **snapping is evaluated in screen space** with a fixed
  **10 px radius** (`MESH3D_SNAP_PX`), regardless of zoom level.
- Every cut computation happens in the **2D `(u, v)` basis of the face
  plane** (`computePlaneBasis` + `planeProjection`), then results are lifted
  back to world space.

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
| `surface`              | cached total area (m²) = sum of face areas ([`computeMesh3dSurface`](../../src/Features/threedMesh/utils/computeFaceArea.js))                       | recomputed on every split / merge / face change                                                                                                                                       |
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

| Component                                                                                                                                                                                 | Role                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ButtonMeshThreed.jsx`](../../src/Features/threedMesh/components/ButtonMeshThreed.jsx)                                                                                                   | "Mailler" button in the 3D bottom toolbar → `setMeshingModeActive(true)`                                                                                                                          |
| [`MeshingToolbarThreed.jsx`](../../src/Features/threedMesh/components/MeshingToolbarThreed.jsx)                                                                                           | Replaces the bottom toolbar while meshing is active. Tools: `SELECT`, `CUT_VERTICAL`, `CUT_HORIZONTAL`, `CUT_FREE` + a **"Décalage"** field (meters, feeds the guide-vertex snap target)          |
| [`MeshingOverlayThreed.jsx`](../../src/Features/threedMesh/components/MeshingOverlayThreed.jsx)                                                                                           | HTML overlay: area chips on the would-be pieces, offset chip, "+ nouvelle maille" cursor helper. Fed by [`meshingOverlayStore.js`](../../src/Features/threedMesh/services/meshingOverlayStore.js) |
| [`ThreedMeshes.jsx`](../../src/Features/threedMesh/components/ThreedMeshes.jsx)                                                                                                           | Renders all persisted mailles into the scene (see Rendering)                                                                                                                                      |
| [`PanelMesh3d.jsx`](../../src/Features/threedMesh/components/PanelMesh3d.jsx)                                                                                                             | Right-panel "Maillage": `hideMeshes3d` / `hideAnnotationsIn3d` toggles, label options (`mesh3dLabels`), numbering prefix, datagrid + Excel export                                                 |
| [`ToolbarEditMesh3d.jsx`](../../src/Features/threedMesh/components/ToolbarEditMesh3d.jsx) / [`ToolbarEditMeshes3d.jsx`](../../src/Features/threedMesh/components/ToolbarEditMeshes3d.jsx) | Edit popper for 1 / ≥2 selected mailles (rename, color, batch color, **Fusionner**, delete)                                                                                                       |

Redux state (`threedEditorSlice.meshingMode`):

```js
meshingMode: {
  active: false,
  tool: "SELECT",     // "SELECT" | "CUT_VERTICAL" | "CUT_HORIZONTAL" | "CUT_FREE"
  offset: 2,          // "Décalage" (m): reference vertex → guide vertex distance
  cutSide: "LEFT",    // side of the reference vertex, flipped with the S key
}
```

Meshing mode is mutually exclusive with drawing / move / dimension modes.
Mounted in
[`MainThreedEditor.jsx`](../../src/Features/threedEditor/components/MainThreedEditor.jsx)
(toolbar swap ~line 1572, `<ThreedMeshes />` + `<MeshingOverlayThreed />`
~lines 1581–1582).

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
- Keys: **Escape** exits the mode (SELECT) or cancels the pending cut
  (`cutController.onEscape`); **S** flips `cutSide` and redraws the hover on
  the next frame.

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

All cut math runs in a 2D orthonormal basis of the face plane, built by
[`computePlaneBasis.js`](../../src/Features/threedMesh/utils/computePlaneBasis.js):

- `v` = projection of **world up** (`{0,1,0}` — the 3D scene is Y-up) onto
  the plane → the in-plane "vertical". `CUT_VERTICAL` draws a line of
  constant `u` running along `v`.
- `u = v × n` (right-handed `(u, v, n)`).
- Near-horizontal faces (`|n · up| > 0.95`, floors/roofs) have no meaningful
  in-plane vertical → fallback `u` = projected world X, `v = n × u`
  (`isHorizontalFace: true`).

[`planeProjection.js`](../../src/Features/threedMesh/utils/planeProjection.js)
converts both ways: `projectPointTo2d` / `projectLoopTo2d` (world → plane
`(u, v)`, meters) and `liftPointTo3d` / `liftLoopTo3d` (plane → world).

---

## Cut tools & snapping

All of this lives in
[`meshingCutController.js`](../../src/Features/threedMesh/services/meshingCutController.js).
One controller instance lives per meshing-mode activation; it owns a draft
`Group` in the scene (red `Line2` cut line + marker sprites) and the DOM
chips, and commits splits through `splitMesh3dService`.

### Snapping fundamentals

- Snap radius: **`MESH3D_SNAP_PX = 10` px, in screen space**. Candidate
  points are lifted to 3D (`liftPointTo3d`), projected to the screen with
  the camera (`worldToScreen`), and compared with `Math.hypot`
  (`screenDist`). This makes snapping zoom-independent: zoomed out, snapping
  is "wider" in meters; zoomed in, it is finer.
- Visual snap markers are `Sprite`s with a constant on-screen size
  (`sizeAttenuation: false`, `RING_SCREEN_SIZE = 0.028`), red, drawn on top
  (`depthTest: false`, high `renderOrder`) and excluded from picking
  (`sprite.raycast = () => {}`):
  - **RING** = reference vertex / guide vertex / free-cut edge point,
  - **SQUARE** = mid-edge snap point.
- When the cut is snapped, the red draft line thickens
  (`LINEWIDTH = 2.5` → `LINEWIDTH_SNAPPED = 4.5`).
- Draft geometry is lifted `DRAFT_LIFT_M = 0.012` m off the face plane along
  the normal so it never z-fights with the 5 mm maille shell.

### Axis cuts (`CUT_VERTICAL` = axis `"x"` / `CUT_HORIZONTAL` = axis `"y"`)

On every hover over a maille face (`onHoverAxisCut`), in the face's `(u, v)`
plane coordinates (`other` = the non-cut axis):

1. **Hit point** — the raycast hit is projected into the plane: `hit2d`.
2. **Reference vertex** (ring) — the contour corner the cut is measured
   from:
   - keep only the contour vertices on the _near side_ of the mouse along
     `other` (above/below the mid-value for a vertical cut, left/right for a
     horizontal one), so the reference follows the half of the shape you are
     working in;
   - among those, take the extreme along `axis`: the min side when
     `cutSide === "LEFT"` (default), the max side after pressing **S**
     (`toggleMeshingCutSide`).
3. **Guide vertex** (ring) — only when `Décalage > 0`: the reference vertex
   shifted by `offset` meters along `axis` **toward the polygon**
   (`ref[axis] + dir * offset`, `dir = +1` for LEFT, `−1` for RIGHT). This is
   the "cut at exactly N meters from the edge" helper; the distance is shown
   in a chip halfway between the two rings (`offsetChip`, e.g. `2m`).
4. **Mid-edge snap point** (square) — the midpoint of the contour edge
   nearest the mouse (2D point-to-segment distance) **that runs along the
   cut axis** (edges with `|Δaxis| ≤ |Δother|` are skipped): snapping there
   halves that edge.
5. **Snap resolution** — the cut position starts at `cutPos = hit2d[axis]`;
   for each snap target (`guide[axis]`, `edgeMid[axis]`) the on-screen
   distance between the hit and the would-be snapped hit is computed, and
   the **closest target within 10 px wins**:

   ```js
   let bestSnapDist = MESH3D_SNAP_PX;
   for (const target of snapTargets) {
     const pCut = liftPointTo3d(hit2d, ctx.basis);
     const pTarget = liftPointTo3d({ ...hit2d, [axis]: target }, ctx.basis);
     const dist = screenDist(pCut, pTarget, rect);
     if (dist < bestSnapDist) {
       bestSnapDist = dist;
       cutPos = target;
       snapped = true;
     }
   }
   ```

6. **Clipping** — the infinite line `axis = cutPos` is intersected with every
   contour edge; the draft segment spans the min/max intersection along
   `other`. Fewer than 2 intersections → no valid cut, hover resets.
7. **Preview** — `splitFacePolygon` computes the would-be pieces; an area
   chip (`formatSurfaceM2`) is placed at each piece's centroid
   (`polygonCentroid2d`, projected to screen).
8. **Click** (`onClickAxisCut`) commits the last valid hover through
   `splitMesh3dService`.

### Free cut (`CUT_FREE`) — two clicks, edge-to-edge

The free cut requires **both endpoints snapped to maille contour edges**:

1. On hover, `findEdgeSnap(e, rect)` scans **every face of every maille of
   the scope** in screen space: each contour edge is projected to the screen,
   the cursor is projected onto the segment (clamped `t`), and the nearest
   edge point within `MESH3D_SNAP_PX` wins. The world point is interpolated
   at the same `t` on the 3D edge. It also returns `candidates`: every
   `(mesh3dId, faceIndex)` having an edge within the radius — at a shared
   edge or corner between two mailles, the snap alone cannot tell which
   maille the user wants to cut.
2. **First click** — only registers if snapped: stores
   `firstPoint = { world, candidates }`.
3. While moving toward the second point, the draft segment goes from
   `firstPoint.world` to the current snap (or, unsnapped, to the cursor
   projected on the first candidate's plane — pure visual feedback, not
   committable). If snapped, `findCrossedCandidate` resolves the ambiguity:
   among the _first click's_ candidates, the cut maille is the one whose
   face polygon **strictly contains the segment midpoint** (projected in
   that face's basis, holes excluded). Area chips preview the pieces of that
   candidate.
4. **Second click** — commits `splitMesh3dService(..., clampToSegment:
true)`: only the `[a, b]` segment cuts (extended by a hair — `diag ×
1e-6` — so endpoints sitting exactly on edges still cut through), instead
   of the full infinite line used by the axis tools.

**Escape** clears `firstPoint` and the draft at any time.

### The split itself

[`splitMesh3dService.js`](../../src/Features/threedMesh/services/splitMesh3dService.js)
→ [`splitFacePolygon.js`](../../src/Features/threedMesh/utils/splitFacePolygon.js):

- Works on the face's 2D loops (meters, plane basis). Uses
  **`polygon-clipping`**: builds a half-plane band on one side of the
  (extended) cut segment, then `intersection` + `difference` of the
  polygon-with-holes against it.
- **Holes survive** the cut, and a concave polygon can yield **more than two
  pieces** (one side can be disconnected).
- Slivers born from numerical noise are dropped (`area ≤ diag² × 1e-9`).
- Pieces come back **sorted by area desc**. The **largest piece keeps the
  original maille's identity** (id, number, label, color, and its other faces
  when multi-face); every other piece becomes a **new maille** (fresh number,
  no custom label, re-shaded from the parent's `baseColor` with its own
  number so the two sides of a cut never look identical). All inside one
  Dexie transaction.

This is deliberately _not_
`geometry/utils/splitPolygonByPolyline` (annotation-oriented: point-id
reconciliation, `[0..1]` coords, exterior ring only).

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
  snapshots edited only by cut / merge / rename / recolor / delete.

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

| Store                                                                     | Used by                                                                                 | Why it exists                                                                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `faceMeshes` (one `THREE.Mesh` per face, `userData.mesh3dId + faceIndex`) | `useMeshingPointerHandlers.pickScene` (hover, cut tools) and MainThreedEditor selection | regular mesh raycast                                                                                                                           |
| `sprites` (label sprites, `userData.mesh3dId`)                            | a dedicated sprite raycast in MainThreedEditor's click handler (~line 478)              | sprites are **not** meshes — the annotation raycast filters `.isMesh` and would never see them, so clicking a label wouldn't select the maille |

---

## Quantities & export

- `surface` (m²) is cached on the row and recomputed on any face change
  (`computeMesh3dSurface` = Σ [`computeFaceArea`](../../src/Features/threedMesh/utils/computeFaceArea.js),
  shoelace in the face's plane basis, holes subtracted). Formatting:
  [`formatSurfaceM2.js`](../../src/Features/threedMesh/utils/formatSurfaceM2.js).
- `PanelMesh3d` exposes the recap as a datagrid dialog and an Excel download —
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
| Cut line z-fights / flickers on the face                                | Draft not lifted by `DRAFT_LIFT_M`, or shell extrusion (`MESH3D_EXTRUDE_M`) changed                                                    |
| Snapping feels too strong/weak at some zoom                             | Expected: the 10 px radius is **screen-space**; the meter equivalent varies with camera distance                                       |
| Free cut won't start                                                    | The first click must be snapped (ring visible) — `onClickFreeCut` returns early when `freeSnap` is null                                |
| Free cut refuses to commit across two touching mailles                  | `findCrossedCandidate` needs the segment **midpoint strictly inside** one candidate's polygon (holes excluded)                         |
| Split produces an unexpected extra maille                               | Expected on concave faces: one side of the cut can be disconnected → >2 pieces, each non-largest piece becomes a new maille            |

---

## Quick reference — what to call from where

| Task                                       | Call                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| Read the scope's mailles (live)            | `useMeshes3d({ projectId, scopeId })`                                                |
| Create a maille from faces                 | `createMesh3dService({ projectId, scopeId, faces, baseColor, sourceInfo })`          |
| Convert a hovered coplanar region to faces | `getCoplanarRegion(geometry, faceIndex)` → `buildFacesFromRegion(mesh, region.tris)` |
| Split a face along a 2D line               | `splitMesh3dService({ mesh3d, faceIndex, a, b, clampToSegment? })`                   |
| Merge mailles                              | `mergeMeshes3dService([ids])` (lowest number survives)                               |
| Update / delete                            | `useUpdateMesh3d()` / `useDeleteMeshes3d()`                                          |
| Face plane 2D basis                        | `computePlaneBasis(normal, origin)` + `projectLoopTo2d` / `liftLoopTo3d`             |
| Face / maille area                         | `computeFaceArea(face)` / `computeMesh3dSurface(faces)`                              |
| Display label & prefix                     | `getMesh3dDisplayLabel(mesh3d, prefix)` + `useMesh3dLabelPrefix()`                   |
| Currently rendered 3D objects (picking)    | `getMesh3dFaceMeshes()` / `getMesh3dSprites()` from `mesh3dObjectsStore`             |
| Overlay chips (areas, offset, cursor)      | `setMeshingOverlay(...)` / `clearMeshingOverlay()` from `meshingOverlayStore`        |
