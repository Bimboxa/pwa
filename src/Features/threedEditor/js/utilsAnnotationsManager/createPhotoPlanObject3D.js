import { Group, Matrix4, Vector3 } from "three";

import createAnnotationObject3D from "./createAnnotationObject3D";

// 3D reconstruction of an annotation drawn on a PHOTO baseMap, through its
// calibrated photoPlan (see useAnnotationsV2's photo pass — `_photoPlan3D`).
//
// The inner object is built by the standard createAnnotationObject3D with a
// zero-sized meterByPx=1 fake baseMap: `pointsLocal` are image-like y-down
// METERS, so pixelToWorld((x, y), {imageWidth: 0, imageHeight: 0,
// meterByPx: 1}) = (x, -y) lands exactly on the plane's y-up (u, v) frame.
// orientation "VERTICAL" keeps the identity euler convention: geometry stays
// in the local XY plane with +Z as the plane normal, so height / offsetZ
// extrude along the photoPlan's normal for BOTH plane orientations.
//
// The wrapper Group carries the plane's world pose (basis [uDir, vDir,
// normal] + origin) — the world-frame stand-in for the baseMap group that
// photo baseMaps don't have.
export default function createPhotoPlanObject3D(annotation, options) {
  const p3 = annotation?._photoPlan3D;
  if (!p3?.pose || !p3.pointsLocal?.length) return null;

  const fakeBaseMap = {
    imageWidth: 0,
    imageHeight: 0,
    meterByPx: 1,
    orientation: "VERTICAL",
  };

  const inner = createAnnotationObject3D(
    {
      ...annotation,
      points: p3.pointsLocal,
      cuts: p3.cutsLocal ?? [],
    },
    fakeBaseMap,
    options
  );
  if (!inner) return null;

  const group = new Group();
  const { origin, uDir, vDir, normal } = p3.pose;
  const m = new Matrix4().makeBasis(
    new Vector3(uDir.x, uDir.y, uDir.z),
    new Vector3(vDir.x, vDir.y, vDir.z),
    new Vector3(normal.x, normal.y, normal.z)
  );
  m.setPosition(origin.x, origin.y, origin.z);
  m.decompose(group.position, group.quaternion, group.scale);
  group.add(inner);

  // Selection / display controllers read userData from the TOP object
  // (annotationsObjectsMap value) — mirror the inner root's identity.
  group.userData = {
    ...(inner.userData ?? {}),
    isPhotoPlanReconstruction: true,
  };

  return group;
}
