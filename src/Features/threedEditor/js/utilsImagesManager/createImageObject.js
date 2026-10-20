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

// Synchronous part of createImageObject: the posed basemap Group with its
// (empty) mesh wrapper and the stashes needed to attach the mesh later. Also
// used alone for the texture-less groups of the 3D base maps grid
// (ImagesManager.ensureBaseMapGroup), whose mesh is attached on demand by
// ensureImageTexture.
export function createBaseMapGroup(image) {
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

  return group;
}

// Create the basemap Group synchronously (so AnnotationsManager can immediately
// attach annotations as children), then asynchronously load the texture and
// add the mesh when ready. Returns { group, ready } where `ready` resolves once
// the mesh has been attached.
export default function createImageObject(image) {
  const group = createBaseMapGroup(image);

  const ready = attachBaseMapMesh(group, image);

  return { group, ready };
}

// The full-resolution basemap mesh of a group's meshWrap (not a preview).
function getBaseMapMesh(meshWrap) {
  return meshWrap?.children.find(
    (c) => c.userData?.isBasemap && !c.userData?.isBasemapPreview
  );
}

// Drops the preview mesh(es) of a group's meshWrap (3D base maps grid, see
// ImagesManager.ensureBaseMapPreview). The preview texture is NOT disposed:
// ImagesManager caches it for the next opening of the table.
export function removeBaseMapPreviewMesh(group) {
  const meshWrap = group?.userData?.meshWrap;
  if (!meshWrap) return false;
  const previews = meshWrap.children.filter(
    (c) => c.userData?.isBasemapPreview
  );
  previews.forEach((mesh) => {
    meshWrap.remove(mesh);
    mesh.geometry?.dispose?.();
    mesh.material?.dispose?.();
  });
  delete group.userData.previewSignature;
  return previews.length > 0;
}

// Material of a basemap plane (full image or preview).
//
// Render the basemap as a background plate that loses every depth contest
// it enters, so any annotation in front of it occludes it correctly.
//
// - renderOrder=-1 (set on the mesh): drawn first within its render queue.
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
// - toneMapped=false: the realistic modes use ACES tone mapping, which
//   compresses pure white to a light gray. The basemap is an unlit
//   document, not part of the lit scene — bypass tone mapping so the
//   floorplan stays paper-white in every render mode.
// - uDesaturate (material.userData, 0..1): grey display of the image (3D
//   base maps grid of the Dessin module, image eye off — ImagesManager
//   .applyBaseMapOpacity drives it with the faded opacity). A luminance
//   mix in the fragment shader, driven by a uniform: one program shared by
//   every basemap (customProgramCacheKey), nothing recompiles on toggle.
//
// The material is born fully opaque: attachBaseMapMesh runs AFTER an await,
// so it can't know the current slider value. ImagesManager owns the desired
// opacity and pushes it (opacity + depthWrite) in the `.then()` that
// follows the attach, before the first draw.
export function createBaseMapMaterial(texture) {
  const material = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    depthWrite: true,
    depthTest: true,
    transparent: true,
    opacity: 1,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 4,
  });
  material.userData.uDesaturate = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDesaturate = material.userData.uDesaturate;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nuniform float uDesaturate;"
      )
      .replace(
        "#include <map_fragment>",
        [
          "#include <map_fragment>",
          "diffuseColor.rgb = mix(",
          "  diffuseColor.rgb,",
          "  vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))),",
          "  uDesaturate",
          ");",
        ].join("\n")
      );
  };
  material.customProgramCacheKey = () => "basemap-desaturate";
  return material;
}

function createBaseMapMesh(texture, geometry) {
  const mesh = new Mesh(geometry, createBaseMapMaterial(texture));
  mesh.renderOrder = -1;
  // Tag consumed by opacity controls, raycast filters and the PHOTOREAL
  // shadow catchers (RenderModeManager overlays a coplanar ShadowMaterial
  // child on every mesh carrying this flag).
  mesh.userData.isBasemap = true;
  return mesh;
}

// Low-resolution stand-in of the basemap mesh (3D base maps grid of the
// Dessin module: a sheet whose base map does not take part in the scene
// shows a preview texture instead of loading the full image). Same plane,
// same material contract as the full mesh, tagged `isBasemapPreview`: the
// full mesh replaces it when it lands (attachBaseMapMesh), the grid drops
// it when the sheet is released (removeBaseMapPreviewMesh).
export function attachBaseMapPreviewMesh(group, texture, signature) {
  const meshWrap = group.userData.meshWrap;
  if (!meshWrap) return null;
  const plane = buildBaseMapPlaneGeometry({
    ...group.userData.planePx,
    meterByPx: group.userData.meterByPx,
  });
  const mesh = createBaseMapMesh(texture, plane);
  mesh.userData.isBasemapPreview = true;
  mesh.userData.previewSignature = signature;
  meshWrap.add(mesh);
  return mesh;
}

// Load the texture and attach the basemap mesh into an existing group's
// meshWrap. Split from createImageObject so a group whose texture load failed
// (blob URL not ready yet after a Krto import) or whose image changed (active
// version switch) can be repaired in place — annotations already attached to
// the group are untouched. A preview mesh (3D base maps grid) gives way to
// the full mesh.
export async function attachBaseMapMesh(group, image) {
  const meshWrap = group.userData.meshWrap;
  if (!meshWrap) return;
  if (getBaseMapMesh(meshWrap)) return;

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
  // a full mesh attached meanwhile (concurrent repair) wins
  if (getBaseMapMesh(meshWrap)) {
    texture.dispose();
    return;
  }
  const plane = buildBaseMapPlaneGeometry({
    ...group.userData.planePx,
    meterByPx,
  });

  // The full image replaces the preview of the table (if any).
  removeBaseMapPreviewMesh(group);
  meshWrap.add(createBaseMapMesh(texture, plane));
}
