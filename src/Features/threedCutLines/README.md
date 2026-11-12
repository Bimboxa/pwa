# threedCutLines — « Ligne de coupe » (CUT_LINE)

Cut lines prepare the mailles of the Maillage module (MESHES): polylines
drawn in the 3D editor on the faces of the annotations, whose two end
segments are extended along the faces of the scene at commit. The Maillage
CREATE tool then highlights and creates the piece of a face delimited by the
lines, and « Mailler » creates one maille per piece of every face
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
  the snap carried (face / vertex / edge snaps with a face under the cursor);
  an end without one (a click on the plan at the foot of a wall) falls back
  to the scene face holding the point (`utils/findFacePlanesAt`, 5 mm, 1 mm
  past its edges) — among several (the corner wall / slab), the one the end
  segment lies on (`findFaceNormalAlong`) — as « Recalculer le prolongement »
  does.
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
- First step of the walk: never back along the drawn line; onwards when the
  section edge under the end goes on, else perpendicular (the line ends
  exactly on a corner of the section — drawn down a wall to its foot, it
  turns onto the slab leaving that foot; re-entrant side first).
- Gap bridging (`CUT_LINE_GAP_TOLERANCE_M` = 2 cm, user decision 2026-11-04):
  the surfaces the line crosses are drawn independently (a slab whose arc
  edge follows a sweep's guide stops a few mm / cm short of the sheet's
  foot), so their sections never join at the 1 mm graph tolerance. At a free
  edge the walk jumps to the nearest unvisited section node within 2 cm and
  goes on (`gapTolerance`); the start fallback uses the same distance.
- Hotkey « C » arms the command (Maillage module only; Escape disarms).
  While armed, the drawing helper (popper / docked panel) is titled
  « Dessiner une ligne de coupe » and shows
  `SectionCutLineDrawHelperContent` instead of the generic polyline body; no
  bottom toolbar.
- Axis tools (`SectionCutLineDrawHelperContent`: Libre | X | Y | Z,
  « Décalage », side toggle, `threedEditor.cutLineDraw`): `CutLineAxisOverlayThreed` hovers the planar
  face region under the cursor and publishes to `cutLineAxisStore` the chord
  parallel to the user axis (`computeCutLineAxisChord` = `computeFaceAxisCut`
  in the frame `{u: axis in the face, v: ± n × u}` — a rotated gizmo frame
  rotates the trace). X / Y / Z arm the axis from the keyboard (free mode
  included, the same letter again releases it). The reference is the edge of
  the face (S flips `side`, i.e. `v`: the opposite edge) or the existing cut
  line of the face parallel to the axis nearest behind the cursor
  (`cutLineObjectsStore.getCutLinesWorldPolylines` → `refCoords` of
  `computeFaceAxisCut`), so lines chain at a constant step. Digits type the
  distance from that reference (shown in the « Décalage » field while typed,
  kept as the new « Décalage » once the line is committed), the guide at
  « Décalage » from every reference snaps, click / Enter commits
  the chord as a 2-point line (then extended like a free one; the committed
  points lie ON the face, only the dashed draft is lifted 2 mm). Escape drops
  the typed distance, then releases the axis. `DrawingOverlayThreed` is
  inert while an axis is armed.

## « Plan de coupe » (DRAW_CUT_PLANE)

Second command of the toolbar's « Lignes de coupe » section: creates, in one
go, the cut lines where one or several planes cross the visible annotations.

- Draft: the CUT_LINE draft flagged `cutPlane` (`isCutPlaneDraft` /
  `selectIsCutPlaneDrawActive`, tested BEFORE the cut line selectors by the
  helper and its title). It rides the same 3D drawing flow (snaps, rubber
  band, arrow-key axis lock); the X / Y / Z axis tools are off.
- Clicks (`useDrawingPointerHandlers.onCutPlaneClick`): the 1st places P1 (a
  drawing vertex), every next one sets P2. The planes are normal to P1 → P2.
- Typed buffer `threedEditor.cutPlaneDraw.buffer` (`utils/cutPlaneBuffer`):
  `<length>[*N | /N]`. The length holds |P1P2| (mirrored in
  `mapEditor.constraintBuffer` by `setCutPlaneBufferService`, so the drawing
  overlay constrains the provisional point). `*N` = N planes at
  P1 + i × (P2 − P1), repeated beyond P2; `/N` = N planes at
  P1 + i / N × (P2 − P1), P1 excluded (`utils/getCutPlaneStations`).
