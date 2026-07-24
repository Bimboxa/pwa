import { useTheme } from "@mui/material";

// Z = 0 baseMap reference plane (grey dashed line), extended to reach the Z
// axis via `layout` (getZAxisAnchoredLayout). Rendered EARLY (background),
// inside the camera group. The Offset field is a separate component drawn LAST
// (on top) — see ElevationOffsetField.
export default function ElevationZeroLine({ layout }) {
  const secondary = useTheme().palette.secondary.main;
  if (!layout) return null;

  return (
    <line
      x1={layout.z0x1}
      y1={0}
      x2={layout.z0x2}
      y2={0}
      stroke={secondary}
      strokeWidth={1.25}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}
