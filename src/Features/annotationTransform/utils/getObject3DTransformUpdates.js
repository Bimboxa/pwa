import { roundOffsetZ } from "../../annotationMesh3d/utils/mesh3dFrame.js";
import {
  bboxCenterPx,
  bboxHostMoveAffine,
  bboxHostRotationAffine,
} from "../../meshPaint/utils/buildBboxHostAffine.js";

// New STORED placement of OBJECT_3D annotations (imported GLB models) after
// a « Déplacer » / « Tourner » transform — the bbox-type twin of
// getTransformPointUpdates / getFreeTextMoveUpdates. An OBJECT_3D has no
// db.points: its plan placement is `bbox` (normalized in db, PIXELS once
// resolved by useAnnotationsV2) turned by `rotation` (degrees, clockwise on
// screen) about the bbox centre, at `offsetZ` metres above the plan.
//
// transform (pixel frame, y down — the convention of getTransformPointUpdates):
//   { kind: "MOVE", deltaPx: {x, y}, deltaZ? }     deltaZ: metres (3D snapped
//     drop), added to offsetZ
//   { kind: "ROTATE", pivotPx: {x, y}, angleDeg }  the bbox centre orbits the
//     pivot and the object turns by the same angle (a positive angle turns
//     clockwise on screen — the sign of `rotation`)
//
// annotations: OBJECT_3D annotations resolved in PIXELS; the others are
// ignored. Returns Map annotationId → { fields, affine }:
//   fields: the db row update { bbox (normalized), rotation?, offsetZ? }
//   affine: the pixel affine the object's painted parts must follow
//     (moveMeshPaintsWithBboxHostService)
//
// Pure: node-testable.
export default function getObject3DTransformUpdates({
  annotations,
  transform,
  imageSize,
}) {
  const updates = new Map();
  const width = imageSize?.width;
  const height = imageSize?.height;
  if (!transform || !(width > 0) || !(height > 0)) return updates;

  const isMove = transform.kind === "MOVE" && Boolean(transform.deltaPx);
  const isRotate =
    transform.kind === "ROTATE" &&
    Boolean(transform.pivotPx) &&
    Number.isFinite(transform.angleDeg);
  if (!isMove && !isRotate) return updates;

  const deltaZ = isMove ? Number(transform.deltaZ) || 0 : 0;
  const affine = isMove
    ? bboxHostMoveAffine(transform.deltaPx)
    : bboxHostRotationAffine({
        deltaDeg: transform.angleDeg,
        center: transform.pivotPx,
      });
  const map = (p) => ({
    x: affine.a * p.x + affine.b * p.y + affine.c,
    y: affine.d * p.x + affine.e * p.y + affine.f,
  });

  for (const ann of annotations ?? []) {
    if (ann?.type !== "OBJECT_3D") continue;
    const bbox = ann.bbox;
    if (
      !bbox ||
      !Number.isFinite(bbox.x) ||
      !Number.isFinite(bbox.y) ||
      !(bbox.width >= 0) ||
      !(bbox.height >= 0)
    ) {
      continue;
    }
    // The bbox stays axis-aligned in storage: only its centre moves, the
    // turn goes into `rotation` (NodeObject3DStatic / createObject3DAnnotation
    // both rotate about the bbox centre).
    const center = map(bboxCenterPx(bbox));
    const fields = {
      bbox: {
        x: (center.x - bbox.width / 2) / width,
        y: (center.y - bbox.height / 2) / height,
        width: bbox.width / width,
        height: bbox.height / height,
      },
    };
    if (isRotate) {
      const rotation = (Number(ann.rotation) || 0) + transform.angleDeg;
      fields.rotation = ((rotation % 360) + 360) % 360;
    }
    if (Math.abs(deltaZ) > 1e-9) {
      fields.offsetZ = roundOffsetZ((Number(ann.offsetZ) || 0) + deltaZ);
    }
    updates.set(ann.id, { fields, affine });
  }
  return updates;
}
