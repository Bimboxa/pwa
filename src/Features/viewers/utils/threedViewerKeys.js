// Viewer keys that render the (single, shared) MainThreedEditor instance:
// the plain 3D viewer and the Maillage viewer (3D + mesh list drawer).
// Use `isThreedFamilyViewerKey` instead of `key === "THREED"` wherever the
// intent is "the 3D editor is the active editor".
export const THREED_FAMILY_VIEWER_KEYS = ["THREED", "MESHES"];

export function isThreedFamilyViewerKey(key) {
  return THREED_FAMILY_VIEWER_KEYS.includes(key);
}
