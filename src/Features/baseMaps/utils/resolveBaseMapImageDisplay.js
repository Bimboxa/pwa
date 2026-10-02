import {
  BASE_MAPS_IMAGE_MODE,
  FADED_IMAGE_OPACITY,
} from "../constants/baseMapsImageMode";

// Effective 2D display of a base map image: the global image mode
// (viewers.baseMapsImageMode) layered over the editor's own settings.
// NONE hides the image, FADED forces a light grey image, FULL keeps the
// editor values as they are.
export default function resolveBaseMapImageDisplay({
  imageMode,
  hideImage = false,
  opacity = 1,
  grayScale = false,
}) {
  const isFaded = imageMode === BASE_MAPS_IMAGE_MODE.FADED;
  return {
    hideImage: Boolean(hideImage) || imageMode === BASE_MAPS_IMAGE_MODE.NONE,
    opacity: isFaded ? FADED_IMAGE_OPACITY : opacity,
    grayScale: isFaded || Boolean(grayScale),
  };
}
