import sampleScene3dHeightMap from "./sampleScene3dHeightMap.js";

// Height of a SCENE_3D scan above its base map plane (metres) under a point
// of the 2D editor, or null (outside the scan footprint / no surface there).
//
// annotation: RESOLVED (useAnnotationsV2) — `bbox` in px is "stored centre +
// metric footprint", `rotation` in degrees (SVG clockwise about the bbox
// centre), `scene3d.bbox` in metres (scan frame), `offsetZ` the altitude of
// the scan's lowest point above the plan (see createScene3dAnnotation).
// point: {x, y} in the same px space as annotation.bbox.
export default function getScene3dHeightAtPx(annotation, point, heightMap) {
  if (!heightMap) return null;
  const scanPoint = getScene3dScanPointFromPx(annotation, point);
  if (!scanPoint) return null;
  const z = sampleScene3dHeightMap(heightMap, scanPoint.sx, scanPoint.sy);
  if (z === null) return null;
  return (
    (Number(annotation.offsetZ) || 0) + (z - annotation.scene3d.bbox.min[2])
  );
}

// Point of the 2D editor → point of the scan frame ({sx, sy}, metres), or
// null when outside the scan footprint.
export function getScene3dScanPointFromPx(annotation, point) {
  const bbox = annotation?.bbox;
  const sceneBbox = annotation?.scene3d?.bbox;
  if (!bbox?.width || !bbox?.height || !sceneBbox?.min || !sceneBbox?.max)
    return null;

  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const dx = point.x - cx;
  const dy = point.y - cy;
  // undo the SVG rotate(rotation) about the centre
  const theta = ((annotation.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;

  const u = lx / bbox.width + 0.5;
  const v = ly / bbox.height + 0.5;
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;

  // image top = scan +Y
  return {
    sx: sceneBbox.min[0] + u * (sceneBbox.max[0] - sceneBbox.min[0]),
    sy: sceneBbox.max[1] - v * (sceneBbox.max[1] - sceneBbox.min[1]),
  };
}
