# IMAGE annotations

An `IMAGE` annotation is a raster picture placed on a base map: a normalized
`bbox` (vs `baseMap.image.imageSize`) plus a `rotation` in degrees around the
bbox centre. No `db.points` row is involved (geometry kind `BBOX`, like
`RECTANGLE` and `OBJECT_3D`).

## Data model

- `annotation.image`: persistent reference `{ fileName, isImage, imageSize,
  thumbnail, fileUpdatedAt }`. The bytes live in `db.files` (entity pipeline,
  `getEntityPureDataAndFilesDataByKey`). `useAnnotationsV2` hydrates
  `imageUrlClient` at read time.
- The image is **specific to the annotation**. The template's `image` is only a
  default: a draft armed from a template copies the reference (the file row is
  shared, `getImageRefFromEntityImage` strips the hydrated ArrayBuffer / blob
  URL), and replacing the image later creates a file owned by the annotation
  (`useUpdateAnnotationImage`, orphan cleanup limited to owned files).
- `template.meterByPx` (image m/px) sizes the one-click placement:
  `image px × meterByPx / baseMap.meterByPx`. Without one of the two scales the
  image gets a default footprint (`getImageAnnotationSizeInBaseMapPx`).

## Flows

- **Template**: `Forme 2D › Autre › Image` (`DRAWING_SHAPES`), optional default
  image + `meterByPx` (`FormAnnotationTemplateVariantBlock`).
- **Placement** (`ONE_CLICK`): the click is the image centre. The 1-click →
  bbox conversion lives in `useHandleCommitDrawing` because the image may only
  arrive with the resumed deferred commit: a template without a default image
  arms the `IMAGE_PICK` commit interceptor (`getImagePickDraftProps`) whose
  dialog (`DialogPickImageOnCommit`) asks for the file. The ghost under the
  cursor (`DrawingLayer`) uses the fresh blob URL or the persisted thumbnail.
- **Drop**: a native drop of image files on the 2D editor (`InteractionLayer.
  handleNativeDrop` → `MainMapEditorV3.handleCommitImageFileDrop` →
  `getImageDropDraftFromFile`) creates one templateless IMAGE annotation per
  file, centred on the drop point (several files cascade by 24 screen px),
  through the same 1-click commit. Only `image/*` files are claimed during
  dragover; other files keep the browser default. A single dropped image is
  selected right away. The dnd-kit `DropZoneLayer` (internal `EXTERNAL_IMAGE`
  drags → MARKER) is a separate path.
- **Selection** (`NodeImageStatic`): drag = move, round handle = rotate (angle
  badge), corner handles = homothetic resize. The overlay toolbar
  (`NodeImageToolbarOverlay`, rendered outside the rotate group) offers:
  - **Mettre à l'échelle**: arms the `IMAGE_SCALE` drawing mode (2-click
    cote on the image, auto-commit like `MEASURE`). `MainMapEditorV3.
    handleImageScaleCommit` stores the cote in `mapEditor.imageScaleDraft`
    and opens `PopperImageScale`; the typed real length rescales the bbox
    about the FIRST clicked point (`applyImageScaleService`,
    `getScaledImageBbox`). Disabled when the base map has no scale.
  - **Changer l'image**: `DialogChangeAnnotationImage`
    (`mapEditor.imageChangeAnnotationId`). The same field sits in the
    Propriétés panel (`FieldAnnotationImage`).
- While `IMAGE_SCALE` is armed, `InteractionLayer` ignores the image's drag /
  resize / rotate handles so both clicks land as cote points.

## 3D viewer

`createImageAnnotation3D` creates a managed root. `ThreedAnnotationLabels`
attaches a camera-facing black photo card below it, preserving visibility
filters and disposal. The card contains the image, label and `labelDescription`.
`imageOrientation3d` selects `VERTICAL` (default, camera-facing sprite with a
fixed world size) or `HORIZONTAL` (double-sided plane parallel to the base
map, following its rotation). In both modes the photo's width and height match
the 2D bbox converted to metres; perspective distance and zoom change its screen
size. The photo touches the card edges, with padding only inside the caption
containing the label and description. Position comes from the bbox centre and `imageLift3d` (metres
above `offsetZ` + 1 cm, default 1 m for vertical cards, 0 for horizontal cards).
Image bytes come from `db.files`, with `imageUrlClient` as fallback.

The properties panel exposes `hasConnector` and `labelDescription`. The
connector's `targetPoint` is an inline normalized coordinate, independent of
the bbox and unrelated to `db.points`. Creation seeds it at the image centre;
legacy rows fall back to their current centre until the first move. Moving,
resizing or rotating the photo leaves this anchor fixed. In 2D, the leader
ends at the rotated image border and the selected target can be dragged.

