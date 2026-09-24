import { useMemo } from "react";
import { Box } from "@mui/material";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import { resolveDrawingShapeFromType } from "Features/annotations/constants/drawingShapeConfig";

import { imagePlacement } from "../utils/imageImport";
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
  // Optional picture of the source (same frame as `data.image`), drawn under
  // the annotations.
  backgroundUrl,
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
      .sort((a, b) => (a.sourceOrder ?? 0) - (b.sourceOrder ?? 0))
      .map((ann, idx) => {
        const tpl = templatesById.get(ann.annotationTemplateId);
        // Dump rows come pre-scrubbed in `props`; inline JSON needs the merge.
        const style = ann.props ?? { ...pickStyle(tpl), ...pickStyle(ann) };
        if (ann.type === "IMAGE") {
          const asset = data.imageAssets.find(
            (asset) => asset.id === ann.imageAssetId
          );
          return {
            id: ann.id,
            type: "IMAGE",
            opacity: ann.opacity ?? 1,
            ...imagePlacement(toPx(ann.points, width, height), {
              width: 1,
              height: 1,
            }),
            image: { imageUrlClient: `data:image/png;base64,${asset.base64}` },
          };
        }
        return {
          ...style,
          id: ann.id ?? `preview_${idx}`,
          type: ann.type,
          drawingShape: resolveDrawingShapeFromType(ann.type),
          ...(ann.closeLine !== undefined ? { closeLine: ann.closeLine } : {}),
          ...(ann.type === "FREE_TEXT"
            ? {
                // Same hydration as useAnnotationsV2: px anchors + the image
                // size NodeFreeTextStatic scales its page-point box with.
                textContent: ann.textContent ?? style.textContent,
                labelPoint: toPx(
                  [ann.labelPoint ?? ann.targetPoint],
                  width,
                  height
                )[0],
                targetPoint: toPx(
                  [ann.targetPoint ?? ann.labelPoint],
                  width,
                  height
                )[0],
                imageLongSidePx: Math.max(width, height),
                imageSize: { width, height },
              }
            : ann.point
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
        {backgroundUrl ? (
          <image
            href={backgroundUrl}
            x={0}
            y={0}
            width={width}
            height={height}
            preserveAspectRatio="none"
            opacity={0.55}
          />
        ) : null}
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
