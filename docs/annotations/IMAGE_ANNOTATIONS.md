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

`createAnnotationObject3D` has an `IMAGE` case (`createImageAnnotation3D`):
a `PlaneGeometry` sized to the bbox footprint in metres, centred with
`pixelToWorld`, rotated by `-rotation` about basemap-local Z (same pose as
OBJECT_3D), lifted by `offsetZ` + 1 cm above the base map plane. The
`MeshBasicMaterial` is transparent with `alphaTest` so PNG alpha cuts out the
picture. The texture is loaded from `db.files` by `fileName` (fallback:
`imageUrlClient`), cached per `fileName + fileUpdatedAt` and shared across
rebuilds; the plane is returned hidden and shown through `onAsyncLoaded`.

`getEntityWithImagesAsync` keeps one object URL per file row so a hydrated
IMAGE annotation keeps its identity between liveQuery runs (otherwise the 3D
diff would rebuild the plane on every emission).
