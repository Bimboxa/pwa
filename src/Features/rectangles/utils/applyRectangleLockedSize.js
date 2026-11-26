import getRectangleSizeLocks from "./getRectangleSizeLocks";
import getRectangleSizeInPx from "./getRectangleSizeInPx";

// Read-time rule of a RECTANGLE: a dimension locked by the template replaces
// the stored one, around the CENTRE of the stored bbox (so a rotated
// rectangle does not drift when the template value changes). An unlocked
// dimension keeps the annotation's own value.
//
// `bbox` is in base map pixels. Returns the same object when nothing changes.

export default function applyRectangleLockedSize({
  bbox,
  templateProps,
  meterByPx,
}) {
  if (!bbox) return bbox;
  const { lockedWidth, lockedHeight } = getRectangleSizeLocks(templateProps);
  if (!lockedWidth && !lockedHeight) return bbox;

  const sizePx = getRectangleSizeInPx({
    size: templateProps.size,
    sizeUnit: templateProps.sizeUnit,
    meterByPx,
  });

  const result = { ...bbox };
  if (lockedWidth && sizePx.width !== null) {
    result.x = bbox.x + (bbox.width - sizePx.width) / 2;
    result.width = sizePx.width;
  }
  if (lockedHeight && sizePx.height !== null) {
    result.y = bbox.y + (bbox.height - sizePx.height) / 2;
    result.height = sizePx.height;
  }
  return result;
}
