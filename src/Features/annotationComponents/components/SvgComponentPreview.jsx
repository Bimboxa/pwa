import { useMemo } from "react";

import { Box, useTheme } from "@mui/material";

import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import getAnnotationOffsetLineConfig from "Features/annotations/utils/getAnnotationOffsetLineConfig";
import getAnnotationPropsFromAnnotationTemplateProps from "Features/annotations/utils/getAnnotationPropsFromAnnotationTemplateProps";
import getAnnotationTemplateProps from "Features/annotations/utils/getAnnotationTemplateProps";
import getCotePageScale from "Features/annotations/utils/getCotePageScale";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import { getPrintZonePxPerPt } from "Features/baseMaps/utils/printZone";
import { STRIP_DASH_DEFAULTS } from "Features/geometry/utils/getStripePolygons";

import { COMPONENT_ITEM_TYPE_STRIP } from "../constants/componentConstants";

// Screen px of each of the two drawings (source / result).
const VIEW_WIDTH_PX = 72;
const VIEW_HEIGHT_PX = 84;
const SEGMENT_MARGIN_PX = 6;
// Free space kept around the widest drawing, as a ratio of its extent.
const FIT_MARGIN = 0.15;
// Screen px always left to the scaled (cm / pt) content.
const MIN_SCALED_HALF_WIDTH_PX = 8;
// Offset line label: gap to the line, in page pt (NodeOffsetLineStatic).
const OFFSET_LINE_TEXT_GAP_PT = 3;
const STRIP_DEFAULT_WIDTH_PX = 20;
// Image px = cm when the base map has no scale (nothing is to scale then).
const FALLBACK_METER_BY_PX = 0.01;

// Lateral extent of an annotation around its line: `scaled` in image px
// (real-world cm, page pt), `screen` in screen px (PX widths, constant on
// screen whatever the zoom).
function getLateralExtent(annotation, meterByPx) {
  let scaled = 0;
  let screen = 0;
  const hasScale = meterByPx > 0;
  const width = Number(annotation.strokeWidth) || 0;
  const isCm = annotation.strokeWidthUnit === "CM" && hasScale;
  if (annotation.type === COMPONENT_ITEM_TYPE_STRIP) {
    if (isCm) scaled = (width * 0.01) / meterByPx;
    else screen = width || STRIP_DEFAULT_WIDTH_PX;
  } else if (isCm) scaled = (width * 0.01) / meterByPx / 2;
  else screen = width / 2;

  const offsetLine = getAnnotationOffsetLineConfig(annotation);
  if (offsetLine.enabled) {
    const pageScale = getCotePageScale(annotation);
    // real-world cm through the base map scale, page pt otherwise
    const pxPerUnit =
      offsetLine.offsetUnit === "CM" && hasScale
        ? 0.01 / meterByPx
        : pageScale;
    const textPx =
      offsetLine.labelSource === "NONE"
        ? 0
        : (OFFSET_LINE_TEXT_GAP_PT + offsetLine.fontSize) * pageScale;
    scaled = Math.max(scaled, Math.abs(offsetLine.offset) * pxPerUnit + textPx);
  }
  return { scaled, screen };
}

