// Display textures of a scan: each atlas is reduced to at most this size
// (power of two) before its BC1 encoding. 2048² in BC1 with its mip chain is
// ~2.7 MB on the GPU (an 8192² RGBA original: ~360 MB).
export const SCENE_3D_DISPLAY_TEXTURE_MAX_SIZE = 2048;

// Finest useful resolution of a top-down bake (small zones: 5 mm / px).
export const SCENE_3D_MAX_PX_PER_METER = 200;

// Resolution of the base map image baked from the zone of interest.
//   maxPx: longest side of the image;
//   textureMaxSize: size the atlases are decoded at for the bake.
export const SCENE_3D_TOP_VIEW_SIZES = {
  STANDARD: { maxPx: 4096, textureMaxSize: 2048 },
  HIGH: { maxPx: 8192, textureMaxSize: 4096 },
};

// Longest side of the whole-scan preview the zone is drawn on.
export const SCENE_3D_PREVIEW_MAX_PX = 2048;

export const SCENE_3D_DISPLAY_3D = {
  MESH: "MESH",
  PROJECTION: "PROJECTION",
  HIDDEN: "HIDDEN",
};

// 3D display of a scan base map (record or BaseMap instance).
//   MESH        the textured mesh over the base map plane (default);
//   PROJECTION  the base map plane only (also the fallback when the scan
//               data is not on this device);
//   HIDDEN      no mesh either.
export function getScene3dDisplay3d(baseMap) {
  return baseMap?.scene3d?.display3d ?? SCENE_3D_DISPLAY_3D.MESH;
}
