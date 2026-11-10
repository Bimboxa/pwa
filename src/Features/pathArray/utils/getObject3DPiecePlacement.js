import getObject3DLengthAxis from "./getObject3DLengthAxis.js";

const FALLBACK_FOOTPRINT_M = 0.5;
// A piece this close to the object's own length is not worth a cut.
const CUT_TOLERANCE_M = 1e-3;

// Placement of one GLB object on one piece of a path array (« Calepinage »):
// the glTF ORIGIN sits on `start`, the object's length axis runs towards
// `end`, and the object is CUT at the piece length when the piece is shorter
// than the object.
//
// OBJECT_3D rows are bbox hosts (no db.points): the result is the footprint
// of the KEPT part — `bbox` normalized [0..1] vs `imageSize`, top-left of the
// unrotated rectangle — and `rotation` in degrees around the bbox center
// (same convention as NodeObject3DStatic / createObject3DAnnotation: model X
// on image x, model Z on image y, clockwise on screen).
//
// `start` / `end` are in pixels. Returns
// { bbox, rotation, object3DCut: { axis, max } | null } or null.
export default function getObject3DPiecePlacement({
  object3D,
  start,
  end,
  meterByPx,
  imageSize,
}) {
  if (!(meterByPx > 0) || !imageSize?.width || !imageSize?.height) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthPx = Math.hypot(dx, dy);
  if (!(lengthPx > 0)) return null;
  const lengthM = lengthPx * meterByPx;

  const box = object3D?.bbox ?? {};
  const width =
    Number(box.width) > 0 ? Number(box.width) : FALLBACK_FOOTPRINT_M;
  const depth =
    Number(box.depth) > 0 ? Number(box.depth) : FALLBACK_FOOTPRINT_M;
  const min = {
    x: Number.isFinite(box.min?.x) ? box.min.x : -width / 2,
    z: Number.isFinite(box.min?.z) ? box.min.z : -depth / 2,
  };
  const max = { x: min.x + width, z: min.z + depth };

  const axis = getObject3DLengthAxis(object3D);
  const needsCut = lengthM < max[axis] - CUT_TOLERANCE_M && lengthM > min[axis];
  const keptMax = { ...max };
  if (needsCut) keptMax[axis] = lengthM;

  // Center of the kept footprint in model coordinates (m, from the origin).
  const cx = (min.x + keptMax.x) / 2;
  const cz = (min.z + keptMax.z) / 2;

  // Image-space unit vectors of the model X and Z axes after rotation.
  const pathAngle = Math.atan2(dy, dx);
  const theta = axis === "x" ? pathAngle : pathAngle - Math.PI / 2;
  const ux = { x: Math.cos(theta), y: Math.sin(theta) };
  const uz = { x: -Math.sin(theta), y: Math.cos(theta) };

  const centerPx = {
    x: start.x + (cx * ux.x + cz * uz.x) / meterByPx,
    y: start.y + (cx * ux.y + cz * uz.y) / meterByPx,
  };
  const widthPx = (keptMax.x - min.x) / meterByPx;
  const heightPx = (keptMax.z - min.z) / meterByPx;

  const rotation = ((((theta * 180) / Math.PI) % 360) + 360) % 360;

  return {
    bbox: {
      x: (centerPx.x - widthPx / 2) / imageSize.width,
      y: (centerPx.y - heightPx / 2) / imageSize.height,
      width: widthPx / imageSize.width,
      height: heightPx / imageSize.height,
    },
    rotation,
    object3DCut: needsCut ? { axis, max: lengthM } : null,
  };
}
