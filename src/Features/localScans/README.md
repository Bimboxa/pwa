# Local scan viewer (experimental)

Enable **Configuration → Éditeur 3D → Scans locaux : points et Gaussian
Splatting**. The preference is device-local and defaults to off. In the 3D
view, open **Scans locaux**, select a binary PLY and choose Points or Réaliste.
The real-world scale and vertical axis must be confirmed by the operator.

## First milestone

- Binary little- or big-endian PLY points; RGB or Gaussian DC colors.
- Gaussian PLY rendering with pinned Spark 2.4.0, including its SH attributes.
- Explicit local persistence, reopen, replace, delete, frame, axis and scale.
- One saved source per project/scope in a separate IndexedDB database.
- Limits: 5 million points and 512 MiB per file. No ASCII or triangle meshes
  in this entry point. Existing mesh imports remain unchanged.

This milestone is a viewer with optional point inspection and a local RANSAC
plane estimate. Editable surface extraction, reference-plane heatmaps and
integration with annotation picking are subsequent steps. Splat centers are reconstructed visual data, not laser measurements.
Existing clipping, snapping, collisions and project exports do not include
these scans. Their visibility is independent of existing base-map visibility.

## Isolation and lifecycle

`LocalScansGate` is the only integration into `MainThreedEditor`. With the
option off there is no scan database access, worker, Spark import or GPU
allocation. `SectionLocalScans` only writes the device preference.

The panel is dynamically imported on enable; Spark and its isolated decoder
are imported only when a Gaussian view is requested. These optional chunks
are excluded from PWA precaching, cached on first use, and available offline
after that first successful online load. No remote CDN or upload is used.

Source parsing runs in a terminable worker with bounded file reads. Spark's
decoder pool runs inside a short-lived worker so its WASM heap and nested
workers can be released on completion or cancellation. Render/sort resources
belong to the displayed scan and are disposed on close, disable, scope change
or exit from the 3D view. Static shader resources may remain cached by Three.

Each scan owns a separate scene root. It never enters the annotation, mesh,
base-map, clipping or export registries. Its raycast returns false to stop
recursive picking by existing tools. The editor's renderer, antialiasing,
camera controls and render path are unchanged. Spark's dirty callback requests
coalesced renders instead of adding a permanent animation loop.

Metadata and source blobs are stored separately in `krto-local-scans-v1`.
Replacement/deletion use transactions. A failed import preserves the previous
scan. Quota failures still allow viewing without persistence. Local copies
are not included in project exports/sync; deleting a project does not purge
this separate experimental store. Use the panel's local-delete action before
deleting the project, or clear this database in browser storage settings.

## Verification

```sh
node --test src/Features/localScans/utils/*.test.mjs src/Features/localScans/services/*.test.mjs src/Features/scene3d/utils/*.test.mjs
npx eslint src/Features/localScans src/Features/scopeConfig/components/PageEditor3d.jsx
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

Enable **Coordonnées au clic** in the scan panel, then click the scan. Dragging
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
