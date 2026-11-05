import ImageObject from "Features/images/js/ImageObject";

// White page base map: NO file in db.files. The image is synthesized in
// memory at hydration time (BaseMap.createFromRecord) as an SVG data URL —
// a white rect plus the optional metric grid — so every consumer of
// baseMap.getUrl() (2D <image>, 3D texture, print, portfolio…) keeps working.
// See docs/baseMaps/WHITE_PAGE_BASE_MAPS.md.

// 1 m squares, one heavier line every 5 (squared paper).
export const DEFAULT_WHITE_PAGE_GRID = { stepM: 1, majorEvery: 5 };

const MINOR_COLOR = "#dbe3ec";
const MAJOR_COLOR = "#aebccb";
// Below this spacing (image px) a family of lines is dropped: it would only
// produce a grey wash and thousands of path segments.
const MIN_STEP_PX = 4;

const round = (v) => Math.round(v * 100) / 100;

const SVG_DATA_URL_PREFIX = "data:image/svg+xml";

function toSvgDataUrl(svg) {
  return `${SVG_DATA_URL_PREFIX};charset=utf-8,${encodeURIComponent(svg)}`;
}

// Whether a base map image url is a synthesized white page. Such a url holds
// no pixels worth reading, and the OpenCV worker cannot decode it
// (createImageBitmap rejects SVG blobs): pixel consumers must bypass it.
export function testIsWhitePageUrl(url) {
  return typeof url === "string" && url.startsWith(SVG_DATA_URL_PREFIX);
}

// Grid lines anchored on the bottom-left corner of the page (plan
// convention: origin bottom-left, Y up). Returns { minor, major, minorWidth,
// majorWidth } with the two path `d` strings, or null without a usable grid.
function buildGridPaths({ width, height, meterByPx, grid }) {
  const stepM = Number(grid?.stepM);
  if (!(stepM > 0) || !(meterByPx > 0)) return null;

  const stepPx = stepM / meterByPx;
  const majorEvery = Math.max(1, Math.round(Number(grid?.majorEvery) || 1));
  const majorStepPx = stepPx * majorEvery;
  if (majorStepPx < MIN_STEP_PX) return null;
  const showMinor = stepPx >= MIN_STEP_PX;

  let minor = "";
  let major = "";
  const add = (k, d) => {
    if (k % majorEvery === 0) major += d;
    else if (showMinor) minor += d;
  };

  // The page edges (k = 0) are not drawn.
  for (let k = 1; k * stepPx < width; k++) {
    add(k, `M${round(k * stepPx)} 0V${height}`);
  }
  for (let k = 1; k * stepPx < height; k++) {
    add(k, `M0 ${round(height - k * stepPx)}H${width}`);
  }

  // Stroke widths follow the square size so the grid keeps the same look
  // whatever the page scale (1:10 … 1:100).
  const minorWidth = round(Math.min(2, Math.max(0.75, stepPx / 120)));
  return { minor, major, minorWidth, majorWidth: round(minorWidth * 2) };
}

export function getWhitePageSvgDataUrl({ imageSize, meterByPx, grid }) {
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!(width > 0) || !(height > 0)) return null;

  const paths = grid
    ? buildGridPaths({ width, height, meterByPx, grid })
    : null;

  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="#ffffff"/>`;
  if (paths?.minor) {
    svg += `<path d="${paths.minor}" fill="none" stroke="${MINOR_COLOR}" stroke-width="${paths.minorWidth}"/>`;
  }
  if (paths?.major) {
    svg += `<path d="${paths.major}" fill="none" stroke="${MAJOR_COLOR}" stroke-width="${paths.majorWidth}"/>`;
  }
  svg += "</svg>";

  return toSvgDataUrl(svg);
}

// Small static thumbnail stored on the record (raw-record readers that never
// hydrate the image): a white sheet with a thin border, no grid.
export function getWhitePageThumbnail({ width, height }) {
  if (!(width > 0) || !(height > 0)) return null;
  const strokeWidth = round(Math.max(width, height) / 100);
  return toSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff" stroke="${MAJOR_COLOR}" stroke-width="${strokeWidth}"/>` +
      "</svg>"
  );
}

// `image` field of a white page record / of its initial version: metadata
// only, no fileName (nothing in db.files).
export function getWhitePageImageField({ width, height }) {
  return {
    isImage: true,
    isWhitePage: true,
    imageSize: { width, height },
    thumbnail: getWhitePageThumbnail({ width, height }),
  };
}

// Whether a stored image (record.image / version.image) is a white page to
// synthesize — a real file attached later wins.
export function testIsWhitePageImage(image) {
  return Boolean(image?.isWhitePage) && !image?.fileName;
}

// Everything the synthesized image depends on: a change of grid option or of
// scale (meterByPx) yields a new key, hence a new image.
export function getWhitePageCacheKey({ imageSize, meterByPx, grid }) {
  return [
    "whitePage",
    imageSize?.width,
    imageSize?.height,
    meterByPx,
    grid?.stepM ?? "",
    grid?.majorEvery ?? "",
  ].join(":");
}

export default function createWhitePageImage({ imageSize, meterByPx, grid }) {
  const url = getWhitePageSvgDataUrl({ imageSize, meterByPx, grid });
  if (!url) return null;
  const image = new ImageObject({
    imageSize,
    imageUrlClient: url,
    // Same SVG: it scales down as is in the lists, grid included.
    thumbnail: url,
  });
  image.isWhitePage = true;
  return image;
}
