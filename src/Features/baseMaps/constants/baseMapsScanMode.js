import { BlurOff, Grain, ViewInArOutlined } from "@mui/icons-material";

// Global display of the scans carried by base maps in 3D: the point clouds
// of the base maps projected from a local scan (Scan 3D tool) and, for
// NONE only, the meshes of the « Scène 3D » base maps. Per-scope local
// state (viewers.baseMapsScanMode), null until chosen: no point cloud is
// decoded before the user asks for it, and the « Scène 3D » meshes only hide
// on an explicit NONE.
export const BASE_MAPS_SCAN_MODE = {
  NONE: "NONE",
  POINTS: "POINTS",
  SPLAT: "SPLAT", // Gaussian splats; plain point clouds stay in points
};

export const BASE_MAPS_SCAN_MODE_OPTIONS = [
  {
    key: BASE_MAPS_SCAN_MODE.NONE,
    label: "Masqué",
    tooltip: "Scans 3D masqués",
    Icon: BlurOff,
  },
  {
    key: BASE_MAPS_SCAN_MODE.POINTS,
    label: "Points",
    tooltip: "Scans 3D en points",
    Icon: Grain,
  },
  {
    key: BASE_MAPS_SCAN_MODE.SPLAT,
    label: "Réaliste",
    tooltip: "Scans 3D réalistes (gaussiennes, sinon points)",
    Icon: ViewInArOutlined,
  },
];

export function isBaseMapsScanMode(value) {
  return Object.values(BASE_MAPS_SCAN_MODE).includes(value);
}
