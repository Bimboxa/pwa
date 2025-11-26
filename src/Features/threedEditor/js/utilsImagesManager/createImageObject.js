import { PlaneGeometry, MeshBasicMaterial, Mesh, DoubleSide } from "three";

import getTextureAsync from "./getTextureAsync";

export default async function createImageObjectAsync(image) {
  const widthInM = image.widthInM;
  const heightInM = image.heightInM;
  const url = image.url;

  const plane = new PlaneGeometry(widthInM, heightInM);

  const texture = await getTextureAsync(url);

  const material = new MeshBasicMaterial({
    map: texture,
    side: DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const object = new Mesh(plane, material);

  object.rotation.set(image.rotation.x, image.rotation.y, image.rotation.z);

  return object;
}
