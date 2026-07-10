import { DEFAULT_MESH3D_LABEL_PREFIX } from "./mesh3dConstants.js";

// Display label of a maille: user override wins, else prefix + number.
export default function getMesh3dDisplayLabel(mesh3d, prefix) {
  if (mesh3d?.label) return mesh3d.label;
  const p = prefix ?? DEFAULT_MESH3D_LABEL_PREFIX;
  return `${p}${mesh3d?.number ?? "?"}`;
}
