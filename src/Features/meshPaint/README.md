# meshPaint — « Pinceau » 3D (MESH_BRUSH)

Paint the facets and edges of annotation 3D objects with an annotation template, in the 3D editor of the Dessin module.

- A **Surface** template (POLYGON) paints **facets**. The quantity is in m², counted per painted side.
- A **Ligne** template (POLYLINE) paints **edges**. The quantity is in ml.
- A painted part takes the template colour in 3D, and its quantity is added to the template totals.

## User rules (V1)

**Hosts**

- Every annotation 3D object can be painted: extruded slabs, thick or thin walls, strips, ramps, isMesh3d meshes…
- Refused hosts:
  - mailles, base maps, scans;
  - OBJECT_3D, REVOLUTION / EXTRUSION_PROFILE (curved);
  - mesh cells, photo plans;
  - the armed template's own annotations.

**Facets and edges**

- A facet is the planar connected region under the cursor. An edge is a straight feature edge, with collinear pieces merged.

**One template per part**

- An edge, or one side of a facet, carries at most one template.
- Clicking again with the same template removes the paint; clicking with another template replaces it.
- The two sides of a thin face (thin wall, vertical band, sheet) can carry different templates.
- The inner side of a closed solid is refused: the two faces of a thick wall are two distinct facets.

**Visibility**

- A paint is visible iff its own template and its own listing are visible.
- The host's template and listing are ignored: hiding a host keeps the paints of other templates visible.
- The host's layer is followed: hiding a level hides its paints.

**Anti-aliasing shrink** (« Réduire le crénelage des parements »)

- The shrink is removed from every painted host, and from every annotation converted to a mesh.
- The picked part is then re-detected on the true geometry.

**When the host changes**

- Paints are re-synced automatically.
- If the face disappears, the paint becomes **orphan**: it stays listed but is not counted.
- An « À vérifier » badge flags a host edited while the 3D editor was closed.

## Data — `db.meshPaints` (Dexie v42)

One row per painted part.

```
{ id, projectId, scopeId,
  listingId, annotationTemplateId,      // PAINTING template + its listing
  hostAnnotationId, baseMapId,          // host + frame of the geometry
  partType: "FACE" | "EDGE",
  geometry: FACE { polygons: [{contour, holes}], normal: [x, y, z] }
          | EDGE { points: [p0, p1], sides?: [[x, y, z], …] },
  paintedAt,                            // user actions only (conflict arbitration)
  sync: { state: "OK" | "ORPHAN", geomHash, syncedAt, provisional?, nearOnly? } }
```

**Geometry conventions**

- A point is `[nx, ny, z]`:
  - `nx`, `ny` are normalized against the base map reference image, like `db.points`;
  - `z` is the ABSOLUTE local z in meters, in the frame of `imagesManager.getGroup(baseMapId)`.
- The FACE normal is in local meters and points TOWARD the painted side; it encodes the side.
- A facet split by a cut stays one row (multi-polygon).
- Conversions live in `utils/meshPaintFrame.js`.

**Registrations**

- `AUDIT_TABLES`, `OWNERSHIP_EXEMPT_TABLES`, `SOFT_DELETE_TABLES`, `UNDO_TABLES`.
- The linked-listing guard checks `listingId`.

**Derived writes (re-sync)**

- They run in a `tx.derivedWrite` transaction: no audit stamp, no undo entry, no dirty flag.
- A derived delete must be written as `update({deletedAt})`, because the soft-delete middleware pushes undo entries.

**Undo hook**

- The undo hook (`undoManager.registerUndoHooks`) stores the FULL new row as `after`.
- Reason: Dexie hands nested changes to the updating hooks as dotted-key diffs.

## Main pieces

