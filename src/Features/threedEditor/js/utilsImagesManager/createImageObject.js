import { PlaneGeometry, MeshBasicMaterial, Mesh, DoubleSide, Group } from "three";

import getTextureAsync from "./getTextureAsync";

// Create the basemap Group synchronously (so AnnotationsManager can immediately
// attach annotations as children), then asynchronously load the texture and
// add the mesh when ready. Returns { group, ready } where `ready` resolves once
// the mesh has been attached.
export default function createImageObject(image) {
  const widthInM = image.widthInM;
  const heightInM = image.heightInM;
  const url = image.url;

  const group = new Group();
  // The rotation order MUST be set BEFORE the rotation values, otherwise the
  // resulting matrix is built with the previous (default) order and the
  // gizmo-driven Y angle no longer decomposes cleanly.
  if (image.rotationOrder) group.rotation.order = image.rotationOrder;
  group.position.set(image.position.x, image.position.y, image.position.z);
  group.rotation.set(image.rotation.x, image.rotation.y, image.rotation.z);
  group.userData.kind = "baseMap";
  group.userData.baseMapId = image.id;

  // Inner mesh wrapper used for the live "drawingOffset" visualisation: the
  // mesh slides along the basemap's local +Z (which becomes the plane normal
  // after the group's rotation). Annotations stay children of the outer
  // group, so the offset is purely a visual cue showing where the next
  // annotation will land — it doesn't move existing ones.
  const meshWrap = new Group();
  meshWrap.userData.kind = "baseMapMeshWrap";
  group.add(meshWrap);
  group.userData.meshWrap = meshWrap;

  const ready = (async () => {
    const texture = await getTextureAsync(url);
    const plane = new PlaneGeometry(widthInM, heightInM);

    // Render the basemap as a background plate: drawn first, ignores depth.
    // - The GridHelper sits at world y=0, same plane as the basemap → without
    //   this, they z-fight and a white basemap stays invisible.
    // - depthTest=false + renderOrder=-1 forces the basemap to be drawn first,
    //   then grid + annotations layer on top through normal depth ordering.
    // - depthWrite=false ensures the basemap doesn't occlude anything else.
    // - transparent must follow opacity (not always true): Three.js renders
    //   opaque objects before transparent ones in two separate passes, and
    //   renderOrder cannot bridge those passes. If the basemap is forced into
    //   the transparent queue while an opaque annotation is in the opaque
    //   queue, the basemap renders LAST — and with depthTest=false it draws
    //   over the annotation. Keeping transparent=false when opacity=1 puts
    //   the basemap back in the opaque queue, where renderOrder=-1 correctly
    //   places it before the annotations.
    // - Path-tracer rendering ignores these flags (it traces rays from BVH),
    //   so the photoreal export still composes the basemap correctly.
    const opacity = typeof image.opacity === "number" ? image.opacity : 1;
    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      depthWrite: false,
      depthTest: false,
      transparent: opacity < 1,
      opacity,
    });

    const mesh = new Mesh(plane, material);
    mesh.renderOrder = -1;
    // Tag so the photoreal swap can recognise basemap meshes and turn them
    // into emissive PBR surfaces instead of standard ones — otherwise the
    // env-map ambient shading turns a white floorplan into a dim gray.
    mesh.userData.isBasemap = true;
    meshWrap.add(mesh);
  })();

  return { group, ready };
}
