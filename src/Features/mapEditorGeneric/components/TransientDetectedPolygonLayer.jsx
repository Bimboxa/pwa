import { forwardRef, useImperativeHandle, useState } from "react";
import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

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

  if (!polygon || !polygon.outerRing || polygon.outerRing.length < 3)
    return null;

  // Build SVG path with even-odd fill rule for holes. Rings may carry S-C-S
  // arc types (square→circle→square) from the detection's arc recovery — sample
  // those arcs so the preview curve matches the committed (arc-aware) render
  // instead of showing a chord peak through the arc control points.
  const ringToPathD = (ring) => {
    const n = ring.length;
    const closed =
      n > 1 &&
      Math.abs(ring[0].x - ring[n - 1].x) < 1e-6 &&
      Math.abs(ring[0].y - ring[n - 1].y) < 1e-6;
    const open = closed ? ring.slice(0, n - 1) : ring;
    const pts = expandArcsInPath(open, 12, true);
    return (
      pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z"
    );
  };

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
        fillOpacity={0.8}
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