- Candidates (`computeCutPlaneCandidatesService` → `cutPlaneStore`):
  `collectSceneTriangles` → per plane `sectionTrianglesByPlane` →
  `buildSectionGraph` → `utils/chainSectionGraph` (a component whose nodes
  all have 2 neighbors is one CLOSED line, its last point repeating the
  first; any other is cut into open chains at its ends / junctions).
  « Contour le plus proche uniquement » (`cutPlaneDraw.nearestOnly`) keeps,
  per plane, the connected component closest to the plane's point on the
  axis — drawn from inside a cylinder, only that cylinder is cut.
- `CutPlaneOverlayThreed`: dots where the planes cross the provisional axis
  before the 2nd click; then the candidates blink in fluo green (own rAF
  loop, the scene renders on demand).
- Space / Enter: `createCutPlaneLinesService` — every candidate becomes a
  CUT_LINE whose points are all DRAWN (no extension), one transaction, one
  undo step. Escape: candidates → P1 → typed buffer → leaves the command.
- A closed line is never extended (`extendCutLine` returns it as is), so
  « Recalculer le prolongement », the drags and M / R keep it closed.
- Limits: the planes are unbounded (every visible annotation they cross is
  cut unless « contour le plus proche » is on); no 2 cm gap bridging between
  surfaces (each one gets its own line); no hotkey arms the command.

## « Ligne de coupe – prompt IA » (CUT_LINES_PROMPT_IA)

Command of the Maillage toolbar (`commandsToolbar/commands/cutLinesPromptIa`):
a dialog hands an external AI chat the geometry of the visible annotations
and gets cut lines back, for a target max surface of a maille (m², remembered
in `threedEditor.cutLinesPromptMaxArea`). The lines are meant to be set out
on site: the prompt asks for lines from existing corners, regular, simple.

- **Input** — every face region of the visible annotations, whatever their
  type (`js/collectVisibleFaceRegions`, the walk shared with « Mailler »),
  turned into planar faces or curved shells
  (`services/collectCutLinesPromptRegions`), plus the rendered cut lines.
  `utils/buildCutLinesPromptContext` names the vertices (`S1`…, welded at
  1 mm, shared between faces and existing lines) and the faces (`F1`…).
  Frame: the scene's (meters, Y up), never converted.
- **Two modes**, a technical choice the dialog never shows (GLB as soon as
  one visible region is curved, TEXT otherwise):
  - TEXT — planar faces only; one text (instructions
    `docs/threed/CUT_LINES_PROMPT.md` + the context JSON) to copy or
    download.
  - GLB — a zip: `INSTRUCTIONS.md` (`CUT_LINES_PROMPT_GLB.md`),
    `contexte.json` (same context + `curvedSurfaces`), `scene.glb`
    (`services/buildCutLinesPromptGlb`: one mesh per annotation, named
    `getCutLinesPromptMeshName`, baked in world coordinates, whitelist of
    `collectAnnotationSectionMeshes`).
- **Answer** (`utils/parseCutLinesPromptResult`) — `cutLines[].points[]`:
  `{ vertex }`, `{ edge: [from, to], distance }` (meters from `from`), or
  `[x, y, z]` (GLB mode only). Every `edge` point that is not a corner gets
  a cote from its reference vertex; `cotes[]` of the answer come on top (GLB
  mode, free points). An invalid line is dropped with a warning.
- **Dry run** (`services/computeCutLinesPromptPreview`) — existing +
  proposed lines clipped over the regions like « Mailler »: number of
  pieces, largest surface, pieces over the target, points off the scene.
- **Write** (`services/createCutLinesFromPromptService`) — template-less
  CUT_LINE rows (`utils/buildCutLineRows`, shared with « Plan de coupe »:
  drawn points, no extension) and template-less COTE rows
  (`threedDrawing/utils/projectCoteEndpoints`, own points), one
  transaction, one undo step.

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
- `useCutLineTranslateHandlers` (mounted next to it): on the selected line,
  hand cursor over a segment (the vertices keep the priority,
  `js/findCutLineVertexAtClient`); drag = translation of the WHOLE line,
  always locked on a direction keeping every drawn point on a face
  (`utils/getCutLineTranslateAxes`): the perpendicular of the grabbed segment
  in the plane of the face carrying it (`n × t`, one per face on a floor /
  wall edge), else the user axes doing so, else the user axes not along the
  segment; several candidates → the closest to the cursor on screen
  (`computeAxisLockSnap`), dashed guide (`js/buildCutLineLockLine`). A point
  on no solid face counts as lying on its base map plane (the plan is not in
  the soup). Preview = the line's group translated; Escape cancels; drop =
  the same rebuild with every drawn point translated on a fresh row (the
  derived part is recomputed), one undo step.