| Area                 | Files                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| State                | `meshPaintSlice.js` (highlight / focus, session shrink exemptions), `hooks/useMeshPaints.js` (live rows + RAW hosts / listings — never `useAnnotationsV2`, which drops hidden hosts)                                                                                                                                                                                                       |
| Tool                 | `MESH_BRUSH` in `mapEditor/constants/drawingTools.jsx` (`editor: "3D"`, `requiresTemplate`); editor-aware lists via `mapEditor/utils/filterDrawingToolsForEditor.js`; `utils/meshBrushTools.js`, `utils/meshBrushSelectors.js`; activation rides `threedDrawing/hooks/useTemplateFaceDrawBridge.js` (`drawingMode.active`), the face-drawing machinery stays inert                         |
| Picking / commit     | `services/meshBrushPick.js`, `hooks/useMeshBrushPointerHandlers.js` (rAF hover, a press that moves less than 4 px commits, Escape exits), `components/MeshBrushThreed.jsx` + `MeshBrushOverlayThreed.jsx` (cursor label), `services/commitMeshBrushTargetService.js` → `services/paintMeshPartService.js` (toggle / replace in one undo group); refusals in `utils/getPaintHostRefusal.js` |
| Host geometry        | `js/buildHostPartIndexFromObject.js` (SOLID triangles in base-map-local meters) → `utils/buildHostPartIndex.js` (planar islands with outward normals on closed hosts, feature-edge chains, hash)                                                                                                                                                                                           |
| Shrink exemption     | `services/ensureUnshrunkHostObject.js`; `createAnnotationObject3D.js` honours `_noAntiAliasingShrink`; `useAutoLoadAnnotationsInThreedEditor.js` tags painted hosts and session exemptions; `AnnotationsManager.isCarvePending(id)`; `getEditableMesh3d` un-shrinks before converting to a mesh                                                                                            |
| Rendering            | `components/ThreedMeshPaints.jsx`: one layer per base map under its image group, FrontSide face skins lifted 1 mm, thick edge lines, `userData.isPaintOverlay`; `utils/getMeshPaintVisibility.js`; `js/meshPaintObjectsStore.js`; `services/focusMeshPaintInThreed.js`                                                                                                                     |
| Re-sync              | `components/MeshPaintsResyncThreed.jsx` + `hooks/useMeshPaintsResync.js` (host ready / load tick, 300 ms debounce, hash compare) → `utils/planPaintResync.js` (Stage 1 near ≤ 20 mm; Stage 2 parallel far, unambiguous; Stage 3 in-plane slide) → `services/applyMeshPaintsResyncService.js`                                                                                               |
| Read-time resolution | `utils/resolveMeshPaints.js`: drops invalid rows, gives each row a status (OK / ORPHAN / CONFLICT, newest `paintedAt` wins) and the stale flag; `utils/findMeshPaintMatches.js`: one matcher per base map, across hosts                                                                                                                                                                    |
| Quantities / panels  | `hooks/usePaintedPartsQties.js` (same option names as `useAnnotationsV2`) + `annotations/utils/mergePaintedQtiesIntoTemplateQties.js`                                                                                                                                                                                                                                                      |
| Lifecycle            | `services/copyMeshPaintsService.js` + `utils/classifyMeshPaintsForSplit.js` (2D splits re-host / copy), `utils/applyAffineToPaintGeometry.js`, `utils/mapPaintGeometryXY.js`, `services/meshPaintWriteGuard.js`, `services/syncMeshPaintsAfterUndoService.js`                                                                                                                              |

**Quantity consumers wired**

- Dessin panel: rows, listing counters, and the « Parties peintes » detail list (`panelDrawing/components/SectionTemplatePaintedParts.jsx`, `RowTemplatePaintedPart.jsx`).
- Viewer panel.
- `PopperMapListings`.
- 3D legend, including a row for templates that are only painted.
- `useAnnotationTemplateQtiesById(ForBaseMap)`, which feeds the 2D / portfolio legend totals and the listing properties.
- Aggregated export: `getAggregatedAnnotationRows`, plus a « Parties peintes » column in the Excel sheet and the datagrid.

**Lifecycle wired**

- Krto zip, plus the `hostAnnotationId` remap.
- Project export and wipe.
- Scope clear and scope duplicate.
- Annotation delete, template delete and unused templates.
- Purge (tombstones and purged hosts only).
- 2D / 3D move and rotate (`commitWrapperTransform`, `commitAnnotationsTransformFrom3d`).
- « Régénérer depuis le PDF ».
- 2D splits and Coupe face.

## Traps

- **Coordinate-rewriting services.** Any NEW service that rewrites coordinates in a base map frame must handle `db.meshPaints` too, the same way it handles `mesh3d`.
- **Overlay flag.** Paint objects carry `isPaintOverlay`, not `isHoverOverlay`. The pickers, the snap index, the section contours and the sketch edges skip `isPaintOverlay`; the export keeps it.
- **Overlay parenting.** Never parent a paint under its host root: a hidden host is not built at all.
- **Row immutability.** The local forms are cached per row object (WeakMap), so never mutate Dexie rows in place.

## Tests

```
node --test src/Features/meshPaint/utils/*.test.mjs
```

The pure utils use relative `.js` imports only.

## V2 — remaining work

**Copies**

- Copy paints on paste / duplicate of an annotation, on layer duplicate, and on wall join (`applyJoinAnnotationMergesService`). Today the paints of the dropped piece become orphans.

**Business objects / planning**

- Painted quantities are not linked to business objects or work packages. Those quantities flow through annotation rels, so this needs a paint → object link or a template mapping.

**Legends and recaps**

- Rows in the 2D and portfolio legends for templates that are ONLY painted (`useLegendItems`, `useLegendItemsByBaseMapId`).
- The SCOPE recap (`SectionAnnotationTemplateQties`) and the `SectionDrawingListings` counts.

**Export**

- A per-part Excel sheet « Parties peintes » and the per-annotation datagrid.

**Geometry**

- Curved and warped surfaces painted as one region; V1 paints them facet by facet.
- Curved edge chains.
- An exact, shrink-free reference geometry that does not depend on the display.

**Re-sync**

- Headless re-sync of hosts that are not built in 3D (hidden host or 3D closed). V1 shows the « À vérifier » badge instead.

**Performance**

- Batched rendering per template beyond about 1000 paints.
- One shared resolution of the parts for all quantity consumers.
