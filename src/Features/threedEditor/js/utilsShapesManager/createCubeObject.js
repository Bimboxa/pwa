import * as THREE from "three";

export default function createCubeObject(index) {
  try {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshLambertMaterial({color: 0x00ff00});
    const mesh = new THREE.Mesh(geometry, material);

    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.set(index, index, 0);

    return mesh;
  } catch (error) {
    console.error("createCubeObject", error);
  }
}
