# White page base maps (« Page blanche »)

A white page is a base map with **no image file**. Nothing is written to
`db.files`: the page is described by its size and scale, and its image is
synthesized in memory each time the base map is hydrated.

It also carries an optional **metric grid** (squared paper: 1 m squares, one
heavier line every 5).

## Storage model

On the `baseMaps` record:

```js
whitePage: { grid: null | { stepM: 1, majorEvery: 5 } }
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

- `imageUrlClient` is an **SVG data url**: a white rect plus two `<path>`
  (minor / major grid lines), a few KB at most;
- the grid step in px is `stepM / meterByPx`, lines are anchored on the
  **bottom-left** corner of the page;
- a family of lines closer than 4 px is dropped.

Because the result is an ordinary image url, every consumer of
`baseMap.getUrl()` works unchanged: the 2D `<image>`, the textured plane of the
3D editor, print, portfolio, base maps grid, thumbnails. The grid is part of
the page, so it shows (and prints) wherever the base map does.

The cache key (`getWhitePageCacheKey`) covers the size, `meterByPx` and the
grid options: toggling the grid or recalibrating the scale yields a new url,
which is what makes the 2D view and the 3D plane (`getPlaneSignature` includes
the url) refresh.

## Creating one

Pass `whitePage: { width, height, grid }` instead of a file:

- `useCreateBaseMapFromImage` (dialog, quick A3 button, revolution section
  pages);
- `useCreateBaseMaps` (batch creation, `BLANK_PAGE` items of a configuration).

`getBlankBaseMapGeometry` still gives the pixel size and `meterByPx` from the
paper format and the scale.

The grid is toggled afterwards from the base map properties panel
(`SectionBaseMapWhitePage`).

## Pixel consumers

An SVG url has no pixels worth reading and **cannot be decoded** by
`createImageBitmap` (OpenCV worker, assistant snapshot). Use
`testIsWhitePageUrl(url)` to detect it:

- **Surface drop (flood fill)**: `InteractionLayer` forces `ignoreBaseMap` and
  sends no `imageUrl`; the worker (`detectContoursAsync`) then takes the image
  size from the exclusion mask. This is required for correctness, not only
  speed: the grid lines would otherwise act as barriers.
- **Colour picker**: returns white without calling the worker.
- **Any other OpenCV call** with an `imageUrl` payload: `opencvService`
  swaps the SVG url for a PNG raster (`rasterizeWhitePageUrl`, cached).
- **`getBaseMapBlob`** (assistant snapshot, DXF export): returns that PNG
  raster.

`baseMap.isWhitePage()` tells whether the **active** image is a synthesized
white page (false once a real image version is active).

## Traps

- Pages created before this model are plain PNG base maps: no `whitePage`
  field, no grid option. Nothing marks them, so they are not migrated.
- Code that reads `db.files` from `image.fileName` on a raw record gets
  nothing for a white page — go through `BaseMap.createFromRecord` /
  `getUrl()` instead.
- The OpenCV worker lives in `public/`: a full reload is needed after editing
  it.
