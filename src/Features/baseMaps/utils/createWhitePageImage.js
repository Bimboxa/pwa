import ImageObject from "Features/images/js/ImageObject";

// White page base map: NO file in db.files. The image is synthesized in
// memory at hydration time (BaseMap.createFromRecord) as an SVG data URL —
// a plain white rect — so every consumer of baseMap.getUrl() (2D <image>, 3D
// texture, print, portfolio…) keeps working.
// See docs/baseMaps/WHITE_PAGE_BASE_MAPS.md.

// Also the border of the white page planes in 3D (baseMapBorder).
export const WHITE_PAGE_BORDER_COLOR = "#aebccb";

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

export function getWhitePageSvgDataUrl({ imageSize }) {
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!(width > 0) || !(height > 0)) return null;
  return toSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff"/>` +
      "</svg>"
  );
}

// Small static thumbnail stored on the record (raw-record readers that never
// hydrate the image): a white sheet with a thin border.
export function getWhitePageThumbnail({ width, height }) {
  if (!(width > 0) || !(height > 0)) return null;
  const strokeWidth = Math.round(Math.max(width, height)) / 100;
  return toSvgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
      `<rect width="${width}" height="${height}" fill="#ffffff" stroke="${WHITE_PAGE_BORDER_COLOR}" stroke-width="${strokeWidth}"/>` +
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

// Everything the synthesized image depends on.
export function getWhitePageCacheKey({ imageSize }) {
  return ["whitePage", imageSize?.width, imageSize?.height].join(":");
}

export default function createWhitePageImage({ imageSize }) {
  const url = getWhitePageSvgDataUrl({ imageSize });
  if (!url) return null;
  const image = new ImageObject({
    imageSize,
    imageUrlClient: url,
    thumbnail: getWhitePageThumbnail(imageSize),
  });
  image.isWhitePage = true;
  return image;
}
