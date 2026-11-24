// Key of the « Reconstruction 3D » tool of the right band (Fonds de plan
// module), see useRightPanelTools / RightPanelContainer.
export const RECONSTRUCTION_3D_TOOL_KEY = "RECONSTRUCTION_3D";

export const RECONSTRUCTION_MEDIA_TYPES = {
  VIDEO: "VIDEO",
  PHOTOS: "PHOTOS",
};

// Sampling of a dropped video: one frame every `interval` seconds, the
// interval being stretched so that a long video never gives more than
// MAX_FRAMES images (the zip handed to the AI chat stays light).
export const RECONSTRUCTION_MIN_FRAME_INTERVAL_S = 0.5;
export const RECONSTRUCTION_MAX_FRAMES = 120;
// Longest side of a frame sampled from a video, px.
export const RECONSTRUCTION_FRAME_MAX_PX = 1600;
export const RECONSTRUCTION_FRAME_JPEG_QUALITY = 0.85;
