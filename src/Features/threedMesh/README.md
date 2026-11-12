# threedMesh — mailles of the Maillage module (MESHES)

Mailles are 3D-only records (`db.meshes3d`: planar `faces` or a curved
`shell`), created and cut in the 3D editor while the meshing mode is on
(`threedEditor.meshingMode`, `useMeshingPointerHandlers`). The cut lines that
prepare them are documented in `Features/threedCutLines/README.md`.

## Module UI

- Tools: commands of the commands toolbar (MESHES layout,
  `commandsToolbar/constants/toolbarLayout.js`) — « Ajouter une maille »
  (`ADD_MESH`), « Mailler » (`CREATE_MESHES`: every maille at once from the
  cut lines, `createMeshesFromCutLinesService`) and « Numéroter »
  (`NUMBER_MESHES`). There is no bottom meshing toolbar; mailles are not cut
  directly any more — the cells are prepared with cut lines.
- Left drawer (`PanelMeshesViewer`): the mailles list + export, no tabs.
- Module properties panel (`PanelPropertiesMeshesModule`, empty selection —
  `selection/utils/getModuleRootPanelType` → `MESHES_MODULE`): description
  and the settings cards (`SectionMeshes3dSettings`).

## « Numéroter » (command `NUMBER_MESHES`, tool `NUMBER`)

Arms the `NUMBER` tool: a click on a maille gives it
`meshingMode.numberingNext` (and clears its label override), then +1. The
drawing helper (`SectionMeshNumberHelperContent`) carries the « Démarrage »
field bound to `numberingNext`. `Escape`, or a second click on the command,
returns to SELECT.

## « Ajouter une maille » (command `ADD_MESH`, tool `CREATE`)

The command of the commands toolbar (`commandsToolbar/commands/addMesh`,
MESHES layout) arms the `CREATE` tool. The drawing helper shows in the
popper chain (`selectActiveMeshHelperTool` → `PopperDrawingHelper` →
`SectionMeshCreateHelperContent`).

- No target surface: a click creates the hovered piece (the region grown
  over the annotation, cut by the cut lines — see the cut lines README).
- Target surface: `S` arms the input, the digits feed
  `meshingMode.surfaceBuffer` (also editable in the helper), `Enter`
  validates, `Escape` drops the surface (then returns to SELECT). The hover
  then pre-draws, in fluo green, the maille the click creates; the surface
  stays set after a click (the user tiles).

### Pre-drawn maille (user decisions 2026-11-04)

A rectangle of the target **net** surface, aligned on the user axes of the
« Repère » (`computeUserAxesFrame`: a wall → the frame's horizontal + the
true vertical, a floor → the frame's X / Y), lying on the hovered group of
pieces:

- **Borders**: the face edges and the cut lines (the contour of the pieces)
  and the existing mailles of the scope (coplanar faces / shell triangles).
- **Openings** (the holes of the pieces — polygon `cuts`) are NOT borders:
  the rectangle spans them, they become holes of the maille and the target
  is the surface net of them.
- **Placement**: the free cell around the cursor is the box of the two
  chords through it, shrunk out of the notches (`shrinkCellToHost`); the
  rectangle leans on the corner of the cell nearest to the cursor. A square
  while it fits; a cell too narrow / low turns it into a band over the whole
  width / height; a cell smaller than the target is filled (orange preview,
  « surface insuffisante » chip — the click still creates it).
- **Snap**: a free edge within `MESH3D_SNAP_PX` of a vertex of the free
  region or of an opening moves onto it, the other side solved again.
- **Curved / faceted sheets**: the group is unfolded across its creases
  (`unfoldPiecesAcrossCreases`, from the `joins` of `clipRegionByCutLines`)
  into one 2D atlas; the rectangle is placed there and lifted back piece by
  piece. One plane → `{ faces }`, several → `{ shell }`.

### Pipeline (pure utils, `threedMesh/utils/`, node-tested)

```
clipRegionByCutLines → pieces + joins + groups (hover.regionClip)
prepareFixedAreaAtlas   (cached: region clip, group, mailles, frame yaw)
  computeUserAxesFrame → unfoldPiecesAcrossCreases → computeFreePieces
buildFixedAreaMaille    (every move)
  placeFixedAreaRect → liftFixedAreaRect → { faces } | { shell }
```

`polygonBoolean2d` wraps `polygon-clipping` (welded points, null on
failure), `polygonChord2d` gives the chord of a polygon through a point.

## Tests

`node --test src/Features/threedMesh/utils/*.test.mjs`

## Known limits

- Non-developable sheets (doubly curved): the unfolding follows a tree of
  creases, the others are not glued back (small gaps / overlaps); the
  surface of the created shell may then differ slightly from the target.
- The atlas keeps the frame of the piece first hovered in a group.
- Unfolding stops after 1500 pieces (re-rooted on the hovered piece).

## Label card and leader target

- `mesh3d.labelOffset {u, v, n}` — card position, meters in the label anchor
  basis (`getMesh3dLabelAnchor`): `u` / `v` in the maille plane, `n` (optional)
  along its normal — set by a Shift axis-locked drag along an out-of-plane
  axis.
- `mesh3d.labelTargetPoint {x, y, z}` — pointed end of the leader: a world
  point ON the maille surface. The target drag (`useMesh3dLabelDragHandlers`)
  raycasts the maille's own faces and snaps to the closest point of the stored
  geometry (`getMesh3dSurfacePoint`), so the target follows curved shells and
  slides along the border when the cursor leaves the maille.
- `mesh3d.labelTargetOffset {u, v}` — legacy in-plane target, read only.
  `getMesh3dLabelTargetPosition` snaps it (and any stale `labelTargetPoint`)
  back onto the surface at render time.
- Annotation labels follow the same rule in 3D
  (`threedAnnotationLabels/utils/pickAnnotationOwnFace`): the target stays on
  the faces of its annotation, its height is stored in
  `annotation.labelTargetZ3d` (basemap-local meters, cleared by a 2D target
  drag).
