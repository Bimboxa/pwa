import { forwardRef, useImperativeHandle, useState } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

const flashAnimation = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 0.6; }
  100% { opacity: 0.3; }
`;

const COLOR = "#00ff00";

const AnimatedPath = styled.path`
  animation: ${flashAnimation} 1s infinite ease-in-out;
`;

/**
 * Renders a flashing green polygon with optional holes (cuts).
 * Uses SVG even-odd fill rule so cuts appear as transparent holes.
 *
 * Imperative API:
 *   updatePolygon({ outerRing: [{x,y},...], cuts: [[{x,y},...], ...] })
 *   clear()
 */
const TransientDetectedPolygonLayer = forwardRef((_, ref) => {
  const [polygon, setPolygon] = useState(null);

  useImperativeHandle(ref, () => ({
    updatePolygon: (data) => setPolygon(data || null),
    clear: () => setPolygon(null),
  }));

  if (!polygon || !polygon.outerRing || polygon.outerRing.length < 3) return null;

  // Build SVG path with even-odd fill rule for holes
  const ringToPathD = (ring) =>
    ring.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  let d = ringToPathD(polygon.outerRing);
  if (polygon.cuts) {
    for (const cut of polygon.cuts) {
      if (cut.length >= 3) {
        d += " " + ringToPathD(cut);
      }
    }
  }

  return (
    <g>
      {/* Filled polygon with holes */}
      <AnimatedPath
        d={d}
        fill={COLOR}
        fillOpacity={0.25}
        fillRule="evenodd"
        stroke="none"
        pointerEvents="none"
      />
      {/* Outer ring stroke */}
      <AnimatedPath
        d={ringToPathD(polygon.outerRing)}
        fill="none"
        stroke={COLOR}
        strokeWidth={3}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {/* Cut strokes */}
      {polygon.cuts?.map((cut, i) =>
        cut.length >= 3 ? (
          <AnimatedPath
            key={i}
            d={ringToPathD(cut)}
            fill="none"
            stroke={COLOR}
            strokeWidth={2}
            strokeDasharray="6 3"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : null
      )}
    </g>
  );
});

export default TransientDetectedPolygonLayer;