Click the 3D card to select the IMAGE annotation, then drag to move it in the
camera-facing plane (base map plane for horizontal cards). Hold Shift to constrain movement to the closest displayed
X/Y/Z axis. Moving the target stays in the base map plane. Card movement writes
the normalized bbox XY and `imageLift3d`; the anchor remains fixed. Escape or
pointer cancellation restores the original position without saving. The same
permission checks as 2D apply. Inline IMAGE imports preserve connector, label,
description, orientation and lift and transform the target with the image during placement.

`getEntityWithImagesAsync` keeps one object URL per file row so a hydrated
IMAGE annotation keeps its identity between liveQuery runs (otherwise the 3D
diff would rebuild the card on every emission).

## Display modes: PopperImages, in situ / ex situ, capture

`src/Features/popperImages/` owns how the photos of an editor are displayed.

- `popperImagesSlice` — `displayMode` (`IN_SITU` | `EX_SITU`) and `linkStyle`
  (`LINE` | `NUMBER`), both persisted per device in localStorage
  (`popperImagesSettings`); `collapsed` (panel folded).
- `getImageAnnotationsDisplayIndex(annotations)` — display numbering 1..N of
  the IMAGE annotations (badge on the photo / anchor / tile). Deterministic
  order `orderIndex` → `createdAt` → `id`: moving a photo never renumbers.
  Every host (2D, 3D, capture) calls it on its own displayed list.
- `imageAnnotationSelection` — the veil rule: when the selected item is an
  IMAGE, every other image (photo, leader, anchor dot, badge, tile) gets a
  translucent white veil (`IMAGE_VEIL_*` constants).
- `PopperImages` — floating panel anchored at the RIGHT of the editor box
  (`usePanelResize({ anchor: "right" })`, bottom-left handle), mounted by
  `MainMapEditorV3` / `MainThreedEditor` next to `PopperMapListings` (same
  gates, so never in capture mode). Header: "In situ | Ex situ" toggle +
  "…" menu (link style). Body: 2-column grid of numbered tiles; a tile click
  selects the annotation, the selected tile offers "Fullscreen"
  (`images/components/DialogImageViewer`, wheel zoom + pan + reset).
- `ImagesLinksOverlay` — ex situ + `LINE`: leaders from the tiles (DOM
  rects) to the anchors, via an **anchor projector**
  `{ project(a) → client px | null, getViewportRect(), subscribe(cb) }`:
  `useMapEditor2dAnchorProjector` (camera matrix + base pose,
  `subscribeMapEditorCamera`) and `threedEditor/hooks/useThreedImageAnchorProjector`
  (anchor-dot sprite published in `annotationLabelObjectsStore.imageAnchorsById`,
  `SceneManager.addRenderListener`).

Rendering:

- 2D `NodeImageStatic` receives `imagesDisplayMode / imagesLinkStyle /
  imageDisplayIndex / imageVeiled` through `NodeAnnotationStatic` from
  `StaticMapContent` / `EditedObjectLayer` only (portfolio, grids, elevation
  keep the plain in-situ rendering). In situ: numbered badge at the bbox
  corner + veil. Ex situ: the anchor dot only (TARGET interaction kept:
  click selects, drag moves `targetPoint`) + badge in `NUMBER` style.
- 3D `ThreedAnnotationLabels`: in situ the card canvas carries the badge and
  the veil (`createImageAnnotationCard({ badgeNumber, veiled })`,
  `applyAnnotationMaterialState` never swaps a card's material); ex situ no
  card / leader, the anchor dot always, a `createAnnotationNumberBadgeSprite`
  in `NUMBER` style, and an invisible proxy as the target handle's
  `labelSprite` so the TARGET drag still writes `targetPoint`.

Capture (`ImageModeOverlay`): with `EX_SITU`, `CaptureImagesOverlay` draws
the tiles as floating Paper cards (`foreignObject`, `data-capture-keep`) in
a transparent zone of the frame (`mapEditor.imageModeImagesOverlay`, legend-
like drag / resize with `data-capture-hide` handles,
`resolveImagesOverlayGeometry`, `layoutCaptureImageTiles`), tied to the
anchors by `<line>`s (`LINE`) or by the badges (`NUMBER`). The labels margin
band excludes the zone (`useImageModeLabelsLayout({ imagesCount })`). The
condensed toolbar has a "Photos" select and the Cadrage tab a "Photos"
section (`SectionCaptureImages`). `ButtonSaveCapture` clears an annotation
selection before capturing so no veil / handle reaches the image.
