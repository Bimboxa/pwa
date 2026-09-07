// Placement of a detail baseMap's annotations on a FOLIO_PAGE.
//
// A detail baseMap image is a crop (createdFrom.bboxInRatio, ratios of the
// ROTATED pdfjs viewport) of the PDF page rendered at createdFrom.dpi (see
// renderPageToPngBlob). Annotation coordinates live in that image's pixel
// space (image.imageSize). The folio page is drawn in PDF points with the same
// absolute rotation, so the image maps to the page rect below; an inner svg
// with viewBox = imageSize placed on that rect draws the annotations in place.

const PT_PER_INCH = 72;

// Page dimensions (points, rotated) derived from the detail baseMap alone —
// fallback when the source PDF is not loadable (post-Krto import, deleted
// resource) but the record still knows its dpi + crop + pixel size.
export function getDetailPageDims(record) {
  const createdFrom = record?.createdFrom;
  const imageSize = record?.image?.imageSize;
  if (!createdFrom?.dpi || !imageSize?.width || !imageSize?.height) return null;
  const scale = createdFrom.dpi / PT_PER_INCH;
  const bbox = createdFrom.bboxInRatio;
  const wRatio = bbox ? bbox.x2 - bbox.x1 : 1;
  const hRatio = bbox ? bbox.y2 - bbox.y1 : 1;
  if (!(wRatio > 0) || !(hRatio > 0)) return null;
  return {
    width: imageSize.width / scale / wRatio,
    height: imageSize.height / scale / hRatio,
  };
}

// Rect (page points, SVG top-left coords) covered by the detail image on a
// page of the given dimensions.
export default function getFolioAnnotationsRect(record, pageDims) {
  if (!record || !pageDims?.width || !pageDims?.height) return null;
  const bbox = record.createdFrom?.bboxInRatio;
  if (!bbox)
    return { x: 0, y: 0, width: pageDims.width, height: pageDims.height };
  const width = (bbox.x2 - bbox.x1) * pageDims.width;
  const height = (bbox.y2 - bbox.y1) * pageDims.height;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: bbox.x1 * pageDims.width,
    y: bbox.y1 * pageDims.height,
    width,
    height,
  };
}
