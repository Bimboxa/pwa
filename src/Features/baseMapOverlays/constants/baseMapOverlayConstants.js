// Base maps overlaid on the main one in the 2D editor (see useBaseMapOverlays).

// Content group of one overlaid base map (image + annotations): the transform
// layer finds it through this attribute to move it imperatively.
export const OVERLAY_CONTENT_ATTRIBUTE = "data-overlay-base-map-id";

// Wrapper of every overlay content group. Its descendants are made
// non-interactive by a global rule (see OverlayBaseMapsLayer).
export const OVERLAY_WRAPPER_ATTRIBUTE = "data-base-map-overlays";

// Greyed context: ONE wrapper for every overlay (same technique as the
// editor's dimmed context while an annotation is selected).
export const OVERLAY_CONTENT_STYLE = {
  filter: "grayscale(1)",
  opacity: 0.55,
  pointerEvents: "none",
};
