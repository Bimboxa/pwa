# Local scan viewer (experimental)

Enable **Configuration → Outils → Scan 3D**, using the normal per-scope
and per-module tool activation. Open the right-hand **Scan 3D** tool and load
a binary PLY. The engine starts only when the tool is first opened. The drawer
starts at 500 px and can be resized from its left edge. It uses the standard
property-panel header/sections, with the file name/count/size in the header and a model-action menu. The tool
button carries a **Beta** badge. With no
model loaded it shows a grayscale point-cloud room illustration and **Charger un scan 3D** below that header.
The real-world scale and vertical axis must be confirmed by the operator.

## Supported data

- Binary little- or big-endian PLY points; RGB or Gaussian DC colors.
- Gaussian PLY rendering with pinned Spark 2.4.0, including its SH attributes.
- Automatic project-local persistence, reopen, replace, delete, frame, axis and scale.
- Multiple project-level resources; one model displayed at a time.
- Limits: 40 million points (5 million Gaussians) and 2 GiB per file. No ASCII or triangle meshes
  in this entry point. Existing mesh imports remain unchanged.

This milestone is a viewer with optional point inspection and a local RANSAC
plane estimate. Editable surface extraction, reference-plane heatmaps and
integration with annotation picking are subsequent steps. Splat centers are reconstructed visual data, not laser measurements.
Existing clipping, snapping, collisions and project exports do not include
these scans. Their visibility is independent of existing base-map visibility.

## Isolation and lifecycle

`LocalScansGate` is the only integration into `MainThreedEditor`. With the
tool disabled or before its first opening there is no scan database access,
worker, Spark import or GPU allocation. Closing the panel keeps the model;
disabling the tool releases it without deleting its saved resource.

The panel is dynamically imported on first opening; Spark and its isolated decoder
are imported only when a Gaussian view is requested. These optional chunks
are excluded from PWA precaching, cached on first use, and available offline
after that first successful online load. No remote CDN or upload is used.

Source parsing runs in a terminable worker with bounded file reads. Spark's
decoder pool runs inside a short-lived worker so its WASM heap and nested
workers can be released on completion or cancellation. Render/sort resources
belong to the displayed scan and are disposed on close, disable or project
change. Switching to 2D keeps the scan: the gate stays mounted with the (always
alive, off-screen) 3D editor and the panel is only `inactive` — no inspection,
projection or overlay — until the 3D comes back. Static shader resources may
remain cached by Three.

Each scan owns a separate scene root. It never enters the annotation, mesh,
base-map, clipping or export registries. Its raycast returns false to stop
recursive picking by existing tools. The editor's renderer, antialiasing,
camera controls and render path are unchanged. Spark's dirty callback requests
coalesced renders instead of adding a permanent animation loop.

Models saved locally are `db.resources` rows with `kind: LOCAL_SCAN_3D`,
`visibility: PROJECT` and `projectId`. Metadata includes point count, source
bounds and placement. Main files live in `db.files.fileBlob`, without `listingId`,
to keep multi-GB PLYs out of ArrayBuffer allocation and scope-file exports. The
resource reader/download and reattachment paths accept this Blob form. Resource
metadata follows normal project export/deletion rules; files remain device-local
and may be reattached through Resources after an import. Removing a resource uses
the existing resource-delete flow. Quota failures still permit temporary viewing.

Legacy `krto-local-scans-v1` scope entries are listed for their parent project.
Opening one copies it transactionally into a project resource, preserves its
placement and only then releases the old copy. A failed migration leaves the
original intact. `legacyScanKey` prevents duplicate entries if legacy cleanup
fails. No bulk migration or change to unrelated resources occurs.

## Tool tabs and lifecycle

- **Général**: file information, local persistence, points/realistic mode,
  shared projection preview, and **Créer un fond de plan**. Creation uses the
  selected density/RGB raster through the standard base-map creator, with
  `meterByPx`, an initial version and `createdFrom` scan provenance. It stays
  local (no initial remote save), and does not switch the current base map.
- **Projection**: compact inclusive Z limits, centered density/mean-RGB selector,
  a download button for the selected raster and optional hiding of points outside
  the slice. Boundary highlighting uses a fixed ±2 cm tolerance.
