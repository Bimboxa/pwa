import { useTheme } from "@mui/material";

import FieldElevationOffset from "./FieldElevationOffset";

const COUNTER_ZOOM = { transform: "scale(calc(1 / var(--map-zoom, 1)))" };

// The annotation Offset (offsetZ) field, positioned by `layout`
// (getZAxisAnchoredLayout): on the Z axis or far-left of the profile, hugging
// the anchor's edge. Rendered LAST in each renderer so it stays ON TOP of the
// silhouette / handles / other labels.
export default function ElevationOffsetField({
  layout,
  offsetZ = 0,
  onCommitOffsetZ,
}) {
  const secondary = useTheme().palette.secondary.main;
  if (!layout) return null;

  return (
    <g transform={`translate(${layout.offsetAnchorX}, 0)`}>
      <g style={COUNTER_ZOOM}>
        <foreignObject
          x={layout.offsetFieldX}
          y={-11}
          width={layout.offsetW}
          height={24}
          style={{ overflow: "visible" }}
        >
          {/* hug the anchor-facing edge so the field keeps a fixed screen
              distance from it whatever its content width */}
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: layout.offsetJustify,
            }}
          >
            <FieldElevationOffset
              label="Offset"
              value={offsetZ}
              width={46}
              accentColor={secondary}
              noShadow
              onCommit={(v) => onCommitOffsetZ?.(v)}
            />
          </div>
        </foreignObject>
      </g>
    </g>
  );
}
