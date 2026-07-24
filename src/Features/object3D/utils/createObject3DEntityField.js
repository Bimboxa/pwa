import Object3DObject from "../js/Object3DObject";
import testIsGlb from "./testIsGlb";

// Turn a .glb File into the object3D entity field
// ({ file, fileName, fileSize, bbox, topViewDataUrl, isObject3D }), including the
// top-view projection image rendered from the glb. Shared by the "Nouveau
// modèle" form field (FieldObject3D) and the object library placement
// (usePlaceObjectFromLibrary). Returns null when the file is missing / not a glb.
export default async function createObject3DEntityField(file) {
  if (!file || !testIsGlb(file)) return null;
  const object3D = await Object3DObject.create({ file });
  return object3D.toEntityField();
}
