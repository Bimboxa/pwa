import { useMemo } from "react";
import { Box } from "@mui/material";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import { pickStyle } from "../utils/importStyleFields";

// Normalized [0..1] → source pixel space, for the SVG viewBox below.
function toPx(points, width, height) {
  return (points ?? []).map((p) => ({
    ...p,
    x: p.x * width,
    y: p.y * height,
  }));
}

/**
 * Read-only preview of the imported annotations, drawn inside a white box whose
 * aspect ratio matches the source image. Points (normalized [0..1]) are scaled
 * to source pixel space and the SVG viewBox spans the full image frame, so each
 * shape sits at its relative position within the image.
 */
export default function ImportAnnotationsPreview({
  data,
  widthMeters,
  excludedTemplateIds,
}) {
  const { width, height } = data?.image ?? {};

  // meters/px in the source image — lets COTE labels show real lengths.
  const sourceMeterByPx =
    widthMeters > 0 && width > 0 ? widthMeters / width : undefined;

  const previewAnnotations = useMemo(() => {
    if (!width || !height) return [];
    const excluded = new Set(excludedTemplateIds ?? []);
    const templatesById = new Map(
      (data.annotationTemplates || []).map((t) => [t.id, t])
    );
    return (data.annotations || [])
      .filter((ann) => !excluded.has(ann.annotationTemplateId))
      .map((ann, idx) => {
        const tpl = templatesById.get(ann.annotationTemplateId);
        // Dump rows come pre-scrubbed in `props`; inline JSON needs the merge.
        const style = ann.props ?? { ...pickStyle(tpl), ...pickStyle(ann) };
        return {
          ...style,
          id: ann.id ?? `preview_${idx}`,
          type: ann.type,
          drawingShape: resolveDrawingShapeFromType(ann.type),
          ...(ann.closeLine !== undefined ? { closeLine: ann.closeLine } : {}),
          ...(ann.point
            ? { point: toPx([ann.point], width, height)[0] }
            : { points: toPx(ann.points, width, height) }),
          ...(ann.cuts?.length
            ? {
                cuts: ann.cuts.map((cut) => ({
                  points: toPx(cut.points, width, height),
                })),
              }
            : {}),
        };
      });
  }, [data, width, height, excludedTemplateIds]);

  if (!width || !height) return null;

  return (
    <Box
      sx={{
        width: "100%",
        aspectRatio: `${width} / ${height}`,
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {previewAnnotations.map((annotation) => (
          <NodeAnnotationStatic
            key={annotation.id}
            annotation={annotation}
            selected={false}
            hovered={false}
            baseMapMeterByPx={sourceMeterByPx}
          />
        ))}
      </svg>
    </Box>
  );
}
