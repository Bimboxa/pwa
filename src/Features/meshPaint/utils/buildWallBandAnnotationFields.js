import roundForDisplay from "../../threedDrawing/utils/roundForDisplay.js";

// A matched floor run (matchWallFaceToGroundPolygons, px) → the geometry
// fields of the vertical surface annotation the brush creates on a thick
// wall: an OPEN (or closed) POLYLINE band, the exact conventions of the
// SURFACES_VERTICALES procedure's emit / computeAutoWallChains:
//
//   flat floor:   offsetZ = floor, height = top − floor, offsets 0;
//   sloped floor: offsetZ = the polygon's baseZ, height = 0 and per vertex
//                 offsetBottom = floor − baseZ, offsetTop = top − baseZ
//                 (absolute — the 3D wall builder reads bottom = offsetZ +
//                 offsetBottom, top = offsetZ + height + offsetTop).
//
// Points come back normalized to the base map image (db.points convention).
// Pure: node-testable.

export default function buildWallBandAnnotationFields(
  run,
  { imageWidth, imageHeight }
) {
  if (!(run?.points?.length >= 2)) return null;
  const toNormalized = (p) => ({ x: p.x / imageWidth, y: p.y / imageHeight });

  if (!run.sloped) {
    const bottom = run.points[0].bottomZ;
    const height = run.topZ - bottom;
    if (!(height > 0)) return null;
    return {
      points: run.points.map((p) => ({
        ...toNormalized(p),
        offsetBottom: 0,
        offsetTop: 0,
      })),
      offsetZ: roundForDisplay(bottom),
      height: roundForDisplay(height),
      closeLine: Boolean(run.closeLine),
    };
  }

  const baseZ = Number(run.baseZ) || 0;
  return {
    points: run.points.map((p) => {
      const bottom = p.bottomZ;
      const top = Math.max(p.topZ ?? run.topZ, bottom);
      return {
        ...toNormalized(p),
        offsetBottom: roundForDisplay(bottom - baseZ),
        offsetTop: roundForDisplay(top - baseZ),
      };
    }),
    offsetZ: roundForDisplay(baseZ),
    height: 0,
    closeLine: Boolean(run.closeLine),
  };
}
