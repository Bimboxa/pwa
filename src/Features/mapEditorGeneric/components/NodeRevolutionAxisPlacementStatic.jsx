import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";

import db from "App/db/db";
import theme from "Styles/theme";

import { BASE_MAP_LINK_CLONE_LABEL } from "Features/baseMapLinks/utils/baseMapLinkCloneLabel";
import getRevolutionAxisPlacementNavTargetId from "Features/revolutionAxes/utils/getRevolutionAxisPlacementNavTargetId";

// A plan revolution axis instantiated on a VERTICAL base map: an inverted "T" —
// the orange DIAMETER of the plan circle laid horizontally, the black dashed
// AXIS rising from the centre over the axis height, and the centre dot.
//
// Placing this node is what poses the base map in 3D (the plane is rotated so
// it contains the axis), so the drawing reads as the section trace of the plan
// circle: the orange bar is exactly the plan diameter seen edge-on.
//
// `revolutionAxisRadiusM` / `revolutionAxisHeightM` are resolved upstream by
// useAnnotationsV2 (they live on the linked plan axis, on another base map).
//
// Under the left end of the bar, a fixed-size « Vue en plan » label (same as
// the clone of a section mark, NodeBaseMapLinkStatic): a click on it opens the
// plan hosting the axis, the hover tooltip previews that plan (`data-link-nav`,
// InteractionLayer → MapTooltip). The T itself selects / drags the placement.
const BLACK = "#000000";
const CENTER_DOT_PX = 2.5;
const HIT_STROKE_PX = 12;
const FALLBACK_HALF_PX = 60;
const FALLBACK_HEIGHT_PX = 150;
const LABEL_FONT_PX = 11;
const LABEL_OFFSET_Y_PX = 10;

const fontStyles = {
  fontFamily: theme.typography?.fontFamily ?? "Roboto, sans-serif",
};

export default function NodeRevolutionAxisPlacementStatic({
  annotation,
  annotationOverride,
  selected,
  hovered,
  dragged,
  containerK = 1,
  baseMapMeterByPx,
  printMode,
}) {
  const dispatch = useDispatch();

  const mergedAnnotation = { ...annotation, ...annotationOverride };

  const {
    id,
    listingId,
    strokeColor,
    revolutionAxisRadiusM,
    revolutionAxisHeightM,
  } = mergedAnnotation;

  // Robust position read: drag puts x/y at the root, the DB stores point.x/y.
  const cx = mergedAnnotation.x ?? mergedAnnotation.point?.x ?? 0;
  const cy = mergedAnnotation.y ?? mergedAnnotation.point?.y ?? 0;

  // Plan hosting the axis. Checked against the db: a deleted plan leaves the
  // label as a plain selection target.
  const navTargetId = getRevolutionAxisPlacementNavTargetId(mergedAnnotation);
  const navTargetExists = useLiveQuery(async () => {
    if (!navTargetId) return false;
    const record = await db.baseMaps.get(navTargetId);
    return Boolean(record && !record.deletedAt);
  }, [navTargetId]);
  const canNavigate = Boolean(navTargetExists) && !printMode;

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;

  const { halfPx, heightPx } = useMemo(() => {
    const r = Number(revolutionAxisRadiusM);
    const h = Number(revolutionAxisHeightM);
    return {
      halfPx:
        hasScale && Number.isFinite(r) && r > 0
          ? r / baseMapMeterByPx
          : FALLBACK_HALF_PX,
      heightPx:
        hasScale && Number.isFinite(h) && h > 0
          ? h / baseMapMeterByPx
          : FALLBACK_HEIGHT_PX,
    };
  }, [
    revolutionAxisRadiusM,
    revolutionAxisHeightM,
    hasScale,
    baseMapMeterByPx,
  ]);

  const k = containerK || 1;
  const scaleTransform = useMemo(
    () => `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`,
    [k]
  );

  const orange = strokeColor || theme.palette.secondary.main;
  const strokeW = selected || hovered ? 2 : 1;

  // With a plan to open, the label navigates instead of selecting: the
  // mousedown never reaches the editor's selection / drag.
  const labelNavProps = canNavigate
    ? {
        "data-link-nav": "1",
        onMouseDown: (e) => e.stopPropagation(),
        onClick: (e) => {
          e.stopPropagation();
          dispatch(setSelectedMainBaseMapId(navTargetId));
        },
      }
    : {};

  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "REVOLUTION_AXIS_PLACEMENT",
    "data-interaction": "draggable",
  };

  return (
    <g
      style={{
        cursor: dragged ? "grabbing" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Fat transparent hit areas over both bars. */}
      <line
        x1={cx - halfPx}
        y1={cy}
        x2={cx + halfPx}
        y2={cy}
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - heightPx}
        stroke="transparent"
        strokeWidth={HIT_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="stroke"
      />

      {/* The revolution axis itself, rising over `height` metres. */}
      <line
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - heightPx}
        stroke={BLACK}
        strokeWidth={strokeW}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />

      {/* The plan diameter, seen edge-on. */}
      <line
        x1={cx - halfPx}
        y1={cy}
        x2={cx + halfPx}
        y2={cy}
        stroke={orange}
        strokeWidth={strokeW}
        vectorEffect="non-scaling-stroke"
      />

      {/* « Vue en plan » — fixed screen size, under the left end of the bar. */}
      {navTargetId && (
        <g transform={`translate(${cx - halfPx}, ${cy})`}>
          <g style={{ transform: scaleTransform }}>
            <text
              x={0}
              y={LABEL_OFFSET_Y_PX}
              textAnchor="start"
              dominantBaseline="central"
              fontSize={LABEL_FONT_PX}
              fontWeight={400}
              fill={orange}
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
              style={{
                ...fontStyles,
                userSelect: "none",
                pointerEvents: "all",
                cursor: "pointer",
              }}
              {...labelNavProps}
            >
              {BASE_MAP_LINK_CLONE_LABEL}
            </text>
          </g>
        </g>
      )}

      {/* Centre */}
      <g transform={`translate(${cx}, ${cy})`}>
        <g style={{ transform: scaleTransform }}>
          <circle cx={0} cy={0} r={CENTER_DOT_PX} fill={BLACK} />
          {selected && (
            <circle
              cx={0}
              cy={0}
              r={CENTER_DOT_PX + 3.5}
              fill="none"
              stroke={orange}
              strokeWidth={1}
            />
          )}
        </g>
      </g>
    </g>
  );
}
