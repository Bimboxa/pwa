import { useMemo } from "react";
import PropTypes from "prop-types";

import { Box } from "@mui/material";
import ShowChartIcon from "@mui/icons-material/ShowChart";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";

// Miniature of a profile DRAWING (readProfileSourceDrawing result): the
// visible run of the source polyline, arcs expanded, fitted in a square SVG,
// with a small ring on the base point (« Point de référence »). Strokes keep
// their screen width whatever the fit (non-scaling-stroke). Falls back to a
// greyed icon when the drawing is unreadable.
export default function ProfileThumbnail({ drawing, size = 56 }) {
  // data

  const svg = useMemo(() => {
    if (!drawing?.visiblePts?.length) return null;
    const pts = expandArcsInPath(drawing.visiblePts, 6, drawing.closed);
    if (pts.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const span = Math.max(maxX - minX, maxY - minY, 1);
    const pad = span * 0.08;
    const d =
      pts
        .map(
          (p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`
        )
        .join(" ") + (drawing.closed ? " Z" : "");
    return {
      viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${
        maxY - minY + 2 * pad
      }`,
      d,
      basePoint: drawing.refPt,
      ringR: Math.max(span * 0.04, 2),
    };
  }, [drawing]);

  // render

  if (!svg) {
    return (
      <Box
        sx={{
          width: size,
          height: size,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "text.disabled",
        }}
      >
        <ShowChartIcon sx={{ fontSize: size * 0.5 }} />
      </Box>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={svg.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <path
        d={svg.d}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {svg.basePoint && (
        <circle
          cx={svg.basePoint.x}
          cy={svg.basePoint.y}
          r={svg.ringR}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

ProfileThumbnail.propTypes = {
  drawing: PropTypes.shape({
    visiblePts: PropTypes.arrayOf(
      PropTypes.shape({ x: PropTypes.number, y: PropTypes.number })
    ),
    refPt: PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }),
    closed: PropTypes.bool,
  }),
  size: PropTypes.number,
};