- **Position**: axis/scale, point inspection, move-to-origin and two-click
  horizontal alignment in the shared preview.

Before a projection exists, every preview says **Définir l’image projetée dans
l’onglet Projection**. Only **Calculer** starts generation. Its controller
lives with the scan rather than inside a tab or the drawer: changing tabs or
closing the drawer keeps results, bounds and placement. Inspection is active
only in the visible Position tab. An unfinished projection is cancelled when inspection starts.
Moving/rotating the model invalidates the preview until the next manual calculation;
stale images cannot create a base map. Source data never enters Redux.

Base-map creation uses the same compact Z input as the top bar (default 0 m).
The new map stores its world-space center and yaw along with the raster scale.
Its center includes the raster's partial edge pixels. Projection rows already
follow horizontal base-map coordinates (image top = world -Z, the view from
above), so the preview, the PNG download and the base map are the same
picture. This aligns the image with the projected scan after translation,
scaling and rotation, including rotated editor axes. The selected Z only sets
the new map altitude and does not change the projection slice.

`Scan3dPanelHost` is the ordinary tool drawer; the persistent scan controller
portals its controls there. The scene/input overlay stays in the editor. With
the tool closed the model and optional clipping remain visible, and ordinary
editing gestures resume. Other right-hand panels retain their existing widths.

## Load zone

A new PLY (and **Modifier la zone** in the model menu) first reads a regular
sample of at most 2 M points and shows its top-down density in the
`Scene3dZoneEditor` of the « Scène 3D » import: whole scan, rectangle or polygon,
rotation, vertical axis and height range (default: 1st–99th percentiles,
padded). The full decode (`readLocalPly` with `zone`) then keeps the zone only,
so the memory peak follows the zone, not the file. The zone (source units) is
stored in `resource.scan.zone` and reapplied on reopening. Its rotation sets the
yaw so that the zone X axis becomes the displayed X axis and, with **Centrer sur
la zone**, the zone centre at the lowest height becomes scene zero
(`getScanZonePlacement`, pinned by `localScanZone.test.mjs`). In « Réaliste »
mode the Gaussian decode is not filtered: the zone limits the points only.

## Shared decode (localScanRuntime)

Saved scans are decoded once per resource and zone in a reference-counted
runtime outside React (`createLocalScanRuntime`), shared by the tool and the
scan base maps and dropped 15 s after the last release. Workers receive clones
of the positions, never transfers, so sharing is safe.

## Scan base maps

A base map created from a saved scan stores `baseMap.localScan = {resourceId,
matrix}`: the scan root pose in the base map group frame at creation
(`getLocalScanMatrixInBaseMap`). In 3D, `ImagesManager.syncLocalScans` attaches
the point cloud to that group (`attachLocalScanToBaseMapGroup`, `localScanWrap`
sibling of `meshWrap`), so it follows 2D recalage, Déplacer / Tourner, the
gizmo and the altitude; `meterByPx`, versions and the drawing offset do not
affect it. Each base map keeps its own pose. One carrier per scan: the main
base map when it carries it, else the first visible loaded one, and none while
the Scan 3D tool shows that scan itself.

The bottom bar « Scan 3D » selector (`viewers.baseMapsScanMode`: Masqué /
Points / Réaliste, per scope like the image mode) drives them. Until a mode is
chosen in a Krto (null) no point cloud is loaded, no button is highlighted and
the « Scène 3D » meshes keep showing; only an explicit Masqué hides them too. Réaliste falls back to points for a
plain point cloud. It shows in 3D for projects with scan base maps. The base
map properties panel shows the source scan, the same mode and whether its file
is on this device (PLY files stay device-local).

## Verification

```sh
node --test src/Features/localScans/utils/*.test.mjs src/Features/localScans/services/*.test.mjs src/Features/scene3d/utils/*.test.mjs
npx eslint src/Features/localScans src/Features/threedEditor/js/utilsImagesManager
npm run build
```

`tests/smoke.html` is a development-only harness using the real `ThreedEditor`,
the real setting and panel, a disposable Redux scope, and a green control cube.
Open `/src/Features/localScans/tests/smoke.html` on Vite to test without modifying
an actual project. It is not a production entry point. Use a separate browser
profile; its IndexedDB source still occupies disk until deleted.

