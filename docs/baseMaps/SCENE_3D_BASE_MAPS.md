# Scan base maps (« Scène 3D »)

A scan base map is a photogrammetry scan — a mesh exported as a binary `.ply`
with its `.jpg` texture atlases (DJI Terra: per-face `texcoord` +
`texnumber`, one `comment TextureFile` line per atlas) — turned into a base
map: its **image is the top-down projection of a zone of interest** of the
scan, at scale, and the base map owns the **mesh + height map** of that zone
(local only). In the 2D editor it is a regular base map (annotations are
drawn on it, the cursor altimetry reads its relief); in the 3D editor the
textured mesh sits on the base map plane and lines / cotes can be drawn on it.

Code: `src/Features/scene3d/` (import, clip, bake, GPU cache, picking, height
map) + `threedEditor/js/utilsImagesManager/attachScene3dToBaseMapGroup.js`.

## Data model

```js
baseMap = {
  ...regular fields (image, meterByPx, refWidth/Height, position, angleDeg,
     orientation: "HORIZONTAL"),
  scene3d: {
    sceneId,            // key of the scan data in db.scene3dAssets
    srcFileName, origin,
    bbox: { min: [x, y, z], max: [x, y, z] },
                        // QUANTIZATION bbox of the scan (metres, scan frame,
                        // Z up) — positions stay Uint16 on it, the clip never
                        // changes it
    zone: {
      rotationDeg,      // θ — see "Frames"
      center: [x, y],   // scan-frame point at the image centre
      width, height,    // metres = image extent
      polygon,          // [[x, y], …] scan frame, the clip polygon
      zMin, zMax,       // z range of the clipped mesh; the plane is at zMin
    },
    display3d,          // "MESH" (default) | "PROJECTION" | "HIDDEN"
    vertexCount, faceCount, atlasCount, storedBytes,
  },
}
```

Discriminator: `Boolean(baseMap.scene3d)`. `BaseMap` (the class) carries
`scene3d`; `useCreateBaseMapFromImage` stores it verbatim.
`meterByPx = 1 / pxPerMeter` of the bake, one « Image d'origine » version
with an identity transform.

## Frames (`utils/scene3dZoneTransform.js`)

- **scan frame**: metres, Z up, the PLY coordinates minus `origin`.
- **zone frame** = the base-map-local frame of `pixelToWorld` (origin at the
  image centre, +X image right, +Y image up): the scan frame rotated by θ
  about Z and centred on `zone.center`:

  ```
  q = R(−θ)·(p − center)        p = center + R(θ)·q
  ```

- **preview px**: the whole-scan top-down bake the zone is drawn on (image
  top = scan +Y, no rotation).
- The zone editor shows the preview rotated by φ (SVG `rotate`, clockwise on
  screen) and lets the user draw in the axis-aligned screen frame: **θ = φ**
  (pinned by `scene3dZoneTransform.test.mjs`).
- 3D: `scanWrap → pivot (rotation.z = −θ) → inner (−cx, −cy, −zMin)` → chunk
  meshes (`applyScene3dChunkTransform`, chunk space → scan frame). The plane
  of the base map is at the lowest point of the clipped scan; the base map
  `position.y` (« Z ») gives the absolute altitude.
- 2D altimetry: reference px → `baseMapPxToScan` → height map cell →
  `z − zone.zMin` (`utils/getScene3dHeightAtPx.js`).

## Storage

| What | Where | Ships in the Krto zip |
|---|---|---|
| Scan data (geometry chunks + textures) | `db.scene3dAssets` (v41) | never |
| Height map (2D altimetry, `HEIGHT` row) | `db.scene3dAssets` | never |
| Base map image (zone bake) | `db.files` (regular base map image) | yes |

`db.scene3dAssets` is **local only**: every `db.export` passes
`skipTables: ["scene3dAssets"]`. Not audited, not soft-deleted, not undoable.
Rows (key = scene + kind + atlas, `utils/scene3dAssetIds.js`):

- `GEOMETRY`: `{ positions (Uint16 xyz), uvs (Uint16 | Float32 | null), index
  (Uint16), boundsMin, boundsMax, vertexCount, triangleCount }`.
