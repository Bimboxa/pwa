/**
 * The metrics createAnnotationObject3D needs to project an annotation's pixel
 * coordinates into its basemap-LOCAL meter frame. Position/rotation are not
 * part of it: the pose is carried by the parent basemap Group.
 *
 * Annotation pixel coords are resolved in the REFERENCE frame
 * (BaseMap.getImageSize = refWidth/refHeight for versioned maps), NOT the
 * active version's image size — using the version size would shift every
 * annotation when it differs from the original image.
 *
 * Accepts either a BaseMap instance or a plain record (imagesManager.baseMapsMap
 * holds both).
 *
 * @param {Object} baseMap
 * @returns {{imageWidth:number, imageHeight:number, meterByPx:number, orientation:string}|null}
 */
export default function getBaseMapForRender(baseMap) {
  if (!baseMap) return null;
  const refSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  return {
    imageWidth: refSize?.width || 1,
    imageHeight: refSize?.height || 1,
    meterByPx: baseMap.meterByPx || 0.01,
    // Needed by REVOLUTION: the revolution axis is the base map normal,
    // which is local +Z for HORIZONTAL and +Y for VERTICAL base maps.
    orientation: baseMap.orientation,
  };
}