- « Déplacer » (M) / « Tourner » (R): the two commands of the toolbar's
  « Lignes de coupe » section carry a cut line with the 3D tools of
  `Features/threedAnnotationMove` (same flows as in the Dessin module: grab
  on a vertex of the line → drop on a snap / axis / typed distance; pivot →
  reference → angle, about the host base map's normal). One line at a time;
  nothing else is carriable in the Maillage module. The live pose moves the
  line's group (`threedAnnotationMove/utils/getCarriedAnnotationRoot` resolves
  it from `cutLineObjectsStore`, by id: the group is rebuilt on a selection
  change). Commit = `services/commitCutLineTransformService`: every vertex
  transformed in the base map group's local frame
  (`utils/transformCutLinePoints`, `js/getTransformedCutLineDrawn`), then the
  rebuild of the segment drag — drawn points on fresh rows as dropped (no
  re-projection on the faces), extension recomputed, pending patch before
  the write, one undo step; a refused drop (a point off the base map) puts
  the line back. « Copie multiple » (`*N`, C) =
  `services/createCutLineCopiesService`: N new CUT_LINE rows, copy i
  transformed i times and extended on its own, one undo step; the ghosts
  are rigid stand-ins of the visible run (`js/buildCutLineGhostObject`).
  « Recommencer à chaque clic » works with copies only (a plain move ends
  the carry). The vertex / segment drags stand down while either tool is
  armed, and the meshing mode is re-armed when it is left
  (`MainThreedEditor`).
- Hover (Maillage, SELECT tool): `useMeshingPointerHandlers.runHover` runs
  `pickVisibleCutLine` (a line hidden behind the first face under the cursor
  does not answer) → text tooltip « Ligne de coupe » (`CUT_LINE_LABEL`), not
  on the line selected alone. That hover rewrites the canvas cursor on every
  frame: `services/cutLineHoverStore` tells it to keep the hand over a
  grabbable vertex / segment and to stand down during the two gestures.
- `ToolbarEditCutLine` (no sub-selection): points count and « Recalculer le
  prolongement » (`reextendCutLineService`: the same rebuild from the drawn
  points, without a move).

## Holes (polygon `cuts`)

A line joining the contour to a hole (or two holes) cuts nothing on its own:
`splitFlatRegionAlongChunks` merges the loops along it and refuses the slit
left behind. `cutRegionByPaths` (clipFaceByCutLines) therefore draws, after
the single lines of each pass, the chunks of the lines that failed alone on a
piece TOGETHER: two bridges split the ring in two.

## Popper « Annotations »

`RowCutLineAnnotations` (PopperMapListings, pinned at the top of the body,
Maillage module only): the CUT_LINE rows of the popper's set, a light grey 🐛 button
copying `{ imageSize, meterByPx, annotations }` (resolved px points,
`derived` / `stop` / offsets — the multi-selection toolbar's payload) to the
clipboard, and the count pill toggling their visibility through the
sentinel `CUT_LINES_TEMPLATE_ID` (`getAnnotationTemplateKey` returns it for a
CUT_LINE, so the « Annotations sans modèle » eye no longer covers them).
Cut lines exist for the Maillage module only: `useAnnotationsV2` drops them
outside it (`viewers.selectedViewerKey !== "MESHES"`, opt-in
`includeCutLines`), so the Dessin module neither renders nor counts them;
the scope services (Krto zip, duplicate, purge) read Dexie and keep them.

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
  cursor; `joins` lists the pairs of pieces joined across a crease (what
  unfolds a group flat — « Ajouter une maille » with a target surface, see
  `Features/threedMesh/README.md`).
- CREATE on an annotation face: `applyCutLinePieceStipple` clips the region
  (cached per region + cut lines version) and stipples the group under the
  cursor (`buildPiecesStippleOverlay`, world, scene root); the tooltip shows
  the group's (or the whole region's) surface; the click creates the group
  (`buildMeshDataFromPieces` → one planar face when its pieces coalesce
  into one, else a shell whose crease T-junctions are welded first;
  `createMesh3dService`).
- « Mailler » (command `CREATE_MESHES`, `ButtonCreateMeshes`, commands
  toolbar):
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
