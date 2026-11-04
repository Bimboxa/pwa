# threedCutLines — « Ligne de coupe » (CUT_LINE)

Cut lines prepare the mailles of the Maillage module (MESHES): polylines
drawn in the 3D editor on the faces of the annotations, whose two end
segments are extended along the faces of the scene at commit. The Maillage
CREATE tool then highlights and creates the piece of a face delimited by the
lines, and « Créer le maillage » creates one maille per piece of every face
the lines cross.

## Model

A regular annotation (`db.annotations` + `db.points`), template-less:

```js
{
  type: "CUT_LINE", isTemplateless: true, scopeId, listingId: null,
  baseMapId, isDrawnIn3d: true, height: 0,
  offsetZ,                                   // lowest vertex (m)
  strokeColor,                               // theme.palette.secondary.fluo
  points: [{ id, offsetBottom, derived?: true, stop?: true }, …],
}
```

- Vertices are projected on the host base map (`worldToBaseMapNormalized`,
  `encodeCutLineRefs`: `z = offsetZ + offsetBottom`). **One `db.points` row
  per vertex, never shared** — `pointId` identifies a vertex (sub-selection,
  « Stop », drag). The commit mints its own rows (not `insertOrReusePoints`).
- `derived`: point added by the extension (dashed segments while selected).
  `stop`: the line ends there (`getCutLineVisiblePoints`: a stop in the
  extended head truncates the start, any other truncates the end).
- Not in 2D (no `NodeAnnotationStatic` case), no quantities, not exported to
  DXF, never a duplicate candidate.

## Drawing

- Command `DRAW_CUT_LINE` (`commandsToolbar/commands/drawCutLine`, MESHES
  layout of the toolbar, 3D only, enabled in the Maillage module) arms a
  template-less CUT_LINE draft on the click polyline flow
  (`CUT_LINE_CLICK` → `POLYLINE_CLICK`, `selectIsCutLineDrawActive` in the
  draw bridge). Enter / Escape / double click end the line; it never closes
  on its first point; the tool stays armed after a commit.
- `commitDrawnCutLineService`: `collectSceneTriangles` (visible annotation
  solids, world soup with winding normals) → `extendCutLine` → projection →
  points → annotation. The face under each end vertex is the `faceNormal`
  the snap carried (face / vertex / edge snaps with a face under the cursor).
- Existing cut lines are snap targets of every 3D drawing (vertices, derived
  ones included, and segments): each segment `Line2` carries `isSnapLine` +
  `exportLine.positions` (the `buildView3dEdgeLines` convention read by
  `useVertexSnap.buildIndex`); `ThreedCutLineAnnotations` bumps
  `snapIndexEpoch` when the lines' geometry signature changes (not on a
  selection change).
- Extension (`utils/`, pure, node-tested): plane of the polyline (Newell,
  ≥ 3 non-collinear points) or per end `d × n_face`; `sectionTrianglesByPlane`
  → `buildSectionGraph` (1 mm keys, T-junctions split) → `walkCutLineTrace`
  (re-entrant turns > flat > salient, then progress along the drawn
  direction; stops at a free edge, a visited node, 64 SIMPLIFIED points —
  4096 raw, the section of a curved sheet goes through ~2 raw nodes per
  quad; collinear nodes simplified). User decision 2026-11-03: the trace
  continues through salient edges too (over a wall, down its back).
- End arriving INTO a face (a sweep / open sheet met edge-on at its foot,
  |d · n_face| > cos 15°): the cutting plane is the vertical one through the
  segment (`d × up`, `upNormal` = host base map normal, `getBaseMapNormalWorldFromRow`),
  the walk starts on the plan (`endOn`); with no section edge along `d`
  (the plan is not in the soup) the start is the section node at the end
  point (`locateNodeNear`) and the first step may be perpendicular
  (`allowPerpendicularStart`). The trace then climbs the sheet's profile.
- Gap bridging (`CUT_LINE_GAP_TOLERANCE_M` = 2 cm, user decision 2026-11-04):
  the surfaces the line crosses are drawn independently (a slab whose arc
  edge follows a sweep's guide stops a few mm / cm short of the sheet's
  foot), so their sections never join at the 1 mm graph tolerance. At a free
  edge the walk jumps to the nearest unvisited section node within 2 cm and
  goes on (`gapTolerance`); the start fallback uses the same distance.
- Axis tools (`CutLineToolbarThreed`: Libre | X | Y | Z, « Décalage »,
  `threedEditor.cutLineDraw`): `CutLineAxisOverlayThreed` hovers the planar
  face region under the cursor and publishes to `cutLineAxisStore` the chord
  parallel to the user axis (`computeCutLineAxisChord` = `computeFaceAxisCut`
  in the frame `{u: axis in the face, v: n × u}` — a rotated gizmo frame
  rotates the trace). Digits type the distance from the reference corner, S
  flips the corner, the guide at « Décalage » snaps, click / Enter commits
  the chord as a 2-point line (then extended like a free one). Escape drops
  the typed distance, then releases the axis. `DrawingOverlayThreed` is
  inert while an axis is armed.

## Rendering, selection, vertices

