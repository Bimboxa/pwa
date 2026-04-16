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
 * Renders multiple flashing green strip polygons.
 * Each strip is an object { polygon: [{x,y},...] }.
 *
 * Imperative API:
 *   updateStrips(strips)
 *   clear()
 *   getCount()
 */
const TransientDetectedStripsLayer = forwardRef((_, ref) => {
  const [strips, setStrips] = useState([]);

  useImperativeHandle(ref, () => ({
    updateStrips: (newStrips) => setStrips(newStrips || []),
    clear: () => setStrips([]),
    getCount: () => strips.length,
  }));

  if (strips.length === 0) return null;

  const ringToPathD = (ring) =>
    ring.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";

  return (
    <g>
      {strips.map((strip, i) => {
        if (!strip.polygon || strip.polygon.length < 3) return null;
        const d = ringToPathD(strip.polygon);
        return (
          <g key={i}>
            <AnimatedPath
              d={d}
              fill={COLOR}
              fillOpacity={0.25}
              fillRule="evenodd"
              stroke="none"
              pointerEvents="none"
            />
            <AnimatedPath
              d={d}
              fill="none"
              stroke={COLOR}
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          </g>
        );
      })}
      {/* Count badge */}
      {strips.length > 0 && strips[0].polygon?.length > 0 && (
        <text
          x={strips[0].polygon[0].x}
          y={strips[0].polygon[0].y - 10}
          fill={COLOR}
          fontSize="14"
          fontWeight="bold"
          pointerEvents="none"
          style={{
            paintOrder: "stroke",
            stroke: "rgba(0,0,0,0.7)",
            strokeWidth: 3,
            vectorEffect: "non-scaling-stroke",
          }}
        >
          {strips.length} strips
        </text>
      )}
    </g>
  );
});

export default TransientDetectedStripsLayer;