- `TEXTURE`: `{ format: "BC1", width, height, mipmaps: [{ data, width, height }] }`.
- `HEIGHT` (`<sceneId>/h`): `{ cols, rows, cellSize, bbox, data (Uint16) }` —
  grid on the scan bbox (column 0 = min X, row 0 = max Y), cell = max Z seen
  from above, quantized on `[bbox.min.z, bbox.max.z]`, `0` = empty.

On a device that received the base map through a Krto, the scan data is
missing: 2D works (image), 3D shows the plane only, « Recharger les fichiers »
(properties panel, `SectionBaseMapScene3d`) re-imports the same files and
applies the stored zone (`reloadScene3dBaseMapService`): image, scale and
altitude do not move.

## Prompt IA (height map export)

When the main base map is a scan, the Prompt IA zip (`promptIa/services/
buildPromptIaZip.js`) adds `hauteurs.png` + `hauteurs-apercu.png`, rendered by
`buildPromptIaHeightMapImages` **in the pixel frame of `plan.png`** (same
size: pixel (i, j) ↔ pixel (i, j)). Values are heights above the base map
plane (the frame of `offsetZ`), encoded RG16 (`promptIa/utils/heightMapRg16.js`):
`v = R*256 + G`, `0` = no surface, else `h = (v − 1) / 65534 × zMax`; the
preview is 8-bit grey (black = 0, white = zMax). `contexte.json.plan.heightMap`
carries `zMax`, `cellSizeM`, `planeAltitude` (`position.y`) and the formula.
The HEIGHT row is awaited with `loadScene3dHeightMap` (promise flavour of
`ensureScene3dHeightMap`); without scan data on the device the zip is built
without relief and the panel says so.

## Creation (`components/DialogCreateBaseMapFromScene3d.jsx`)

Card « Scène 3D » of the base map creation section (catalog key `SCENE_3D`,
per-scope activation like the other sources). Fullscreen dialog, three steps:

1. **FILES** — pick the `.ply` + textures (or the folder), then
   `importScene3dFilesService`: the worker streams the PLY into GEOMETRY
   rows (one quantization grid for the whole scan, ≤ 65 535 vertices per
   chunk), rasterizes a first height map, then atlas by atlas draws the
   whole-scan **preview** (`createScene3dTopViewBaker`, ≤ 2048 px) and
   encodes the BC1 display texture. The preview Blob is never persisted.
2. **ZONE** — `Scene3dZoneEditor`: SVG viewport (wheel zoom, drag pan),
   rotation (slider / field / ±90°), rectangle (drag) or polygon (clicks,
   Enter / double-click closes) drawn on the rotated preview; the polygon is
   kept in the scan frame (it follows the scan when rotating afterwards).
   Default = the whole scan. Name of the base map + « Créer ».
3. **FINALIZE** — `clipScene3dAssetsService` (worker `CLIP_*` job: keeps the
   triangles whose centroid is inside the polygon, compacts vertices, rewrites
   / deletes the rows, re-rasterizes the HEIGHT row, drops the textures of
   emptied atlases) → `bakeScene3dZoneImageService` (ortho camera centred on
   the zone, rotated by θ, ≤ 200 px/m within the chosen size) →
   `createBaseMapFromImage({…, scene3d})` → `unmarkScene3dImporting`.

Between the import and « Créer » the rows are unreferenced:
`scene3dImportingGuard` protects them from the orphan purge; closing the
dialog deletes them.

## Lifecycle

- **Deletion**: `useDeleteBaseMap` / `useDeleteBaseMapListing` hard-delete
  the scan data after the transaction (`deleteScene3dBaseMapsDataService`;
  a scan still referenced by another live base map — duplicated project —
  is kept). Base maps are not undoable, so nothing comes back without data.
- **Purge**: `purgeOrphanScene3dAssetsService` (run when the scan dialog
  opens) deletes the scans no live base map references.
- **Project wipe**: `deleteProjectLocalDataService` deletes the rows by
  `projectId`.

## 3D editor

