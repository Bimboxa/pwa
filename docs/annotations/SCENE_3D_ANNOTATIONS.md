# SCENE_3D annotations (3D scans)

A `SCENE_3D` annotation is a 3D scan — a photogrammetry mesh exported as a
binary `.ply` with its `.jpg` texture atlases (DJI Terra: per-face `texcoord`
+ `texnumber`, one `comment TextureFile` line per atlas) — placed on a base
map. It shows in the 2D editor as its top-down projection and in the 3D editor
as the textured mesh. Geometry kind `BBOX`, like `OBJECT_3D`: a normalized
`bbox` + a `rotation`, no `db.points` row.

Code: `src/Features/scene3d/`.

## Data model

```js
annotation = {
  type: "SCENE_3D",
  bbox,                 // normalized; only its CENTRE matters (see below)
  rotation,             // degrees, clockwise in 2D, about the bbox centre
  offsetZ,              // altitude of the scan's lowest point above the plan (m)
  opacity,
  sceneDisplay2d,       // "PROJECTION" (default) | "HIDDEN"
  sceneDisplay3d,       // "MESH" (default) | "PROJECTION" | "HIDDEN"
  scene3d: {
    sceneId,            // key of the scan data in db.scene3dAssets
    srcFileName,
    bbox: { min: [x, y, z], max: [x, y, z] },   // metres, scan frame (Z up)
    origin,             // offset subtracted from double coordinates
    vertexCount, faceCount, atlasCount, storedBytes,
    topView: { fileName, fileMime, width, height, pxPerMeter },  // db.files
  },
}
```

- **The scan is at scale, never resized.** `useAnnotationsV2` resolves the bbox
  as *stored centre + metric footprint* (`scene3d.bbox ÷ meterByPx`), so a
  rescaled base map keeps the 2D footprint in line with the 3D mesh (which is
  in true metres).
- **No binary on the annotation row** (rows are structurally compared by
  `stabilizeAnnotationsIdentity`), and `SCENE_3D` is **not** hydrated like
  `IMAGE` / `MARKER`: consumers load what they need themselves
  (`useScene3dTopViewUrl`, `scene3dAssetsCache`).
- The files belong to the **annotation**, not to the template (a `SCENE_3D`
  template has no configurable prop).

## Storage

| What | Where | Ships in the Krto zip |
|---|---|---|
| Scan data (geometry chunks + textures) | `db.scene3dAssets` (v41) | never |
| Top view image | `db.files` | yes (whitelisted in `createKrtoZip`) |

`db.scene3dAssets` is **local only**: every `db.export` (`createKrtoZip`,
`createKrtoFile`, `createProjectExportZip`, `createBaseMapShareZip`) passes
`skipTables: ["scene3dAssets"]`, so a save never reads these rows. The table is
not audited, not soft-deleted, not undoable.

Rows (primary key = scene + kind + atlas, see `utils/scene3dAssetIds.js` — the
rows of one atlas are read with a key-range query):

- `GEOMETRY`: `{ positions (Uint16 xyz), uvs (Uint16 | Float32 | null), index
  (Uint16), boundsMin, boundsMax, vertexCount, triangleCount }` — one chunk of
  at most 65 535 vertices.
- `TEXTURE`: `{ format: "BC1", width, height, mipmaps: [{ data, width, height }] }`.

The original `.ply` / `.jpg` files are **not kept**: the import converts them.
On a device that received the annotation through a Krto, the scan data is
missing: 2D works (top view), 3D falls back to the flat projection, and
"Recharger les fichiers" (properties panel) runs the import again on the same
annotation (`reloadScene3dAnnotationService`).

## Import pipeline (`importScene3dFilesService`)

Streaming, to keep the memory bounded whatever the scan size:

1. **Worker** (`workers/scene3dImport.worker.js`, `utils/parseScenePly.js`):
   the PLY is read slice by slice (`Blob.slice`), faces are grouped by atlas,
   corners sharing (vertex, u, v) are welded, positions are quantized to Uint16
   on **one grid for the whole scan** (the scan bbox — a vertex shared by two
   chunks lands on the same value, no cracks), and chunks are emitted as they
   fill up. Each chunk is written to `db.scene3dAssets` and released.
   V is flipped (`1 − v`): PLY uvs have a bottom-left origin and the textures
   are uploaded unflipped.
2. **Atlas by atlas**: the image is decoded at the bake size, its chunks are
   drawn in the top view (`createScene3dTopViewBaker`: orthographic camera
   looking down −Z, no clear between atlases, depth kept — one texture on the
   GPU at a time), then the worker reduces it to at most 2048 px (power of
   two), builds the mip chain and encodes it in **BC1** (`utils/encodeBc1.js`,
   0.5 byte / pixel on the GPU).
3. The top view is returned as a Blob and written to `db.files` when the
   annotation is created.

Supported: binary little / big-endian PLY, extra vertex properties, n-gons
(fan), untextured meshes, double (georeferenced) coordinates. Rejected with a
clear message: ASCII PLY, point clouds, truncated files.

## Flows

- **Arming** (`startScene3dImport`, called by `useDrawFromTemplate`,
  `startDrawFromTemplate`, `startTemplatelessDraw`): a `SCENE_3D` tool opens
  the import dialog (`DialogImportScene3d`, mounted once in `MainAppLayout`)
  instead of arming. Once the scan is converted, the dialog arms the
  `ONE_CLICK` placement with the descriptor on the draft.
- **Pending scans** (`scene3dPendingStore`): between the dialog and the click,
  the scan data sits in `db.scene3dAssets` with nothing referencing it. The
  store keeps the top view Blob (commit) and its object URL (placement ghost);
  a scan that leaves it without being committed (Escape, another tool, another
  import) is deleted.
