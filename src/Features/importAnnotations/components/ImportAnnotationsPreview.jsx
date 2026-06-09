import { useMemo } from "react";
import { Box } from "@mui/material";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

// Style fields propagated from a template onto its annotations for rendering.
const STYLE_FIELDS = [
  "fillColor",
  "fillOpacity",
  "fillType",
  "strokeColor",
  "strokeOpacity",
  "strokeWidth",
  "strokeWidthUnit",
  "strokeType",
  "unit",
  "decimals",
  "fontSize",
  "showUnitLabel",
  "extensionOffset",
  "extensionOffsetUnit",
];

function pickStyle(obj) {
  const out = {};
  for (const key of STYLE_FIELDS) {
    if (obj?.[key] !== undefined && obj[key] !== null) out[key] = obj[key];
  }
  return out;
}

/**
 * Read-only preview of the imported annotations, drawn inside a white box whose
 * aspect ratio matches the source image. Points (normalized [0..1]) are scaled
 * to source pixel space and the SVG viewBox spans the full image frame, so each
 * shape sits at its relative position within the image.
 */
export default function ImportAnnotationsPreview({ data, widthMeters }) {
  const { width, height } = data?.image ?? {};

  // meters/px in the source image — lets COTE labels show real lengths.
  const sourceMeterByPx =
    widthMeters > 0 && width > 0 ? widthMeters / width : undefined;

  const previewAnnotations = useMemo(() => {
    if (!width || !height) return [];
    const templatesById = new Map(
      (data.annotationTemplates || []).map((t) => [t.id, t])
    );
    return (data.annotations || []).map((ann, idx) => {
      const tpl = templatesById.get(ann.annotationTemplateId);
      const style = { ...pickStyle(tpl), ...pickStyle(ann) };
      return {
        ...style,
        id: ann.id ?? `preview_${idx}`,
        type: ann.type,
        drawingShape: resolveDrawingShapeFromType(ann.type),
        ...(ann.closeLine !== undefined ? { closeLine: ann.closeLine } : {}),
        points: ann.points.map((p) => ({
          x: p.x * width,
          y: p.y * height,
          ...(p.type ? { type: p.type } : {}),
        })),
      };
    });
  }, [data, width, height]);

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