`ImagesManager.syncScene3d` attaches the scan to the **base map group**
(`attachScene3dToBaseMapGroup`, keyed on `sceneId|display3d`, re-run by
`ensureBaseMapLoaded` — the repair effect of `useAutoLoadMapsInThreedEditor`
keys on both), so it follows the base map pose. `scanWrap` is a sibling of
`meshWrap` (the scan does not slide with the drawing offset). The base map
plane stays under the mesh: it loses every depth contest (renderOrder −1 +
polygonOffset), the image shows through the holes of the mesh. The base map
3D opacity and the « image » visibility apply to the scan too.

- `MESH`: one `Mesh` per chunk, one unlit `MeshBasicMaterial` per atlas in
  every render mode. GPU resources from `scene3dAssetsCache` (ref-counted,
  loaded atlas by atlas, CPU copies dropped after upload, eviction delayed).
  Without the S3TC (+ sRGB) extensions the BC1 data is decoded to RGBA at
  half size (`getRendererSupportsS3tc`).
- `PROJECTION` / `HIDDEN` / data missing: the plane only.

The scan is a **decor**: every object is tagged `userData.isDecor` and has a
no-op `raycast`. Passes that skip it: shadow flags (`AnnotationsManager`),
shadow frustum fit (`RenderModeManager`, base map groups contribute their
`meshWrap` only), sketch edges (`aquarelleMaterials`), hover / dim material
swap (`applyAnnotationMaterialState`), vertex snap index (`useVertexSnap`),
section contours (`SectionContourManager`), scene export
(`buildExportScene`), 3D lasso (`MainThreedEditor`). It is cut by the
clipping planes (`ClippingManager._applyMaterials` traverses the group).

« Distance de vue max » (`constants/viewDistances.js`) in `AUTO` widens the
range to 3× the diagonal of the largest zone of the loaded scan base maps.

## Drawing on the scan

Lines and cotes can land their points on the scan surface in the 3D editor
(a straight segment between two picked points): POLYLINE template, COTE
template, or the template-less « Dessin » tool on its line type (a path
holding a scan point becomes a templateless POLYLINE annotation). The
existing commits (`commitDrawnPolylineService`, `commitDrawnCoteService`)
turn the 3D vertices into a regular annotation on the scan base map (the
`baseMapId` carried by the hits), with per-vertex heights.

- **Picking data** (`scene3dPickStore`): CPU copy per chunk (positions +
  index read back from `db.scene3dAssets`) + a BVH (`three-mesh-bvh`), built
  on demand when a drawing tool needs it (`usePrepareScene3dPicking`, keyed
  on `annotationsLoadTick` + `baseMapsLoadTick`), dropped after 60 s idle.
- **Picker** (`intersectScene3d`): the base map groups carrying
  `userData.scene3dPick = {sceneId, frame}`; the ray is taken into the chunk
  space through `frame.matrixWorld`, the clipping plane is honoured.
  `{ isPending: true }` while the data is being built.
- **Snap cascade** (`computeSnapTarget`, kind `"SCAN"`): a scan hit is
  final. Feedback in the drawing helper (`SectionScene3dPickingStatus`).

## Altimetry in 2D

« Altimétrie » mode (Réglages 2D / bottom-left button): the badge shows the
absolute altitude (base map `position.y` + height above the plane) of the
hovered annotation (`getAnnotationHeightAtPoint`) or, on a scan base map, of
the relief under the pointer (`getScene3dHeightAtPx` on the HEIGHT row
served by `scene3dHeightMapStore`; `usePrepareScene3dHeightMaps` warms it
up). The lookup is O(1) and drives the badge imperatively.

## Tests

```bash
node --test src/Features/scene3d/utils/*.test.mjs
```

`clipScene3dChunk.test.mjs` (clip + compaction), `scene3dZoneTransform.test.mjs`
(frames, θ = φ), `rasterizeScene3dHeightMap.test.mjs` (height map + lookup on
a rotated zone), `parseScenePly.test.mjs`, `encodeBc1.test.mjs`.
`SCENE_PLY=/path/to/scan.ply` replays the parser on a real export.