- **Placement**: the click sets the **origin (0, 0) of the scan frame** — the
  frame shared by the blocks of one mission, so two scans placed on the same
  point line up (`getScene3dRectanglePointsFromOnePoint`). The commit
  (`useHandleCommitDrawing`) takes the scan out of the pending store, writes
  the top view, then disarms the tool and selects the annotation.
- **2D** (`NodeScene3DStatic`): a scan is a backdrop. It is drawn first
  (`sortOpeningsLast`), its body is selectable by a click but **not
  draggable** (a drag over it pans the map); once selected it shows a move
  handle and the rotation handle (OBJECT_3D drag pipeline).
- **Deletion** (`useDeleteAnnotations`): the scan data and the top view are
  hard-deleted with the annotation, and the deletion is not undoable
  (`withoutUndo`). `purgeOrphanScene3dAssetsService` (run when the import
  dialog opens) removes the scans whose annotation went away through another
  path (listing deleted, scope reset, reload before the placement click).

## 3D editor

`createScene3dAnnotation` (dispatched by `createAnnotationObject3D`) returns a
group posed like an `OBJECT_3D` (bbox centre, `rotation.z = −rotation`,
`offsetZ`) — without the glTF axis swap, the scan is already Z-up.

- `MESH`: one `Mesh` per chunk, one unlit `MeshBasicMaterial` per atlas in
  every render mode (a photogrammetry texture already carries its lighting).
- `PROJECTION` (or scan data missing): the top view as a flat quad.
- GPU resources come from `scene3dAssetsCache`: ref-counted, loaded atlas by
  atlas, CPU copies dropped after upload, **eviction delayed** (a render-mode
  change disposes the annotation objects before rebuilding them). Without the
  S3TC (+ sRGB) extensions the BC1 data is decoded to RGBA at half size.

The scan is a **decor**: every object is tagged `userData.isDecor` and has a
no-op `raycast`. Passes that skip it: shadow flags (`AnnotationsManager`),
sketch edges (`aquarelleMaterials`), hover / dim material swap
(`applyAnnotationMaterialState`), vertex snap index (`useVertexSnap`), section
contours (`SectionContourManager`), scene export (`buildExportScene`), shadow
frustum fit (`RenderModeManager`), 3D lasso (`MainThreedEditor`). It is still
cut by the clipping planes. Its geometries have no CPU copy: any new pass that
reads vertex data must skip `isDecor` objects (the drawing tools pick the scan
through their own data, see below).

## Drawing on the scan

Lines and cotes can land their points on the scan surface in the 3D editor (a
straight segment between two picked points — not draped on the relief): a
POLYLINE template, a COTE template, or the template-less "Dessin" tool on its
line type. With the "Dessin" tool a path holding a scan point is not a mesh
cut: it becomes a templateless POLYLINE annotation ("Segment (2 clics)"
commits on the second click, "Polyligne clic" on Enter). Nothing new is stored: the existing commits
(`commitDrawnPolylineService`, `commitDrawnCoteService`) turn the 3D vertices
into a regular annotation on the scan's base map, with per-vertex heights
(`offsetZ` + `offsetBottom`). The drawing is NOT attached to the scan: moving
or rotating the scan afterwards leaves it in place.

- **Picking data** (`scene3dPickStore`): the displayed scan has no CPU
  geometry and its meshes never answer a raycast. Picking works on a separate
  CPU-only copy — per chunk, positions + index read back from
  `db.scene3dAssets` and a BVH (`three-mesh-bvh`, which supports the
  normalized Uint16 positions as is). Built **on demand** when a drawing tool
  needs it (`usePrepareScene3dPicking`, ~1 s for 2.8 M triangles, one chunk
  per task), dropped after 60 s without a pick. Cost while drawing: positions
  + index + BVH (~60 MB for 2.8 M triangles); a pick is ~0.02 ms.
- **Picker** (`intersectScene3d`): explicit, called by the drawing overlays
  only — the scan stays a backdrop for hover, selection and the other tools.
  The ray is taken into the chunk space through `userData.scene3dPick.frame`
  (published by `createScene3dAnnotation` in `MESH` display), the clipping
  plane is honoured. `{ isPending: true }` while the data is being built:
  the caller must not fall back to the plan behind the scan.
- **Snap cascade** (`computeSnapTarget`, kind `"SCAN"`): a scan hit is final —
  no in-plane ortho, vertex alignment nor world-axis lock (they would pull the
  point off a surface that is not a plane). Vertices / edges hidden behind the
  scan are skipped. Cotes: last fallback of `computeDimensionSnap`.
- **Feedback**: the preparation progress then "ready" is shown in the drawing
  helper (`SectionScene3dPickingStatus`, fed by `useScene3dPickingStatus`) and
  a toast marks the end. A scan hit shows the same target as a face / plan hit
  (snap circle + dashed cross in the plane of the triangle under the cursor,
  arms scaled with the viewing distance), and every placed point gets a dot
  (`buildDrawingVertexMarkers`).
- Not supported: polygons (a face needs coplanar points), rectangles,
  snapping to the scan's own vertices.

The camera range follows the scans: "Distance de vue max" (Configuration >
Éditeur 3D, `constants/viewDistances.js`) defaults to `AUTO`, which widens the
regular range to 3× the diagonal of the largest loaded scan.

## Tests

```bash
node --test src/Features/scene3d/utils/*.test.mjs
```

`SCENE_PLY=/path/to/scan.ply` replays the parser on a real export.
