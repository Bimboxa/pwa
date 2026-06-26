// AxisSnapLayer.jsx
//
// Viewport-space overlay that visualizes distant-point axis snapping while
// drawing. For each candidate point a crosshair branch is approaching:
//   - grey ring  -> the branch is close (approach band)
//   - red fill   -> the branch crossed the snap threshold (a snap is active)
//
// Markers live in the staticOverlay (outside the camera group), so their
// position is in viewport pixels and their size is zoom-independent.
//
// Updated imperatively (no React re-render per mouse move): a fixed pool of
// <circle> elements is shown/hidden and repositioned via update(markers).
import { forwardRef, useImperativeHandle, useRef } from "react";

const MAX_MARKERS = 12;
const RADIUS = 6; // screen px

const GREY_STROKE = "rgba(110,110,110,0.95)";
const RED_STROKE = "#ff1744";
const RED_FILL = "rgba(255,23,68,0.45)";

const AxisSnapLayer = forwardRef((props, ref) => {
  const circleRefs = useRef([]);

  useImperativeHandle(ref, () => ({
    update: (markers) => {
      const arr = Array.isArray(markers) ? markers : [];
      for (let i = 0; i < MAX_MARKERS; i++) {
        const el = circleRefs.current[i];
        if (!el) continue;
        const m = arr[i];
        if (!m) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "block";
        el.setAttribute("cx", m.screenX);
        el.setAttribute("cy", m.screenY);
        if (m.active) {
          el.setAttribute("stroke", RED_STROKE);
          el.setAttribute("fill", RED_FILL);
        } else {
          el.setAttribute("stroke", GREY_STROKE);
          el.setAttribute("fill", "none");
        }
      }
    },
  }));

  return (
    <g style={{ pointerEvents: "none" }}>
      {Array.from({ length: MAX_MARKERS }).map((_, i) => (
        <circle
          key={i}
          ref={(el) => (circleRefs.current[i] = el)}
          r={RADIUS}
          fill="none"
          stroke={GREY_STROKE}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          style={{ display: "none" }}
        />
      ))}
    </g>
  );
});

export default AxisSnapLayer;
