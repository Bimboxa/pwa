// Display textures of a scan: each atlas is reduced to at most this size
// (power of two) before its BC1 encoding. 2048² in BC1 with its mip chain is
// ~2.7 MB on the GPU (an 8192² RGBA original: ~360 MB).
export const SCENE_3D_DISPLAY_TEXTURE_MAX_SIZE = 2048;

// Resolution of the top-down projection baked at import.
//   maxPx: longest side of the image;
//   textureMaxSize: size the atlases are decoded at for the bake.
export const SCENE_3D_TOP_VIEW_SIZES = {
  STANDARD: { maxPx: 4096, textureMaxSize: 2048 },
  HIGH: { maxPx: 8192, textureMaxSize: 4096 },
};

export const SCENE_3D_DISPLAY_2D = {
  PROJECTION: "PROJECTION",
  HIDDEN: "HIDDEN",
};

export const SCENE_3D_DISPLAY_3D = {
  MESH: "MESH",
  PROJECTION: "PROJECTION",
  HIDDEN: "HIDDEN",
};

export function getScene3dDisplay2d(annotation) {
  return annotation?.sceneDisplay2d ?? SCENE_3D_DISPLAY_2D.PROJECTION;
}

export function getScene3dDisplay3d(annotation) {
  return annotation?.sceneDisplay3d ?? SCENE_3D_DISPLAY_3D.MESH;
}
