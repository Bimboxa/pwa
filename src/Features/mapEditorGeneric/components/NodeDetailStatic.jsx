import { memo, useMemo, useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { openResourceAtPage } from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";

import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";
import { getTextPageScale } from "Features/annotations/constants/freeTextConstants";
import getAnnotationDetailSizeConfig from "Features/annotations/utils/getAnnotationDetailSizeConfig";
import getDetailBubbleGeometry, {
  DETAIL_LINE_HEIGHT,
  DETAIL_EMPTY_TEXT,
} from "Features/annotations/utils/getDetailBubbleGeometry";
import measureTextWidth from "Features/annotations/utils/measureTextWidth";

import { darken } from "@mui/material/styles";

import db from "App/db/db";

// --- CONSTANTES (screen px — edit helpers only, counter-scaled) ---
const ROT_GRAB_W = 14;
const ROT_GRIP_R = 5;
const CROSSHAIR_HALF = 10;

// Rotation cursor — circular arrow (270° arc + chevron head), white halo
// under a black stroke so it reads on any background. Hotspot = center.
// Same data-URI pattern as CURSOR_ADD / CURSOR_REMOVE in NodePolylineStatic.
const CURSOR_ROTATE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><g fill='none' stroke-linecap='round' stroke-linejoin='round'><path d='M12 5 A7 7 0 1 1 5 12 M2 15 L5 11 L8 15' stroke='white' stroke-width='4.5'/><path d='M12 5 A7 7 0 1 1 5 12 M2 15 L5 11 L8 15' stroke='black' stroke-width='2'/></g></svg>") 12 12, grab`;

// DETAIL node — a "detail bubble": white circle with a thick ring containing
// a short label, plus a filled triangular arrow whose TIP is the annotation's
// stored point. The tip sits at the local origin so it stays glued to the
// exact spot at any zoom; the bubble is drawn opposite the arrow direction
// (arrowAngle, degrees, 0 = arrow pointing right, clockwise-positive in the
// y-down SVG screen frame).
// The bubble is FIXED relative to the base map (it zooms with the plan) and
// sized from its text: the font size is a page point of the base map's print
// zone (FREE_TEXT rules, getTextPageScale) and every dimension derives from
// it (getDetailBubbleGeometry). Only the edit helpers keep a screen size.
function NodeDetailStatic({
  annotation,
  annotationOverride, // transient drag override
  hovered,
  selected,
  dragged,
  draggedPartType,
  containerK = 1,
}) {
  const dispatch = useDispatch();

  // strings

  const viewBaseMapS = "Voir le fond de plan";
  const viewSourceS = "Voir la source";

  // data

  const merged = { ...annotation, ...annotationOverride };
  const { id, listingId, entityId, fillColor = "#2196f3" } = merged;
  const arrowAngle = merged.arrowAngle ?? 0;
  const detailBaseMapId = merged.detailBaseMapId;

  // The tip position (resolved px). Drag overrides may put x/y at the root.
  const tipX = merged.x ?? merged.point?.x ?? 0;
  const tipY = merged.y ?? merged.point?.y ?? 0;

  // The bubble shows the annotation's OWN label (useAnnotationsV2 replaces
  // `label` with the ENTITY label on entity-linked rows).
  const ownLabel = merged.annotationLabel ?? merged.label ?? "";

  // Linked detail baseMap — raw record only (no hydration: rendering the
  // detail image must stay lazy), same pattern as MapTooltip.
  const detailBaseMap = useLiveQuery(
    async () => (detailBaseMapId ? db.baseMaps.get(detailBaseMapId) : null),
    [detailBaseMapId]
  );

  // The baseMap's detailRef is the single source of truth for the bubble of
  // every annotation linked to it; ownLabel is the unlinked/legacy fallback.
  const bubbleText = (detailBaseMapId && detailBaseMap?.detailRef) || ownLabel;

  // state — inline label editing (NodeLabelStatic pattern)

  const [localValue, setLocalValue] = useState(bubbleText);

  useEffect(() => {
    setLocalValue(bubbleText);
  }, [bubbleText]);

  // helpers

  const { fontSize } = getAnnotationDetailSizeConfig(merged);

  // Page-pt → image-px scale (print zone of the base map). Rows that were
  // not stamped by useAnnotationsV2 (drafts) fall back to 1.
  const pageScale = useMemo(() => {
    const scale = getTextPageScale({
      pagePxPerPt: merged.pagePxPerPt,
      pageFormat: "A4",
      imageLongSidePx: merged.imageLongSidePx,
    });
    return scale > 0 ? scale : 1;
  }, [merged.pagePxPerPt, merged.imageLongSidePx]);

  // The bubble follows the text being typed.
  const displayedText = selected ? localValue : bubbleText;
  const geometry = useMemo(
    () =>
      getDetailBubbleGeometry({
        text: displayedText,
        fontSize,
        measureTextWidth,
      }),
    [displayedText, fontSize]
  );
  const {
    radius,
    ringWidth,
    arrowLen,
    arrowHalfW,
    arrowBaseOverlap,
    tipOffset,
    hitRadius,
    rotRingR,
    textHeight,
  } = geometry;

  const rad = (arrowAngle * Math.PI) / 180;
  // Bubble center, opposite the arrow (y-down frame: cos/sin used as-is).
  const cx = -tipOffset * Math.cos(rad);
  const cy = -tipOffset * Math.sin(rad);

  // Edit helpers keep a constant screen size inside the page-pt frame:
  // counter-scale by container k, map zoom AND the page scale (same formula
  // as NodeLabelStatic — --map-zoom is written by MapEditorViewport, missing
  // var falls back to 1 outside the map editor, e.g. portfolio).
  const uiScaleExpr = useMemo(() => {
    const k = containerK || 1;
    return `calc(1 / (var(--map-zoom, 1) * ${k * pageScale}))`;
  }, [containerK, pageScale]);
  const uiScaleTransform = `scale(${uiScaleExpr})`;

  const displayColor = useMemo(() => {
    if (hovered || selected) {
      try {
        return darken(fillColor, 0.2);
      } catch {
        return fillColor;
      }
    }
    return fillColor;
  }, [fillColor, hovered, selected]);

  // px = page pt inside the scaled frame
  const fontStyles = {
    fontFamily: "Roboto, Helvetica, Arial, sans-serif",
    fontSize: `${fontSize}px`,
    fontWeight: "bold",
    lineHeight: DETAIL_LINE_HEIGHT,
    color: "#000000",
    whiteSpace: "pre",
  };

  // refs to access latest values in the deselect cleanup
  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  const labelRef = useRef(bubbleText);
  labelRef.current = bubbleText;
  const detailBaseMapIdRef = useRef(detailBaseMapId);
  detailBaseMapIdRef.current = detailBaseMapId;

  // handlers

  // Linked: the edit targets the baseMap's detailRef (shared by every linked
  // annotation). Unlinked: legacy per-annotation label.
  const saveLabel = async (value) => {
    try {
      const targetBaseMapId = detailBaseMapIdRef.current;
      if (targetBaseMapId) {
        await db.baseMaps.update(targetBaseMapId, {
          detailRef: value.trim() || null,
        });
        dispatch(triggerEntitiesTableUpdate("baseMaps"));
      } else {
        await db.annotations.update(id, { label: value });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlur = () => {
    if (localValue !== bubbleText) {
      saveLabel(localValue);
    }
  };

  // Save pending changes when deselected (textarea unmount skips onBlur)
  useEffect(() => {
    if (!selected) return;
    return () => {
      if (localValueRef.current !== labelRef.current) {
        saveLabel(localValueRef.current);
      }
    };
  }, [selected]);

  const handleFocus = (e) => {
    const val = e.target.value;
    e.target.setSelectionRange(val.length, val.length);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation(); // keep global hotkeys (e.g. delete) out of the textarea
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  };

  // Open the linked detail baseMap in the map editor (same selection as the
  // "Détails" section of the left panel).
  const handleViewBaseMap = (e) => {
    e.stopPropagation();
    dispatch(setSelectedMainBaseMapId(detailBaseMapId));
  };

  // Open the RESOURCES right panel on the source PDF, at the detail's page.
  const handleViewSource = async (e) => {
    e.stopPropagation();
    const record = await db.baseMaps.get(detailBaseMapId);
    const createdFrom = record?.createdFrom;
    if (!createdFrom) return;
    // The resourceId hint may be stale after a resource re-import.
    const resource = await resolveDetailResource({
      createdFrom,
      projectId: record.projectId,
    });
    const resourceId = resource?.id ?? createdFrom.resourceId;
    if (!resourceId) return;
    dispatch(
      openResourceAtPage({
        resourceId,
        pageNumber: createdFrom.pageNumber ?? 1,
        rotation: createdFrom.rotation ?? 0,
      })
    );
    dispatch(setSelectedMenuItemKey("RESOURCES"));
  };

  // data attributes for the InteractionLayer hit detection
  const dataProps = {
    "data-node-id": id,
    "data-node-entity-id": entityId,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "DETAIL",
    "data-interaction": "draggable",
  };

  // render

  return (
    <g
      transform={`translate(${tipX}, ${tipY})`}
      style={{
        // Selected: the bubble/arrow are a move-drag zone → "move" (4 arrows);
        // the rotate ring below overrides with its own cursor.
        cursor: dragged ? "grabbing" : selected ? "move" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Page-pt frame (map-fixed) — origin = arrow TIP */}
      <g transform={`scale(${pageScale})`}>
        {/* Arrow — the only rotated element; its base overlaps under
                    the bubble fill so the joint stays clean at any angle */}
        <g transform={`rotate(${arrowAngle})`}>
          <path
            d={`M 0 0 L ${-(arrowLen + arrowBaseOverlap)} ${-arrowHalfW} L ${-(arrowLen + arrowBaseOverlap)} ${arrowHalfW} Z`}
            fill={displayColor}
          />
        </g>

        {/* Bubble — drawn after the arrow (white fill masks the base
                    overlap), NOT rotated so the label stays upright */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="#ffffff"
          stroke={displayColor}
          strokeWidth={ringWidth}
          style={
            selected
              ? { filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" }
              : {}
          }
        />

        {/* Hit zone — bubble only, the tip area stays click-free */}
        <circle cx={cx} cy={cy} r={hitRadius} fill="transparent" />

        {/* Label — centered on the bubble, editable inline when selected */}
        <foreignObject
          x={cx - radius}
          y={cy - radius}
          width={radius * 2}
          height={radius * 2}
          style={{ overflow: "visible" }}
        >
          <div
            onMouseDown={(e) => selected && e.stopPropagation()}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              pointerEvents: selected ? "auto" : "none",
              userSelect: "none",
            }}
          >
            {selected ? (
              <textarea
                value={localValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                onFocus={handleFocus}
                onKeyDown={handleKeyDown}
                style={{
                  ...fontStyles,
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  textAlign: "center",
                  // Vertically center the text in the bubble.
                  boxSizing: "border-box",
                  padding: 0,
                  paddingTop: `${radius - textHeight / 2}px`,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  overflow: "hidden",
                  margin: 0,
                  cursor: "text",
                }}
              />
            ) : (
              <span style={fontStyles}>{bubbleText || DETAIL_EMPTY_TEXT}</span>
            )}
          </div>
        </foreignObject>

        {/* Rotation helper — selected only: dashed orbit centered on
                    the TIP + wide invisible grab ring caught by the
                    rotate-annotation machinery (pivot = the tip, see the
                    DETAIL rotationContext in InteractionLayer) */}
        {selected && !dragged && (
          <>
            <circle
              r={rotRingR}
              fill="none"
              stroke="#555555"
              strokeWidth={1}
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
            <circle
              r={rotRingR}
              fill="none"
              stroke="transparent"
              data-interaction="rotate-annotation"
              data-node-id={id}
              style={{
                // screen-constant grab width
                strokeWidth: `calc(${ROT_GRAB_W}px * ${uiScaleExpr})`,
                pointerEvents: "stroke",
                cursor: CURSOR_ROTATE,
              }}
            />
            {/* Grip dot on the arrow side, as affordance */}
            <g
              transform={`translate(${rotRingR * Math.cos(rad)}, ${rotRingR * Math.sin(rad)})`}
              style={{ pointerEvents: "none" }}
            >
              <circle
                r={ROT_GRIP_R}
                fill="#ffffff"
                stroke="#555555"
                style={{ transform: uiScaleTransform }}
              />
            </g>

            {/* Action buttons — linked only: "Voir le fond de plan" selects
                the detail baseMap in the map editor, "Voir la source" opens
                the RESOURCES panel on the source PDF at the detail's page */}
            {detailBaseMapId && (
              <g transform={`translate(0, ${rotRingR})`}>
                <foreignObject
                  x={-140}
                  y={10}
                  width={280}
                  height={40}
                  style={{ overflow: "visible", transform: uiScaleTransform }}
                >
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      gap: "8px",
                    }}
                  >
                    {[
                      { label: viewBaseMapS, onClick: handleViewBaseMap },
                      { label: viewSourceS, onClick: handleViewSource },
                    ].map(({ label, onClick }) => (
                      <button
                        key={label}
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
                        {label}
                      </button>
                    ))}
                  </div>
                </foreignObject>
              </g>
            )}
          </>
        )}

        {/* Crosshair during a move drag (NodePointStatic pattern) */}
        {dragged && draggedPartType !== "ROTATE" && (
          <g
            style={{
              pointerEvents: "none",
              opacity: 0.8,
              transform: uiScaleTransform,
            }}
          >
            <line
              x1={-CROSSHAIR_HALF}
              y1={0}
              x2={CROSSHAIR_HALF}
              y2={0}
              stroke="black"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={-CROSSHAIR_HALF}
              x2={0}
              y2={CROSSHAIR_HALF}
              stroke="black"
              strokeWidth={1}
            />
          </g>
        )}
      </g>
    </g>
  );
}

export default memo(NodeDetailStatic);
