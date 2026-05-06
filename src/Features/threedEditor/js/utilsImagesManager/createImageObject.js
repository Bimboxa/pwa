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

    // Render the basemap as a background plate that loses every depth contest
    // it enters, so any annotation in front of it occludes it correctly.
    //
    // - renderOrder=-1: drawn first within its render queue.
    // - transparent: opacity < 1: keeps the basemap in the opaque queue when
    //   fully opaque, so renderOrder=-1 actually places it before opaque
    //   annotations. Three.js's opaque and transparent passes are strictly
    //   sequential and renderOrder cannot bridge them — a basemap forced into
    //   the transparent queue would render AFTER opaque annotations.
    // - depthTest=true + polygonOffset: when the basemap is semi-transparent
    //   it ends up in the transparent pass, drawn AFTER opaque annotations.
    //   Without depthTest it would paint over them (the original bug). With
    //   depthTest alone the basemap z-fights with the GridHelper at y=0 and
    //   a white floorplan turns invisible. polygonOffset pushes the basemap's
    //   depth slightly back so the grid lines and any coplanar annotation win
    //   the depth contest cleanly.
    // - depthWrite=false: even when the basemap renders first, it must not
    //   occlude geometry placed at the same y (grid, flush annotations).
    // - Path-tracer rendering ignores these flags (it traces rays from BVH),
    //   so the photoreal export still composes the basemap correctly.
    const opacity = typeof image.opacity === "number" ? image.opacity : 1;
    const material = new MeshBasicMaterial({
      map: texture,
      side: DoubleSide,
      depthWrite: false,
      depthTest: true,
      transparent: opacity < 1,
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
  })();

  return { group, ready };
}
