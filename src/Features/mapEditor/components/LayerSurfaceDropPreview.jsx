import { useSelector } from "react-redux";

/**
 * Live SVG polygon preview for the SURFACE_DROP smartDetect flood-fill mode.
 *
 * Reads `state.smartDetect.surfaceDropPreview` — a `{ points: [{x,y}] }`
 * object in LOCAL map coordinates (same system as annotation points).
 * Renders nothing when the preview is null, the mode mismatch makes it
 * stale, or the smartDetect master toggle is off.
 *
 * The preview is intentionally rendered below the interaction/editing
 * layers so clicks still hit the underlying `<InteractionLayer>` event
 * surface to commit the polygon.
 */
export default function LayerSurfaceDropPreview({ basePose }) {
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const smartDetectEnabled = useSelector((s) => s.mapEditor.smartDetectEnabled);
  const preview = useSelector((s) => s.smartDetect.surfaceDropPreview);

  if (!smartDetectEnabled) return null;
  if (enabledDrawingMode !== "SURFACE_DROP") return null;
  if (!preview?.points || preview.points.length < 3) return null;

  const pointsAttr = preview.points.map((p) => `${p.x},${p.y}`).join(" ");

  // Fluo green matches the loupe rect stroke in ScreenCursorV2 and the
  // other auto-detection previews.
  return (
    <g
      style={{ pointerEvents: "none" }}
      transform={`translate(${basePose.x}, ${basePose.y}) scale(${basePose.k})`}
    >
      <polygon points={pointsAttr} fill="#00ff00" fillOpacity={0.4} stroke="none" />
    </g>
  );
}
