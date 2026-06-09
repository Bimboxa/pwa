import { nanoid } from "@reduxjs/toolkit";

import { getBbox } from "./meshGeometry";

// Generate the internal cut lines of a rows×cols grid over an outline's bbox.
// (e.g. 2×2 → one vertical + one horizontal line through the middle).
export default function gridMeshLines({ outlinePoints, rows = 2, cols = 2 }) {
  if (!outlinePoints || outlinePoints.length < 3) return [];
  const bbox = getBbox(outlinePoints);
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const lines = [];

  for (let c = 1; c < cols; c++) {
    const x = bbox.minX + (w * c) / cols;
    lines.push({
      id: nanoid(),
      orientation: "VERTICAL",
      p1: { x, y: bbox.minY },
      p2: { x, y: bbox.maxY },
    });
  }
  for (let r = 1; r < rows; r++) {
    const y = bbox.minY + (h * r) / rows;
    lines.push({
      id: nanoid(),
      orientation: "HORIZONTAL",
      p1: { x: bbox.minX, y },
      p2: { x: bbox.maxX, y },
    });
  }
  return lines;
}
