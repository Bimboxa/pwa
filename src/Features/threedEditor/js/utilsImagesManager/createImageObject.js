import { PlaneGeometry, MeshBasicMaterial, Mesh, DoubleSide } from "three";

import getTextureAsync from "./getTextureAsync";

export default async function createImageObjectAsync(image) {
  const widthInM = image.widthInM;
  const heightInM = image.heightInM;
  const url = image.url;

  const plane = new PlaneGeometry(widthInM, heightInM);

  const texture = await getTextureAsync(url);

  // Render the basemap as a background plate: drawn first, ignores depth.
  // - The GridHelper sits at world y=0, same plane as the basemap → without
  //   this, they z-fight and a white basemap stays invisible.
  // - depthTest=false + renderOrder=-1 forces the basemap to be drawn first,
  //   then grid + annotations layer on top through normal depth ordering.
  // - depthWrite=false ensures the basemap doesn't occlude anything else.
  // - Path-tracer rendering ignores these flags (it traces rays from BVH),
  //   so the photoreal export still composes the basemap correctly.
  const material = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    depthWrite: false,
    depthTest: false,
  });

  const object = new Mesh(plane, material);
  object.renderOrder = -1;
  object.rotation.set(image.rotation.x, image.rotation.y, image.rotation.z);
  // Tag so the photoreal swap can recognise basemap meshes and turn them
  // into emissive PBR surfaces instead of standard ones — otherwise the
  // env-map ambient shading turns a white floorplan into a dim gray.
  object.userData.isBasemap = true;

  return object;
}
