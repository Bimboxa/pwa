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
- **Rendering** (`NodeImageStatic`): floating paper — white frame around the
  photo (margin proportional to the print, rounded corners, photo clipped by
  a per-instance `useId` clipPath) and a two-layer CSS `drop-shadow` of
  constant screen size on a group wrapping the rotated one (so the offset
  never turns with the image). No shadow in `printMode` nor while dragged.
  The frame belongs to the draggable group, so it is grabbable; hover /
  selection outlines and the veil follow the frame, the resize handles stay
  on the bbox.
- **Selection** (`NodeImageStatic`): the photo is draggable **only once
  selected** — a mousedown + move on an unselected image only selects it
  (`InteractionLayer` `clickOnly`, same rule as labels and revolution axes).
  Then drag = move, round handle = rotate (angle
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
attaches a camera-facing white "paper" photo card below it (white frame,
rounded corners, canvas-drawn drop shadow in a transparent margin),
preserving visibility filters and disposal. The card contains the image, label and `labelDescription`.
`imageOrientation3d` selects `VERTICAL` (default, camera-facing sprite with a
fixed world size) or `HORIZONTAL` (double-sided plane parallel to the base
map, following its rotation). In both modes the photo's width and height match
the 2D bbox converted to metres; perspective distance and zoom change its screen
size. The photo is inset in the white frame (`frame` + `shadow` margins of
`createImageAnnotationCard`), with padding only inside the caption
containing the label and description; the card's physical size is the photo
size scaled up by those margins so the photo itself keeps its metric size. Position comes from the bbox centre and `imageLift3d` (metres
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

## Display modes: in situ / overlay / print zones, bottom bar, capture

`src/Features/popperImages/` owns how the photos of an editor are displayed.
Three modes (`popperImagesSlice.displayMode`):

| Key           | UI name | Photos are…                                                        |
| ------------- | ------- | ------------------------------------------------------------------ |
| `IN_SITU`     | In situ | drawn on the base map / in the scene                               |
| `EX_SITU`     | Overlay | tiles of the floating `PopperImages` panel                         |
| `PRINT_ZONES` | Zones   | tiles dispatched in 4 bands along the edges of the editor / frame |

Off in situ, only the anchor of each photo stays in the scene. `PRINT_ZONES`
is unrelated to `baseMap.printZone` (the print sheet of a base map).

- `popperImagesSlice` — `displayMode`, the two independent tile ↔ anchor
  links `linkLine` / `linkNumber`, the print zones tile size
  (`printZonesTileSizeMode` `AUTO` | `FIXED`, `printZonesTileSizePx`), the
  print zones resized by hand (`printZonesZones`) and the overlay panel
  columns (`panelColumns` 1 | 2), all persisted per device in localStorage
  (`popperImagesSettings`). Session only: `photosHidden`, `collapsed` (panel
  folded), `imagesCount` (photos of the active editor, published by
  `MainMapEditorV3` / `MainThreedEditor`), `printZonesCaptureInsets` and
  `printZonesPinnedSideById` (photos pinned to a zone).
- `SectionImagesBottomBarControls` (in `BottomBarDesktop`, left of the base
  maps controls) — the only place of the controls: "Photos" + count pill
  (toggles `photosHidden`), `SelectorImagesDisplayMode` (3 icon buttons),
  the "Ligne" / "Numéro" toggle buttons (disabled in situ) and "…"
  (`DialogImagesDisplayOptions`: tile size, reset of the resized zones). Shown for the 2D / 3D editors
  when `imagesCount > 0`, hidden under a capture framing.
- `getImageAnnotationsDisplayIndex(annotations)` — display numbering 1..N of
  the IMAGE annotations (badge on the photo / anchor / tile). Deterministic
  order `orderIndex` → `createdAt` → `id`: moving a photo never renumbers.
  Every host (2D, 3D, capture) calls it on its own displayed list.
- `imageAnnotationSelection` — the veil rule: when the selected item is an
  IMAGE, every other image (photo, leader, anchor dot, badge, tile) gets a
  translucent white veil (`IMAGE_VEIL_*` constants).
- **Anchor projector** — the contract every tile ↔ anchor link relies on:
  `{ project(a) → client px | null, getViewportRect(), subscribe(cb) }`:
  `useMapEditor2dAnchorProjector` (camera matrix + base pose,
  `subscribeMapEditorCamera`) and `threedEditor/hooks/useThreedImageAnchorProjector`
  (anchor-dot sprite published in `annotationLabelObjectsStore.imageAnchorsById`,
  `SceneManager.addRenderListener`).

### Overlay (`EX_SITU`)

- `PopperImages` — floating panel anchored at the RIGHT of the editor box
  (`usePanelResize({ anchor: "right" })`, bottom-left handle), mounted by
  `MainMapEditorV3` / `MainThreedEditor` next to `PopperMapListings` (same
  gates, so never in capture mode). Renders in this mode only; its header is
  the title + a 2-button toggle for a 1 or 2-column grid (`panelColumns`).
  Body: grid of numbered tiles; a tile click selects the annotation, the
  selected tile offers "Fullscreen" (`images/components/DialogImageViewer`,
  wheel zoom + pan + reset).
- `ImagesLinksOverlay` — leaders from the tiles (DOM rects) to the anchors:
  all of them with "Ligne", only the selected photo's otherwise
  (`onlySelected`).

### Print zones (`PRINT_ZONES`)

- `layoutImagePrintZones` (pure, tested) — 4 **fixed** zones along the edges
  of a rect (TOP / BOTTOM own the corners), one tile thick by default; a
  tile keeps the clamped aspect ratio of its photo along the zone.
  1. `reserved` rects cut the zones (each keeps its longest free segment);
     `zones[side] = { thickness, startInset, endInset }` (px, insets from the
     rect borders) overrides what the user resized. A zone never depends on
     the anchors.
  2. Assignment: a photo of `pinnedSideById` goes to its zone. The others,
     by decreasing regret, take the cheapest zone: cost = distance anchor →
     edge + load penalty (`BALANCE_WEIGHT`, `OVERFLOW_WEIGHT`) − a bonus for
     the zone the photo is already in (`previousSideById`,
     `STICKY_WEIGHT`): a photo only changes zone on a clear win.
  3. Inside a zone: sorted by anchor (leaders do not cross), packed as one
     group **centred in the zone** — the tiles do not follow the anchors.
     When the group does not fit, the tiles of that zone shrink (`AUTO`,
     down to `PRINT_ZONES_TILE_SIZE_MIN_PX`); past that, or in `FIXED` size,
     they overlap evenly.
- `useImagePrintZonesLayout` — live driver shared by the editors and the
  capture: the anchors follow the camera frame by frame (the leaders stick),
  the layout runs again once the camera has been still for 250 ms, fed with
  its previous result (so only a zone change can move a tile). Returns the
  tiles, the zone rects and the layout rect. `keepOutside` (editors): a photo
  whose anchor is off-rect keeps its tile; in a capture it gets none.
- `ImagesPrintZonesOverlay` — the tiles in the editors (2D and 3D), rendered
  in the floating panels frame (`PortalEditorFloatingPanels`), under the
  panels. Rect = editor viewport minus the open right drawer. Reserved =
  the floating panels of the layout host + every element tagged
  `data-print-zones-avoid` (editor corner controls). Tile click = select,
  selected tile = "Fullscreen" and its leader even with "Ligne" off, hovered
  tile = pin toggle (`printZonesPinnedSideById[id] = side`, session only).
  Hovering an occupied zone (window `mousemove`, the editor keeps the mouse)
  draws its dashed outline and 3 handles: thickness on the inner edge, and
  the two ends (`setPrintZonesZone`). The capture uses the pins but not the
  resized zones (its frame is another rect).

### Rendering in the scene

- 2D `NodeImageStatic` receives `imagesDisplayMode / imagesLinkNumber /
  imageDisplayIndex / imageVeiled` through `NodeAnnotationStatic` from
  `StaticMapContent` / `EditedObjectLayer` only (portfolio, grids, elevation
  keep the plain in-situ rendering). In situ: numbered badge at the bbox
  corner + veil. Any other mode: the anchor dot only (TARGET interaction
  kept: click selects, drag moves `targetPoint`) + badge with "Numéro".
- 3D `ThreedAnnotationLabels`: in situ the card canvas carries the badge and
  the veil (`createImageAnnotationCard({ badgeNumber, veiled })`,
  `applyAnnotationMaterialState` never swaps a card's material); any other
  mode no card / leader, the anchor dot always, a
  `createAnnotationNumberBadgeSprite` with "Numéro", and an invisible proxy
  as the target handle's `labelSprite` so the TARGET drag still writes
  `targetPoint`.

### Capture (`ImageModeOverlay`)

The bottom bar controls are hidden while framing: the Cadrage tab
(`SectionCaptureImages`) and the condensed toolbar ("Mode photos" select,
"Photos" show / hide button) carry the display mode.

- `EX_SITU`: `CaptureImagesOverlay` draws the tiles (`CaptureImageTileCard`:
  Paper cards in a `foreignObject`, `data-capture-keep`) in a transparent
  zone of the frame (`mapEditor.imageModeImagesOverlay`, legend-like drag /
  resize with `data-capture-hide` handles, `resolveImagesOverlayGeometry`,
  `layoutCaptureImageTiles`).
- `PRINT_ZONES`: `CaptureImagePrintZonesOverlay` draws the same cards along
  the 4 edges of the frame (`useImagePrintZonesLayout`), fully automatic,
  clear of the frame elements tagged `data-print-zones-avoid` (legend,
  cartouche, title banner, logo).
- Both tie the tiles to the anchors by `<line>`s ("Ligne") and / or badges
  ("Numéro"). The labels margin band excludes the photos
  (`useImageModeLabelsLayout({ imagesCount })`: the overlay zone, or the
  occupied bands published in `printZonesCaptureInsets`).
- `ButtonSaveCapture` clears an annotation selection before capturing so no
  veil / handle reaches the image.
