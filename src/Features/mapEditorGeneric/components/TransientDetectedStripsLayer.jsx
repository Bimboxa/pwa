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
 * STRIP variant: when `strip.mainLine` is set (control-edge points of a
 * STRIP candidate), the closed outline is replaced by that single edge
 * stroked at a lower opacity — the fill still shows the full band.
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

  const lineToPathD = (pts) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const ringToPathD = (ring) => lineToPathD(ring) + " Z";

  return (
    <g>
      {strips.map((strip, i) => {
        if (!strip.polygon || strip.polygon.length < 3) return null;
        const d = ringToPathD(strip.polygon);
        const hasMainLine = strip.mainLine?.length >= 2;
        return (
          <g key={i}>
            <AnimatedPath
              d={d}
              fill={COLOR}
              fillOpacity={0.8}
              fillRule="evenodd"
              stroke="none"
              pointerEvents="none"
            />
            {hasMainLine ? (
              <path
                d={lineToPathD(strip.mainLine)}
                fill="none"
                stroke={COLOR}
                strokeOpacity={0.45}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            ) : (
              <AnimatedPath
                d={d}
                fill="none"
                stroke={COLOR}
                strokeWidth={3}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

export default TransientDetectedStripsLayer;