Browser checks performed in desktop Chrome with the supplied PortalCam PLY
(186,516,805 bytes, 2,742,882 Gaussians): points, splats, local save/reopen,
placement persistence, invalid replacement, cancellation, disabling and
resource removal. No external requests were issued by the harness. A test
production build with the same harness as an extra entry point also verified
full-page reload and reopening/rendering offline through the service worker.
Tablet performance and broad interaction with all editor tools are not yet
validated. Existing scene3d unit tests pass (the external fixture test skips
when its source is absent).

## Point inspection and scan origin

Enable **Coordonnées au clic** in the Position tab, then click the scan. Dragging
still navigates. A transparent input surface receives inspection gestures;
camera-controls temporarily connects to it so existing canvas drawing and
selection handlers do not receive those gestures. Disable the switch to restore
normal canvas interaction. Walk/capture modes and scan preparation suspend it.

A worker holds one extra copy of the source positions only while inspection is
active. It finds the nearest source center within six CSS pixels of the ray,
then searches a cube of exactly 1 m per edge centred on that hit (accounting for
import scale). A deterministic reservoir retains up to 4,096 points; 640 RANSAC
triplets propose distinct planes using a ±2.5 cm inlier tolerance. Candidates
need at least 12 inliers and 15% support, plus a genuinely two-dimensional patch.
Covariance refinement is applied twice. Nearby candidates are preferred over
more distant, denser planes; distances within the noise tolerance tie by support.
At grazing angles a bounded orthogonal projection replaces an unstable ray
intersection, so a valid plane can still be displayed. Sparse or linear
neighbourhoods without a supported plane retain the original center position.
The panel reports the total cube population and sampled inlier percentage;
these are diagnostics, not a guarantee of physical surface accuracy. Empty clicks clear the result. Camera/placement changes while
a request is running discard stale results. For Gaussian scans this uses centers,
not rendered opacity/depth, so it is an approximate visual pick, not metrology.

The cyan pulse and a 2 m × 2 m grid (10 cm cells) fade over 2.2 seconds
on a supported plane; an isolated marker is used
when the fit is unreliable. Animation frames, geometry and materials are freed
at the end or on cleanup. Coordinates are metres in the displayed axes (including
the orientation gizmo yaw, Z vertical). **Mettre à l’origine** translates only
the scan so the picked source point becomes scene zero. The source-space anchor
survives axis/scale changes and is stored with placement when a local copy exists.
The grid shows the estimated plane extended over two metres, not a guarantee
that the surrounding scan is planar. The original file, project annotations,
camera and other assets are unchanged.

## Large point-cloud trial

The NavVis MLX example (1,179,096,338 bytes, 32,752,655 vertices) is accepted at
full resolution. The reader retains only XYZ and RGB, using bounded slices;
normal/intensity/curvature fields are skipped. No automatic downsampling occurs.
This example needs about 469 MiB for decoded positions/colors, a similar GPU
allocation, and another 375 MiB of positions when point inspection is enabled.
The source Blob and other renderer/browser allocations are additional. Point
picking still scans the full cloud in its worker. Desktop performance must be
assessed separately from parser correctness; this is not a mobile memory budget.
Local storage quota failures continue to fall back to viewing without saving.
The separate five-million Gaussian limit is unchanged.

## Horizontal slice projection

Open the **Projection** tab to select an inclusive horizontal interval with
one vertical, two-handle slider or numeric Z limits. Slider bounds follow the
placed cloud's useful height interval (1st–99th percentiles), with 5% padding on each side (at least
5 mm for a flat cloud). Values are metres in the
placed scan's displayed frame, including origin, scale, vertical-axis selection
and gizmo yaw. The image is orthographic (+X right, displayed +Y down, i.e. world -Z up as
seen from above), with fixed XY bounds
and square pixels; its longest side is 768 pixels. Each source point inside the
interval contributes once, without sampling. **Densité** maps log(1 + point count)
to dark pixels; **Couleurs** averages RGB per occupied pixel. Empty pixels remain
white. Contrast is normalized independently for each slice, so darkness is not
an absolute density scale across slices. Density highlights aligned vertical
surfaces but does not classify walls: furniture and uneven scan coverage also
contribute. Gaussian input uses centers, not rendered splat opacity.

