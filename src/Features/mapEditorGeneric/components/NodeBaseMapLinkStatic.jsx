import { memo, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { IconButton, Tooltip } from "@mui/material";
import {
  Link as LinkIcon,
  SwapHoriz as SwapHorizIcon,
} from "@mui/icons-material";
import theme from "Styles/theme";

import {
  setBaseMapLinkMenu,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";

import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import NodeSegmentLengthsStatic from "./NodeSegmentLengthsStatic";
import reverseBaseMapLinkDirectionService from "Features/baseMapLinks/services/reverseBaseMapLinkDirectionService";

import db from "App/db/db";

// BASE_MAP_LINK ("Coupe - Elévation") renderer — a section mark.
//
// The 2 stored points are the cut line. Short perpendicular ticks at both
// ends, the annotation label beyond each end, and two view-direction arrows
// on the OBSERVER side: the screen-right of the p1 → p2 direction (the side
// the linked elevation faces once posed — see
// computeVerticalBaseMapPlacementFromLink). Everything but the line itself is
// drawn in screen px inside counter-scaled groups.
//
// Two flavours share this node:
//   - the SOURCE mark on a plan (`linkedBaseMapId` → a vertical base map): the
//     quick-action row gains a "Lier à un fond de plan" button (menu outlet in
//     MainMapEditorV3) and, once linked, a "Voir le fond de plan" button
//     opens the target in the editor;
//   - its CLONE on that elevation (`sourceLinkAnnotationId`): "Voir le plan"
//     goes back to the plan hosting the source.

const TICK_HALF_PX = 8;
const ARROW_PX = 12;
const ARROW_GAP_PX = 6;
const LABEL_OFFSET_PX = 14;
const LABEL_FONT_PX = 12;
const ACCENT_COLOR = "#2196f3";

const fontStyles = {
  fontFamily: theme.typography?.fontFamily ?? "Roboto, sans-serif",
};

function NodeBaseMapLinkStatic({
  annotation,
  annotationOverride,
  selected,
  baseMapMeterByPx,
  containerK,
  isTransient,
  selectedPointId,
  selectedPointIds = [],
  selectedPartId,
  printMode,
  disableVertexEditing = false,
}) {
  if (annotation.id.startsWith("temp")) selected = true;

  const dispatch = useDispatch();

  // strings

  const linkS = "Lier à un fond de plan";
  const reverseS = "Inverser le sens (côté observateur)";
  const viewBaseMapS = "Voir le fond de plan";
  const viewPlanS = "Voir le plan";

  // state

  const [hoveredPartId, setHoveredPartId] = useState(null);

  // data

  const mergedAnnotation = coerceAnnotationNumericFields({
    ...annotation,
    ...annotationOverride,
  });

  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );
  const segmentDragEnabled = useSelector((s) => s.mapEditor.segmentDragEnabled);
  const vertexSizeMultiplier =
    useSelector((s) => s.mapEditor.vertexSizeMultiplier) || 1;

  let {
    id: annotationId,
    points = [],
    strokeColor = theme.palette.secondary.main,
    strokeOpacity = 1,
    strokeWidth = 2,
    linkedBaseMapId,
    sourceLinkAnnotationId,
  } = mergedAnnotation || {};

  if (!strokeColor) strokeColor = theme.palette.secondary.main;

  const isClone = Boolean(sourceLinkAnnotationId);
  const showNavButtons = selected && !isTransient && !printMode;

  // Linked target (source) / source link (clone) — raw records, read only
  // while the buttons can show, so the map never pays for idle nodes.
  const linkedBaseMap = useLiveQuery(
    async () =>
      showNavButtons && linkedBaseMapId
        ? db.baseMaps.get(linkedBaseMapId)
        : null,
    [showNavButtons, linkedBaseMapId]
  );
  const sourceLink = useLiveQuery(
    async () =>
      showNavButtons && sourceLinkAnnotationId
        ? db.annotations.get(sourceLinkAnnotationId)
        : null,
    [showNavButtons, sourceLinkAnnotationId]
  );

  const commonDataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": mergedAnnotation.entityId,
    "data-node-listing-id": mergedAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "BASE_MAP_LINK",
  };

  // geometry

  const p1 = points[0];
  const p2 = points[1];
  const hasSegment =
    p1 &&
    p2 &&
    Number.isFinite(p1.x) &&
    Number.isFinite(p1.y) &&
    Number.isFinite(p2.x) &&
    Number.isFinite(p2.y);

  const dx = hasSegment ? p2.x - p1.x : 0;
  const dy = hasSegment ? p2.y - p1.y : 0;
  const lengthPx = Math.hypot(dx, dy);
  const ux = lengthPx > 0 ? dx / lengthPx : 1;
  const uy = lengthPx > 0 ? dy / lengthPx : 0;
  // Observer side: screen-right of p1 → p2 (y-down frame).
  const nx = -uy;
  const ny = ux;
  const rawAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // Upright label text (NodeCoteStatic pattern).
  let labelAngleDeg = rawAngleDeg;
  if (labelAngleDeg > 90) labelAngleDeg -= 180;
  else if (labelAngleDeg < -90) labelAngleDeg += 180;

  const label = getAnnotationOwnLabel(mergedAnnotation);

  // Arrow polygon in screen px around a local origin ON the segment: base on
  // the observer side (offset along n), tip pointing back at the segment.
  const arrowPoints = useMemo(() => {
    const size = ARROW_PX;
    const ox = nx * (size + ARROW_GAP_PX);
    const oy = ny * (size + ARROW_GAP_PX);
    const tipx = ox - nx * size;
    const tipy = oy - ny * size;
    const bx = ox + nx * size * 0.4;
    const by = oy + ny * size * 0.4;
    const c1x = bx + ux * size * 0.7;
    const c1y = by + uy * size * 0.7;
    const c2x = bx - ux * size * 0.7;
    const c2y = by - uy * size * 0.7;
    return `${tipx},${tipy} ${c1x},${c1y} ${c2x},${c2y}`;
  }, [nx, ny, ux, uy]);

  const arrowAnchors = useMemo(() => {
    if (!hasSegment) return [];
    return [0.15, 0.85].map((t) => ({
      x: p1.x + dx * t,
      y: p1.y + dy * t,
    }));
  }, [hasSegment, p1, dx, dy]);

  // handlers

  const handleOpenLinkMenu = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    dispatch(
      setBaseMapLinkMenu({
        annotationId,
        anchorPosition: {
          top: rect.bottom + 4,
          left: rect.left + rect.width / 2,
        },
      })
    );
  };

  const handleReverse = (e) => {
    e.stopPropagation();
    reverseBaseMapLinkDirectionService({ linkId: annotationId, dispatch });
  };

  const handleViewBaseMap = (e) => {
    e.stopPropagation();
    if (linkedBaseMapId) dispatch(setSelectedMainBaseMapId(linkedBaseMapId));
  };

  const handleViewPlan = (e) => {
    e.stopPropagation();
    if (sourceLink?.baseMapId)
      dispatch(setSelectedMainBaseMapId(sourceLink.baseMapId));
  };

  // render helpers

  const POINT_SIZE = 6 * vertexSizeMultiplier;
  const HALF_SIZE = POINT_SIZE / 2;

  const renderVertex = (pt) => {
    const isPointSelected =
      selectedPointId === pt.id || selectedPointIds.includes(pt.id);
    return (
      <g
        key={pt.id}
        transform={`translate(${pt.x}, ${pt.y})`}
        style={{
          cursor: isTransient ? "crosshair" : "pointer",
          pointerEvents: "all",
        }}
        data-node-type="VERTEX"
        data-point-id={pt.id}
        data-annotation-id={annotationId}
      >
        <g style={{ transform: counterScaleTransform }}>
          <rect
            x={-HALF_SIZE}
            y={-HALF_SIZE}
            width={POINT_SIZE}
            height={POINT_SIZE}
            fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
            stroke="#2196f3"
            strokeWidth={1.5}
          />
        </g>
      </g>
    );
  };

  // Screen-px decoration at an end point: perpendicular tick + label beyond
  // the end (dir = +1 past p2, -1 past p1).
  const renderEnd = (pt, dir, key) => (
    <g key={key} transform={`translate(${pt.x}, ${pt.y})`}>
      <g style={{ transform: counterScaleTransform, pointerEvents: "none" }}>
        <line
          x1={nx * TICK_HALF_PX}
          y1={ny * TICK_HALF_PX}
          x2={-nx * TICK_HALF_PX}
          y2={-ny * TICK_HALF_PX}
          stroke={strokeColor}
          strokeOpacity={strokeOpacity}
          strokeWidth={2}
        />
        {label && (
          <g
            transform={`translate(${ux * dir * LABEL_OFFSET_PX}, ${
              uy * dir * LABEL_OFFSET_PX
            }) rotate(${labelAngleDeg})`}
          >
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={LABEL_FONT_PX}
              fontWeight={700}
              fill={strokeColor}
              fillOpacity={strokeOpacity}
              stroke="#ffffff"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ ...fontStyles, userSelect: "none" }}
            >
              {label}
            </text>
          </g>
        )}
      </g>
    </g>
  );

  const renderNavButton = (labelText, onClick) => (
    <button
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onClick}
      style={{
        ...fontStyles,
        fontSize: "12px",
        fontWeight: 500,
        whiteSpace: "nowrap",
        padding: "4px 10px",
        background: "#ffffff",
        color: "#000000",
        border: "1px solid #555555",
        borderRadius: "16px",
        boxShadow: "0px 2px 3px rgba(0,0,0,0.3)",
        cursor: "pointer",
        pointerEvents: "auto",
      }}
    >
      {labelText}
    </button>
  );

  if (!hasSegment || lengthPx <= 0) return null;

  const segPartId = `${annotationId}::SEG::0`;
  const lineStroke =
    selected && selectedPartId === segPartId
      ? theme.palette.annotation?.selectedPart || "#ff0000"
      : hoveredPartId === segPartId && selected
        ? ACCENT_COLOR
        : strokeColor;

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const navLabel = isClone
    ? sourceLink?.baseMapId
      ? viewPlanS
      : null
    : linkedBaseMapId
      ? viewBaseMapS
      : null;
  const navTooltip = linkedBaseMap?.name ?? "";

  // Quick-action row extra buttons (source marks only, real records only):
  // link target menu + direct "Inverser le sens".
  const overlayButtonSx = {
    bgcolor: "rgba(255,255,255,0.9)",
    border: `1px solid ${ACCENT_COLOR}`,
    "&:hover": { bgcolor: "white" },
    p: 0.5,
  };
  const showExtraButtons =
    !isClone && !isTransient && !String(annotationId).startsWith("temp");
  const extraButtons = showExtraButtons ? (
    <>
      <Tooltip
        placement="top"
        arrow
        title={
          linkedBaseMapId && linkedBaseMap?.name
            ? `${linkS} — ${linkedBaseMap.name}`
            : linkS
        }
      >
        <IconButton
          size="small"
          onClick={handleOpenLinkMenu}
          sx={{
            ...overlayButtonSx,
            color: linkedBaseMapId ? ACCENT_COLOR : "text.disabled",
          }}
        >
          <LinkIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
      <Tooltip placement="top" arrow title={reverseS}>
        <IconButton
          size="small"
          onClick={handleReverse}
          sx={{ ...overlayButtonSx, color: ACCENT_COLOR }}
        >
          <SwapHorizIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </>
  ) : null;

  return (
    <g {...commonDataProps}>
      {/* cut line — hit surface + visible stroke */}
      <g
        onMouseEnter={
          selected
            ? (e) => {
                e.stopPropagation();
                setHoveredPartId(segPartId);
              }
            : undefined
        }
        onMouseLeave={selected ? () => setHoveredPartId(null) : undefined}
        data-part-id={selected ? segPartId : undefined}
        data-part-type={selected ? "SEG" : undefined}
        data-node-id={annotationId}
        style={{
          cursor: isTransient
            ? "crosshair"
            : interactionMode === "EDIT" ||
                (interactionMode == null && segmentDragEnabled && selected)
              ? "move"
              : "pointer",
        }}
      >
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke="rgba(0,0,0,0)"
          strokeWidth={22}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "stroke" }}
        />
        <line
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={lineStroke}
          strokeWidth={selected ? Math.max(strokeWidth, 2) + 1 : strokeWidth}
          strokeOpacity={strokeOpacity}
          strokeDasharray={isClone ? "10 6" : undefined}
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      </g>

      {/* end ticks + labels */}
      {renderEnd(p1, -1, "end-1")}
      {renderEnd(p2, 1, "end-2")}

      {/* view-direction arrows on the observer side */}
      {arrowAnchors.map((a, i) => (
        <g key={`arrow-${i}`} transform={`translate(${a.x}, ${a.y})`}>
          <g
            style={{ transform: counterScaleTransform, pointerEvents: "none" }}
          >
            <polygon
              points={arrowPoints}
              fill={strokeColor}
              fillOpacity={strokeOpacity}
            />
          </g>
        </g>
      ))}

      {/* vertices */}
      {selected &&
        !disableVertexEditing &&
        points.map((pt) => renderVertex(pt))}

      {/* navigation button under the midpoint, opposite the arrows */}
      {showNavButtons && navLabel && (
        <g transform={`translate(${mid.x}, ${mid.y})`}>
          <g style={{ transform: counterScaleTransform }}>
            <foreignObject
              x={-120}
              y={18}
              width={240}
              height={40}
              style={{ overflow: "visible" }}
            >
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "center",
                }}
                title={navTooltip}
              >
                {renderNavButton(
                  navLabel,
                  isClone ? handleViewPlan : handleViewBaseMap
                )}
              </div>
            </foreignObject>
          </g>
        </g>
      )}

      {/* quick-action row above the mark (move / cotes / segment drag /
          angles) + the "Lier à un fond de plan" button */}
      {selected && !disableVertexEditing && (
        <NodeSegmentLengthsStatic
          annotation={mergedAnnotation}
          points={points}
          closed={false}
          selected={selected}
          selectedPointId={selectedPointId}
          baseMapMeterByPx={baseMapMeterByPx}
          containerK={containerK}
          printMode={printMode}
          isTransient={isTransient}
          disableVertexEditing={disableVertexEditing}
          extraButtons={extraButtons}
          extraButtonCount={extraButtons ? 2 : 0}
        />
      )}
    </g>
  );
}

export default memo(NodeBaseMapLinkStatic);
