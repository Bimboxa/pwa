// Scale and anchor of the satellite image the AI fetched from the IGN WMS,
// recomputed from the request (crs + bbox) and the real image size: the
// scale is never taken from the model.

import {
  getCcScaleFactor,
  unprojectFromCc,
} from "../../satelliteMap/utils/ccProjection.js";

// bbox aspect vs pixel aspect: beyond, the server stretched one axis
const MAX_ASPECT_GAP = 0.005;

/**
 * @param {Object} params
 * @param {string} params.crs - Lambert CC zone, EPSG:3942 … EPSG:3950
 * @param {{minx, miny, maxx, maxy}} params.bbox - metres, CC grid
 * @param {number} params.width - pixels of the image actually used
 * @param {number} params.height
 * @returns {{meterByPx, scaleFactor, centerLatLng, topLeftLatLng}}
 * @throws when the image does not have the aspect of the bbox
 */
export default function getSatelliteReferenceGeometry({
  crs,
  bbox,
  width,
  height,
}) {
  const bboxW = bbox.maxx - bbox.minx;
  const bboxH = bbox.maxy - bbox.miny;
  const gap = Math.abs(bboxW / width / (bboxH / height) - 1);
  if (gap > MAX_ASPECT_GAP)
    throw new Error(
      `l'image satellite (${width} × ${height} px) n'a pas les proportions de sa bbox`
    );

  const centerLatLng = unprojectFromCc(crs, {
    x: (bbox.minx + bbox.maxx) / 2,
    y: (bbox.miny + bbox.maxy) / 2,
  });
  const scaleFactor = getCcScaleFactor(crs, centerLatLng);

  return {
    meterByPx: bboxW / width / scaleFactor,
    scaleFactor,
    centerLatLng,
    topLeftLatLng: unprojectFromCc(crs, { x: bbox.minx, y: bbox.maxy }),
  };
}
