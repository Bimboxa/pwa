import {
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  DoubleSide,
  Group,
} from "three";

import getTextureAsync from "./getTextureAsync";

// Geometry of the basemap plane, expressed in the basemap group's LOCAL meter
// frame. That local frame is the REFERENCE frame (annotations are projected
// into it by pixelToWorld, centered on refSize/2): the active version's image
// is a quad of its own pixel size, placed into the frame by the version
// transform {x, y (ref px), rotation (deg, clockwise), scale} — the 3D
// counterpart of the 2D SVG placement in StaticMapContent
// (`translate(t.x, t.y) scale(t.scale) rotate(t.rotation)`, rotation around
// the image's top-left corner).
export function buildBaseMapPlaneGeometry({
  refSizePx,
  versionSizePx,
  versionTransform,
  meterByPx,
}) {
  const t = versionTransform || { x: 0, y: 0, rotation: 0, scale: 1 };
  const vs = versionSizePx || refSizePx;
  const m = Number.isFinite(meterByPx) && meterByPx > 0 ? meterByPx : 0;
  const s = t.scale ?? 1;
  const widthInM = (vs?.width ?? 0) * s * m;
  const heightInM = (vs?.height ?? 0) * s * m;
  const geometry = new PlaneGeometry(widthInM, heightInM);
  // PlaneGeometry is centered: move the image's top-left corner to the origin
  // (image y-down maps to local -y).
  geometry.translate(widthInM / 2, -heightInM / 2, 0);
  // SVG rotate() is clockwise in the y-down image frame = -angle around +Z in
  // the y-up local frame, around the top-left corner (the origin here).
  if (t.rotation) geometry.rotateZ((-t.rotation * Math.PI) / 180);
  // Move the top-left corner to its reference-frame position (same math as
  // pixelToWorld).
  const refW = refSizePx?.width ?? 0;
  const refH = refSizePx?.height ?? 0;
  geometry.translate(
    ((t.x ?? 0) - refW / 2) * m,
    -((t.y ?? 0) - refH / 2) * m,
    0
  );
  return geometry;
}

// Create the basemap Group synchronously (so AnnotationsManager can immediately
// attach annotations as children), then asynchronously load the texture and
// add the mesh when ready. Returns { group, ready } where `ready` resolves once
// the mesh has been attached.
export default function createImageObject(image) {
  const group = new Group();
  // The rotation order MUST be set BEFORE the rotation values, otherwise the
  // resulting matrix is built with the previous (default) order and the
  // gizmo-driven Y angle no longer decomposes cleanly.
  if (image.rotationOrder) group.rotation.order = image.rotationOrder;
  group.position.set(image.position.x, image.position.y, image.position.z);
  group.rotation.set(image.rotation.x, image.rotation.y, image.rotation.z);
  group.userData.kind = "baseMap";
  group.userData.baseMapId = image.id;
  // Remember the scale + pixel-space plane placement used to build this group
  // so a later `meterByPx` change (2-target "Recaler", set-scale after a
  // scale-less creation) can rebuild the plane geometry without re-resolving
  // image sizes (works for legacy & versioned maps, raw records included).
  group.userData.meterByPx = image.meterByPx;
  group.userData.planePx = {
    refSizePx: image.refSizePx,
    versionSizePx: image.versionSizePx,
    versionTransform: image.versionTransform,
  };

  // Inner mesh wrapper used for the live "drawingOffset" visualisation: the
  // mesh slides along the basemap's local +Z (which becomes the plane normal
  // after the group's rotation). Annotations stay children of the outer
  // group, so the offset is purely a visual cue showing where the next
  // annotation will land — it doesn't move existing ones.
  const meshWrap = new Group();
  meshWrap.userData.kind = "baseMapMeshWrap";
  group.add(meshWrap);
  group.userData.meshWrap = meshWrap;

  const ready = attachBaseMapMesh(group, image);

  return { group, ready };
}

// Load the texture and attach the basemap mesh into an existing group's
// meshWrap. Split from createImageObject so a group whose texture load failed
// (blob URL not ready yet after a Krto import) or whose image changed (active
// version switch) can be repaired in place — annotations already attached to
// the group are untouched.
export async function attachBaseMapMesh(group, image) {
  const meshWrap = group.userData.meshWrap;
  if (!meshWrap) return;
  if (meshWrap.children.some((c) => c.userData?.isBasemap)) return;

  // Refresh the pixel-space placement stash — a repair or a version switch
  // carries fresher data than the group's creation.
  group.userData.planePx = {
    refSizePx: image.refSizePx,
    versionSizePx: image.versionSizePx,
    versionTransform: image.versionTransform,
  };
  // Prefer the scale stashed on the group: applyBaseMapPlacement may have
  // updated it (scale set after creation) while the texture was still
  // loading, and the mesh must come in at the current scale.
  const stashedM = group.userData.meterByPx;
  const meterByPx =
    Number.isFinite(stashedM) && stashedM > 0 ? stashedM : image.meterByPx;
  group.userData.meterByPx = meterByPx;

  const texture = await getTextureAsync(image.url);
  const plane = buildBaseMapPlaneGeometry({
    ...group.userData.planePx,
    meterByPx,
  });

  // Render the basemap as a background plate that loses every depth contest
  // it enters, so any annotation in front of it occludes it correctly.
  //
  // - renderOrder=-1: drawn first within its render queue.
  // - transparent=true (always): the basemap stays in the transparent queue
  //   regardless of its opacity, so the live-sync hook can drag opacity
  //   continuously from 0 to 1 without ever swapping render queues. At
  //   opacity=1 the blending is `src*1 + dst*0 = src`, identical visually
  //   to a non-blended draw — no discontinuity at the slider boundary.
  // - depthTest=true + polygonOffset: the basemap is drawn AFTER opaque
  //   annotations. Without depthTest it would paint over them (original
  //   bug). With depthTest alone the basemap z-fights with the GridHelper
  //   at y=0 and a white floorplan turns invisible. polygonOffset pushes
  //   the basemap's depth slightly back so grid lines and any coplanar
  //   annotation win the depth contest cleanly.
  // - depthWrite=(opacity===1): only when fully opaque does the basemap
  //   update the depth buffer, so later transparent draws — annotation edge
  //   lines, dimmed annotations — that sit behind it fail their depth test
  //   and don't leak through. As soon as the user drags the slider below
  //   1, depthWrite turns off so things behind a translucent basemap can
  //   blend through normally; otherwise the basemap would always occlude
  //   transparent annotations behind it, even at low slider values.
  //   polygonOffset still keeps the basemap behind coplanar geometry
  //   (grid, flush annotations).
  // - Path-tracer rendering ignores these flags (it traces rays from BVH),
  //   so the photoreal export still composes the basemap correctly.
  const opacity = typeof image.opacity === "number" ? image.opacity : 1;
  const material = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    depthWrite: opacity >= 1,
    depthTest: true,
    transparent: true,
    opacity,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 4,
  });

  const mesh = new Mesh(plane, material);
  mesh.renderOrder = -1;
  // Tag so the photoreal swap can recognise basemap meshes and turn them
  // into emissive PBR surfaces instead of standard ones — otherwise the
  // env-map ambient shading turns a white floorplan into a dim gray.
  mesh.userData.isBasemap = true;
  meshWrap.add(mesh);
}
