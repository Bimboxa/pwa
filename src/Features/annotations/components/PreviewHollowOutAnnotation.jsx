import { useMemo } from "react";

import { Box } from "@mui/material";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import { SEGMENT_FLAG_FIELDS } from "../utils/segmentFlags";

const ARC_SAMPLES = 16;

const isValidPoint = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);

function ringToPath(points) {
  const pts = expandArcsInPath(points ?? [], ARC_SAMPLES, true).filter(
    isValidPoint
  );
  if (pts.length < 2) return "";
  return `M ${pts.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;
}

// Overview of the "Evider" result (DialogHollowOutAnnotation): the carved
// pieces rendered with the annotation's own style, over the dashed outline of
// the original polygon so the removed areas read at a glance. The viewBox is
// fitted on the ORIGINAL polygon: the frame stays put while the user toggles
// templates. `annotation` and `pieces` ({points, cuts}) are pixel-resolved.
export default function PreviewHollowOutAnnotation({
  annotation,
  pieces,
  padding = 0.06,
  height = 220,
}) {
  // helpers

  const { viewBox, originalD } = useMemo(() => {
    const outline = expandArcsInPath(
      annotation?.points ?? [],
      ARC_SAMPLES,
      true
    ).filter(isValidPoint);
    if (outline.length === 0) {
      return { viewBox: "0 0 100 100", originalD: "" };
    }
    const xs = outline.map((p) => p.x);
    const ys = outline.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const width = Math.max(Math.max(...xs) - minX, 1);
    const boxHeight = Math.max(Math.max(...ys) - minY, 1);
    const pad = Math.max(width, boxHeight) * padding;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${width + 2 * pad} ${boxHeight + 2 * pad}`,
      originalD: [
        ringToPath(annotation.points),
        ...(annotation.cuts ?? []).map((c) => ringToPath(c.points)),
      ].join(" "),
    };
  }, [annotation, padding]);

  const pieceAnnotations = useMemo(() => {
    // The carved rings no longer match the original segment indices / ids.
    const base = { ...annotation };
    for (const { idxField, idField } of SEGMENT_FLAG_FIELDS) {
      delete base[idxField];
      delete base[idField];
    }
    return (pieces ?? [])
      .filter((piece) => piece?.points?.length >= 3)
      .map((piece, i) => ({
        ...base,
        id: `${annotation.id}::hollowOutPreview::${i}`,
        points: piece.points,
        cuts: piece.cuts ?? [],
      }));
  }, [annotation, pieces]);

  // render

  return (
    <Box
      sx={{
        width: 1,
        height,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
      }}
    >
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      >
        {pieceAnnotations.map((piece) => (
          <NodeAnnotationStatic
            key={piece.id}
            annotation={piece}
            selected={false}
            hovered={false}
            printMode
            forceHideLabel
          />
        ))}
        {originalD && (
          <path
            d={originalD}
            fill="none"
            stroke="#9e9e9e"
            strokeWidth={1}
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </Box>
  );
}
