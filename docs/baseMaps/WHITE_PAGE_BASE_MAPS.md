# White page base maps (« Page blanche »)

A white page is a base map with **no image file**. Nothing is written to
`db.files`: the page is described by its size and scale, and its image is
synthesized in memory each time the base map is hydrated.

A metric grid can be shown over it (and over any other base map) with the
« Grille » command — a view setting, not part of the base map: see
`docs/editorGrid/README.md`.

## Storage model

On the `baseMaps` record:

```js
whitePage: {}                   // marker: created with no image file
image: {
  isImage: true,
  isWhitePage: true,
  imageSize: { width, height }, // px, 150 DPI paper raster size
  thumbnail,                    // small static SVG data url (white sheet)
}                               // NO fileName
refWidth, refHeight             // = image.imageSize
meterByPx                       // from the page scale (1:N)
printZone                       // the whole page (except "carré")
```

The initial `baseMapVersions` row holds the same `image` (no `fileName`).

`imageSize` + `meterByPx` are all the coordinate pipeline needs (normalized
points, fit-to-view, print zone, Krto zip, sync): none of these read pixels.

## Synthesized image

`BaseMap.createFromRecord` detects a white page image
(`testIsWhitePageImage`: `isWhitePage` and no `fileName`) in both the versions
path and the legacy path, and builds an `ImageObject` with
`createWhitePageImage` (`src/Features/baseMaps/utils/createWhitePageImage.js`):

`imageUrlClient` is an **SVG data url** holding one white rect (a few hundred
bytes).

Because the result is an ordinary image url, every consumer of
`baseMap.getUrl()` works unchanged: the 2D `<image>`, the textured plane of the
3D editor, print, portfolio, base maps grid, thumbnails.

## Creating one

Pass `whitePage: { width, height }` instead of a file:

- `useCreateBaseMapFromImage` (dialog, quick A3 button, revolution section
  pages);
- `useCreateBaseMaps` (batch creation, `BLANK_PAGE` items of a configuration).

`getBlankBaseMapGeometry` still gives the pixel size and `meterByPx` from the
paper format and the scale.

## Changing the scale

The sheet keeps its pixel size: changing the 1:N scale of a white page only
changes `meterByPx` (and the `scale` of a print zone that still covers the
whole sheet). `setWhitePageScaleService({ baseMapId, scale })`
(`src/Features/baseMaps/services/`) does it; `utils/whitePageScale.js` holds
the scale ↔ resolution conversions.

Points are stored normalized: every annotation keeps its place on the sheet
and takes the new real size. A caller that needs fixed real dimensions
re-places its annotations itself — e.g. the pool initialisation centres the
pool on its blank plan and picks the finest scale that holds it
(`Data/edx/.../piscine/recenterPiscinePlan.js`).

## Pixel consumers

An SVG url has no pixels worth reading and **cannot be decoded** by
`createImageBitmap` (OpenCV worker, assistant snapshot). Use
`testIsWhitePageUrl(url)` to detect it:

- **Surface drop (flood fill)**: `InteractionLayer` forces `ignoreBaseMap` and
  sends no `imageUrl`; the worker (`detectContoursAsync`) then takes the image
  size from the exclusion mask (nothing to fetch nor decode).
- **Colour picker**: returns white without calling the worker.
- **Any other OpenCV call** with an `imageUrl` payload: `opencvService`
  swaps the SVG url for a PNG raster (`rasterizeWhitePageUrl`, cached).
- **`getBaseMapBlob`** (assistant snapshot, DXF export): returns that PNG
  raster.

`baseMap.isWhitePage()` tells whether the **active** image is a synthesized
white page (false once a real image version is active).

## Traps

- Pages created before this model are plain PNG base maps: no `whitePage`
  field. Nothing marks them, so they are not migrated.
- Code that reads `db.files` from `image.fileName` on a raw record gets
  nothing for a white page — go through `BaseMap.createFromRecord` /
  `getUrl()` instead.
- The OpenCV worker lives in `public/`: a full reload is needed after editing
  it.