The orange and cyan boundary planes and points within ±2 cm of each boundary
follow slider changes in real time. Point highlighting runs on the GPU using
the scan’s shared vertex buffers, independently of the projection worker.
**Calculer** alone starts image generation. Changing either bound cancels
unfinished image work and marks the previous image stale. Stale images cannot
be exported, used for alignment or converted into base maps. The optional 3D
clipping applies to the calculated range and is suspended when it becomes stale.
The image uses the exact interval, not the boundary tolerance.
PNG export contains the displayed raster, without georeferencing metadata.

Each explicit calculation creates a worker and clones XYZ/RGB (about 469 MiB
extra for the full NavVis example). The worker is terminated after completion,
failure or cancellation, releasing its source copy. Inspection and projection
are mutually exclusive to avoid retaining both analysis workers.
Disabling local scans, switching to 2D or replacing the model disposes the
analysis workers and overlays. Settings/previews remain transient until the user
explicitly creates a base map. Closing the drawer alone retains the model.

Validation includes placed-coordinate/axis tests, inclusive range and image
orientation tests, mean RGB, density, empty/flat bounds and cancellation. The
full NavVis file projected 8,794,600 points between source Z=-0.5 and +0.5 m into
502 x 768 pixels (4.01 cm/pixel), with a 357 ms Node computation on the development
machine. This is a computational check, not a browser frame-rate guarantee.

The preview supports pointer-anchored wheel zoom, drag-to-pan and a top-right
**Recadrer l’image** icon. Density/color controls overlay the top-left corner.
Its frame remains visible before projection, with the setup prompt inside.
Portrait/landscape buttons beside base-map creation select the A4/A3 preview
aspect ratio across tabs. Framing and zoom only affect the preview, not the
output resolution or exported PNG. **Définir l'axe horizontal (2 points)** picks image coordinates
through the zoom/pan transform. The confirmed axis remains visible on the previous image until **Calculer la
projection** is pressed in Position. After the second click the scan itself rotates
about world Y (displayed vertical Z) around its current source anchor. The vector
from the first point to the second becomes positive displayed X. No project
geometry or editor axes are rotated. The next **Calculer** uses the transformed
points, preserving the selected Z interval; **Réinitialiser la rotation** restores
the imported horizontal orientation. Yaw is persisted with local scan placement,
with zero as the backward-compatible default for previously saved scans.

Browser verification with PortalCam covers boundary overlays, slider and numeric
input, density/RGB modes, PNG download, wheel zoom, pan and two-point alignment.
The alignment tests cover both vertical-axis choices, nonzero origin/scale, an
existing model rotation and rotated editor axes. The full NavVis projection was
validated computationally; full NavVis browser interaction remains to be assessed.

## Slice clipping

**Masquer les points hors de la tranche en 3D** filters centers by placed world Y
(displayed Z). Points use a dedicated material shader with live uniforms; splats
use two explicit per-mesh Spark plane edits with zero opacity outside the range.
No global renderer clipping setting, other mesh or source buffer is modified.
The boundary diagnostic overlay retains its small tolerance. Picking ignores
centers outside the active slice. Clipping survives tab changes and is reversible.

The project-resource unit test verifies project isolation, Blob round trips,
placement preservation, missing sources, deleted resources and transaction aborts.
The development harness now exercises the real right drawer with an independent
Redux store and synthetic project IDs; it does not dispatch selection actions
that write the user's remembered project/scope to localStorage. Test resources
and generated base maps use only `smoke-project` and may occupy local storage.

The Z slider defaults to estimated 1st–99th percentile heights (a bounded
65,536-point sample), padded by 5%, so isolated outliers do not consume its
travel. This only changes slider
limits; no source points are deleted or excluded from projection. Heights
are evaluated after placement; fewer than 100 points use exact bounds.

Scan import/render errors are portaled exclusively into the Scan 3D drawer;
closing it hides them without placing text or buttons over the 3D scene.
`tests/smoke.html?panel-error` exercises the error panel, hide/reopen and retry
flow without deliberately crashing the renderer.
