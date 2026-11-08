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
