import getAnnotationBBox from "../../annotations/utils/getAnnotationBbox.js";

import {
  ALIGN_BOTTOM,
  ALIGN_CENTER_H,
  ALIGN_LEFT,
  ALIGN_MIDDLE,
  ALIGN_RIGHT,
  ALIGN_TOP,
} from "../constants/alignModes.js";

const EPSILON_PX = 1e-6;

// Pixel bbox of a resolved annotation. OBJECT_3D carries no points: its
// resolved `bbox` is its footprint. Known limit (getAnnotationBBox): the box
// of a line / surface is the one of its vertices (no arc bulge, no stroke).
function getBbox(annotation) {
  const bbox = getAnnotationBBox(annotation) ?? annotation?.bbox;
  if (!bbox) return null;
  const { x, y, width, height } = bbox;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

// Translation (px) to apply to each resolved annotation so the selection is
// aligned on `mode`, the reference being the bounding box of `annotations`.
// Returns Map<annotationId, { x, y }>; an annotation already in place (or
// without any measurable bbox) has no entry.
export default function getAlignDeltas({ annotations, mode }) {
  const deltas = new Map();
  const boxes = (annotations ?? [])
    .map((annotation) => ({ id: annotation.id, bbox: getBbox(annotation) }))
    .filter((entry) => entry.bbox);
  if (boxes.length < 2) return deltas;

  const minX = Math.min(...boxes.map(({ bbox }) => bbox.x));
  const maxX = Math.max(...boxes.map(({ bbox }) => bbox.x + bbox.width));
  const minY = Math.min(...boxes.map(({ bbox }) => bbox.y));
  const maxY = Math.max(...boxes.map(({ bbox }) => bbox.y + bbox.height));

  boxes.forEach(({ id, bbox }) => {
    let x = 0;
    let y = 0;
    if (mode === ALIGN_LEFT) x = minX - bbox.x;
    else if (mode === ALIGN_RIGHT) x = maxX - (bbox.x + bbox.width);
    else if (mode === ALIGN_CENTER_H)
      x = (minX + maxX) / 2 - (bbox.x + bbox.width / 2);
    else if (mode === ALIGN_TOP) y = minY - bbox.y;
    else if (mode === ALIGN_BOTTOM) y = maxY - (bbox.y + bbox.height);
    else if (mode === ALIGN_MIDDLE)
      y = (minY + maxY) / 2 - (bbox.y + bbox.height / 2);
    if (Math.abs(x) < EPSILON_PX && Math.abs(y) < EPSILON_PX) return;
    deltas.set(id, { x, y });
  });

  return deltas;
}