// Schematic preview of a « Composant »: two vertical segments, both drawn
// from bottom to top. Left = the SOURCE annotation (line, or band on its
// side); right = the annotations the ENABLED items generate on that segment.
//
// The annotations are rendered by the nodes of the map editor
// (NodeAnnotationStatic), in the image px of the current base map: bands,
// dashes, offset lines and their labels come out exactly as on the plan, at
// one zoom — the one that fits the widest drawing in the view. PX widths stay
// in screen px, as on the plan.
//
// `source` = the draft annotation, `componentTemplate` = its template,
// `items` = see utils/getComponentItems, `baseMap` = the edited base map.
export default function SvgComponentPreview({
  source,
  componentTemplate,
  items,
  baseMap,
}) {
  // data

  const theme = useTheme();

  // helpers - base map scalars (stamped on the rows like useAnnotationsV2)

  const realMeterByPx = baseMap?.getMeterByPx?.();
  const hasScale = realMeterByPx > 0;
  const meterByPx = hasScale ? realMeterByPx : FALLBACK_METER_BY_PX;
  const imageSize = baseMap?.getImageSize?.() ?? baseMap?.image?.imageSize;
  const imageLongSidePx = imageSize
    ? Math.max(imageSize.width, imageSize.height)
    : undefined;
  const pagePxPerPt = getPrintZonePxPerPt(baseMap?.getPrintZone?.());

  // helpers - annotations, resolved against their template

  const { sourceAnnotation, childAnnotations, imagePxByScreenPx } =
    useMemo(() => {
      const stamp = { imageLongSidePx, pagePxPerPt, showLabel: false };
      const sourceOrientation = source?.stripOrientation === -1 ? -1 : 1;

      const resolve = (row, template) => {
        const templateProps = getAnnotationTemplateProps(template);
        return {
          ...getAnnotationPropsFromAnnotationTemplateProps(row, templateProps),
          annotationTemplateProps: templateProps,
          ...stamp,
        };
      };

      const rawSource = resolve(
        {
          ...(source ?? {}),
          id: "component-preview-source",
          stripOrientation: sourceOrientation,
        },
        componentTemplate
      );
      // same rows as applyComponentService
      const rawChildren = (items ?? [])
        .filter((item) => item.enabled)
        .map((item) =>
          resolve(
            {
              ...getNewAnnotationPropsFromAnnotationTemplate(item.template),
              id: `component-preview-${item.annotationTemplateId}`,
              type: item.type,
              ...(item.type === COMPONENT_ITEM_TYPE_STRIP
                ? {
                    stripOrientation:
                      sourceOrientation * (item.stripOrientation ?? 1),
                  }
                : {}),
            },
            item.template
          )
        );

      // zoom (image px per screen px) fitting the widest drawing
      let scaled = 0;
      let screen = 0;
      for (const annotation of [rawSource, ...rawChildren]) {
        const extent = getLateralExtent(annotation, hasScale ? meterByPx : 0);
        scaled = Math.max(scaled, extent.scaled);
        screen = Math.max(screen, extent.screen);
      }
      const freeHalfWidthPx = Math.max(
        VIEW_WIDTH_PX / 2 / (1 + FIT_MARGIN) - screen,
        MIN_SCALED_HALF_WIDTH_PX
      );
      const k = scaled > 0 ? scaled / freeHalfWidthPx : 1;

      // bottom to top
      const halfLength = ((VIEW_HEIGHT_PX - 2 * SEGMENT_MARGIN_PX) / 2) * k;
      const points = [
        { id: "component-preview-p0", x: 0, y: halfLength },
        { id: "component-preview-p1", x: 0, y: -halfLength },
      ];

      // A PX band is sized against the camera zoom of the map editor
      // (NodeStripStatic): handed over in cm, at the zoom of the preview.
      const finalize = (annotation) => {
        const next = { ...annotation, points };
        const isCm = annotation.strokeWidthUnit === "CM" && hasScale;
        if (annotation.type !== COMPONENT_ITEM_TYPE_STRIP || isCm) return next;
        const toCm = (px) => px * k * meterByPx * 100;
        return {
          ...next,
          strokeWidthUnit: "CM",
          strokeWidth: toCm(
            Number(annotation.strokeWidth) || STRIP_DEFAULT_WIDTH_PX
          ),
          dashLength: toCm(
            Number(annotation.dashLength) || STRIP_DASH_DEFAULTS.dashLength
          ),
          dashGap: toCm(
            Number(annotation.dashGap) || STRIP_DASH_DEFAULTS.dashGap
          ),
        };
      };

      const children = rawChildren.map(finalize);
      return {
        sourceAnnotation: finalize(rawSource),
        // bands first: the lines stay readable on top of them
        childAnnotations: [
          ...children.filter((a) => a.type === COMPONENT_ITEM_TYPE_STRIP),
          ...children.filter((a) => a.type !== COMPONENT_ITEM_TYPE_STRIP),
        ],
        imagePxByScreenPx: k,
      };
    }, [
      source,
      componentTemplate,
      items,
      hasScale,
      meterByPx,
      imageLongSidePx,
      pagePxPerPt,
    ]);

  const viewWidth = VIEW_WIDTH_PX * imagePxByScreenPx;
  const viewHeight = VIEW_HEIGHT_PX * imagePxByScreenPx;
  const viewBox = `${-viewWidth / 2} ${-viewHeight / 2} ${viewWidth} ${viewHeight}`;

  function renderView(annotations) {
    return (
      <svg
        width={VIEW_WIDTH_PX}
        height={VIEW_HEIGHT_PX}
        viewBox={viewBox}
        style={{ display: "block", pointerEvents: "none", flexShrink: 0 }}
      >
        {annotations.map((annotation) => (
          <NodeAnnotationStatic
            key={annotation.id}
            annotation={annotation}
            selected={false}
            hovered={false}
            baseMapMeterByPx={meterByPx}
            forceHideLabel
          />
        ))}
      </svg>
    );
  }

  // render

  if (!componentTemplate) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {renderView([sourceAnnotation])}
      <svg width="14" height="10" viewBox="0 0 14 10" style={{ flexShrink: 0 }}>
        <path
          d="M 1 5 H 13 m -3 -3 l 3 3 l -3 3"
          fill="none"
          stroke={theme.palette.text.disabled}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {renderView(childAnnotations)}
    </Box>
  );
}
