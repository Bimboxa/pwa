import createScene3dTopViewBaker from "./createScene3dTopViewBaker";
import {
  cloneScene3dGlbModel,
  createScene3dGlbBasicMaterial,
} from "../js/parseScene3dGlb";

// Top-down image of a GLB scene (createScene3dTopViewBaker): the whole model
// (the PREVIEW the zone of interest is drawn on) or, with `zone`, the image
// of the scan base map. Unlit colours / textures of the model, darkened with
// the depth (renderObject) so the levels read on a plain model.
//
// model: parseScene3dGlb result. → {blob, fileMime, width, height, pxPerMeter}
export default async function bakeScene3dGlbImageService({
  model,
  zone = null,
  maxPx,
}) {
  const baker = createScene3dTopViewBaker({ bbox: model.bbox, maxPx, zone });
  const { object, materials } = cloneScene3dGlbModel(
    model,
    createScene3dGlbBasicMaterial
  );
  try {
    baker.renderObject(object);
    const { blob, fileMime } = await baker.toBlob();
    return {
      blob,
      fileMime,
      width: baker.width,
      height: baker.height,
      pxPerMeter: baker.pxPerMeter,
    };
  } finally {
    materials.forEach((material) => material.dispose());
    baker.dispose();
  }
}