- `ThreedCutLineAnnotations` (sibling of `ThreedRulerAnnotations`): one
  Group per line under its base map group (ANNOTATION userData,
  `lassoPoints`, published to the dimension groups store for the lasso).
  Unselected: continuous fluo line, the part beyond a stop not drawn.
  Selected: thicker, derived segments dashed, vertex markers (ends bigger,
  sub-selected vertex in the selection colour); the part beyond a « Stop »
  is never drawn nor grabbable.
  Segments carry the fat-line raycast and are published to
  `cutLineObjectsStore` with the world vertices and the visible world
  polylines (`version` bumps on every publish).
- Click: `pickCutLine` / `handleCutLineClick` pre-pass next to the dimension
  cards in `MainThreedEditor.handleClick` and in the Maillage SELECT tool
  (`useMeshingPointerHandlers`) — fat lines are invisible to the `.isMesh`
  picks.
- `useCutLineVertexHandlers` (mounted by MainThreedEditor): on the selected
  line, hand cursor over a vertex; click = sub-selection
  (`setSelectedPointIds` + `setSubSelection VERTEX` → `ToolbarEditAnnotation`
  shows `ToolbarEditCutLinePoint`: « Stop », « Point prolongé », « Supprimer
  le point »); drag = move, always on a face (free: scene vertex → face
  under the cursor → plane of a face the vertex sits on → base map plane;
  Shift: `computeAxisLockSnap` on the user axes lying in those planes + the
  connected segment directions, dashed guide). The drag is imperative (Line2 /
  marker buffers updated in place, no React state); on drop the line is
  REBUILT (`rebuildCutLineService`): the dropped vertex becomes a drawn
  point on a fresh row, the extension is run again on the scene from the
  drawn points, derived points are replaced (a Stop on a derived point
  survives when the new trace passes within 1 cm), the line re-encoded; one
  undo step; pending patch via `dimensionPendingPatchStore`.
- `ToolbarEditCutLine` (no sub-selection): points count and « Recalculer le
  prolongement » (`reextendCutLineService`: the same rebuild from the drawn
  points, without a move).

## Popper « Annotations »

`RowCutLineAnnotations` (PopperMapListings, pinned at the top of the body,
2D and 3D): the CUT_LINE rows of the popper's set, a light grey 🐛 button
copying `{ imageSize, meterByPx, annotations }` (resolved px points,
`derived` / `stop` / offsets — the multi-selection toolbar's payload) to the
clipboard, and the count pill toggling their visibility through the
sentinel `CUT_LINES_TEMPLATE_ID` (`getAnnotationTemplateKey` returns it for a
CUT_LINE, so the « Annotations sans modèle » eye no longer covers them).

## Maillage

- Face region: `getAnnotationFaceRegion` (threedMesh/utils) grows the
  region over the WHOLE annotation — its solid meshes merged into one
  geometry in the root's frame (an isMesh3d annotation is one Mesh per
  face, a POLYLINE wall one per segment) — with `getFaceRegion` and the
  « Sélection de face » angle (dihedral between neighbors, 25° default): a
  curved sheet is one region, like the Pinceau's host index. CSG-carved
  meshes (`hasSubtraction`) stay on the per-mesh plane mode.
- Region clip: `clipRegionByCutLines` (pure) splits the region into its
  planar facets (`partitionTrisByDihedralAngle`, 0.1°), clips every facet
  face with `clipFaceByCutLines`, then joins the pieces back across the
  crease edges they share (boundary edges running along the same crease
  over > 5 mm) into GROUPS — unless a cut line runs along that crease. One
  facet's pieces never join. `locate(tri, point)` → the group under the
  cursor.
- CREATE on an annotation face: `applyCutLinePieceStipple` clips the region
  (cached per region + cut lines version) and stipples the group under the
  cursor (`buildPiecesStippleOverlay`, world, scene root); the tooltip shows
  the group's (or the whole region's) surface; the click creates the group
  (`buildMeshDataFromPieces` → one planar face when its pieces coalesce
  into one, else a shell whose crease T-junctions are welded first;
  `createMesh3dService`).
- « Créer le maillage » (`ButtonCreateMeshesFromCutLines`, meshing toolbar):
  `createMeshesFromCutLinesService` — every region of every visible
  annotation (merged host, or per mesh in plane mode), clipped by the
  lines; one maille per cut group; groups whose cut pieces all have their
  centroid in an existing maille (coplanar face or shell triangle) are
  skipped; regions no line crosses produce nothing.

## Tests

`node --test src/Features/threedCutLines/utils/*.test.mjs` (pure utils,
relative `.js` imports) and
`node --test src/Features/threedFaceCut/utils/computeFaceAxisCut.test.mjs`
(the `guideDistances` option).

## Known limits (V1)

- A region is clipped facet by facet: a cut line must cross a facet from
  boundary to boundary (or end on another line) to cut it; a line ending
  in the middle of a facet cuts nothing there.
- Paste / duplicate / layer copy of a cut line are not handled.
- Right click stays inert in the Maillage module (no shortcuts menu there).
- A closed solid walked around: the extension stops on the first visited
  node (one full loop at most).
