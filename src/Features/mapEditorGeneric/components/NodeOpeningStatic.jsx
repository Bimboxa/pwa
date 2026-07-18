import { memo, useMemo } from "react";
import { darken } from "@mui/material/styles";

import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";

// Canonical renderer for OPENING annotations (2-point POLYLINE with
// drawingShape "OPENING"): the band across the wall (real CM thickness) and
// two perpendicular jamb ticks at the endpoints — the architectural look of a
// door/window opening sitting in its carved gap.
//
// Accepts the same core props as NodePolylineStatic so it is drop-in usable
// from NodeAnnotationStatic and TransientTopologyLayer.

const HIT_STROKE_PADDING_SCREEN_PX = 20;

function NodeOpeningStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  baseMapMeterByPx,
  isTransient,
}) {
  const mergedAnnotation = useMemo(
    () =>
      coerceAnnotationNumericFields({
        ...(annotation ?? {}),
        ...(annotationOverride ?? {}),
      }),
    [annotation, annotationOverride]
  );

  const {
    id: annotationId,
    points,
    strokeColor = "#ff0000",
    strokeOpacity = 0.8,
    strokeWidth = 20,
    strokeWidthUnit = "CM",
  } = mergedAnnotation;

  const p1 = points?.[0];
  const p2 = points?.[1];

  const dataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": mergedAnnotation.entityId,
    "data-node-listing-id": mergedAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": mergedAnnotation.type,
  };

  const hoverColor = useMemo(() => {
    try {
      return darken(strokeColor, 0.2);
    } catch {
      return strokeColor;
    }
  }, [strokeColor]);

  if (!p1 || !p2) return null;
  if (!Number.isFinite(p1.x) || !Number.isFinite(p2.x)) return null;

  // Band thickness across the wall (CM → image px via the base map scale).
  const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;
  const bandWidth = isCmUnit
    ? (strokeWidth * 0.01) / baseMapMeterByPx
    : strokeWidth;

  const color = hovered || selected ? hoverColor : strokeColor;
  const angleDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  const jambLength = Math.max(bandWidth * 1.3, bandWidth + 2);

  return (
    <g data-capture-node={annotationId}>
      {/* Band */}
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={Math.max(bandWidth, 0.1)}
        strokeOpacity={strokeOpacity}
        strokeLinecap="butt"
        pointerEvents="none"
      />

      {/* Jamb ticks at both endpoints, perpendicular to the opening */}
      {[p1, p2].map((p, i) => (
        <g key={i} transform={`translate(${p.x}, ${p.y}) rotate(${angleDeg})`}>
          <line
            x1={0}
            y1={-jambLength / 2}
            x2={0}
            y2={jambLength / 2}
            stroke={color}
            strokeWidth={Math.max(bandWidth * 0.15, 0.5)}
            strokeOpacity={Math.min(1, strokeOpacity + 0.2)}
            pointerEvents="none"
          />
        </g>
      ))}

      {/* Selection halo */}
      {selected && (
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={color}
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {/* Hit area (zoom-independent padding) */}
      {!isTransient && (
        <line
          {...dataProps}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="transparent"
          strokeWidth={HIT_STROKE_PADDING_SCREEN_PX}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
        />
      )}
    </g>
  );
}

export default memo(NodeOpeningStatic);
