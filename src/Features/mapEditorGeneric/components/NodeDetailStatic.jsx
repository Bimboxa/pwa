import { memo, useMemo, useState, useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import { openResourceAtPage } from "Features/resources/resourcesSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { resolveDetailResource } from "Features/baseMaps/services/detailBaseMapUtils";

import { darken } from "@mui/material/styles";

import db from "App/db/db";

// --- CONSTANTES (screen px — the whole node is counter-scaled) ---
const BUBBLE_R = 16;
const RING_W = 3;
const ARROW_LEN = 12; // gap between the tip and the bubble edge
const ARROW_HALF_W = 7;
const ARROW_BASE_OVERLAP = 4; // arrow base hidden under the bubble fill
const TIP_OFFSET = BUBBLE_R + ARROW_LEN; // tip → bubble center
const ROT_RING_R = TIP_OFFSET + BUBBLE_R + 8; // rotation helper orbit
const DEFAULT_FONT_SIZE = 14;
const SMALL_FONT_SIZE = 11;

// DETAIL node — a "detail bubble": white circle with a thick ring containing
// a short label, plus a filled triangular arrow whose TIP is the annotation's
// stored point. The tip sits at the local origin so it stays glued to the
// exact spot at any zoom; the bubble is drawn at a fixed SCREEN-px offset
// opposite the arrow direction (arrowAngle, degrees, 0 = arrow pointing
// right, clockwise-positive in the y-down SVG screen frame).
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

  // helpers

  const rad = (arrowAngle * Math.PI) / 180;
  // Bubble center, opposite the arrow (y-down frame: cos/sin used as-is).
  const cx = -TIP_OFFSET * Math.cos(rad);
  const cy = -TIP_OFFSET * Math.sin(rad);

  // Constant screen size: counter-scale by container k AND map zoom (same
  // formula as NodeLabelStatic — --map-zoom is written by MapEditorViewport,
  // missing var falls back to 1 outside the map editor, e.g. portfolio).
  const scaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

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

  const fontSize =
    (ownLabel?.length ?? 0) > 2 ? SMALL_FONT_SIZE : DEFAULT_FONT_SIZE;

  const fontStyles = {
    fontFamily: "Roboto, Helvetica, Arial, sans-serif",
    fontSize: `${fontSize}px`,
    fontWeight: "bold",
    lineHeight: 1.2,
    color: "#000000",
    whiteSpace: "pre",
  };

  // state — inline label editing (NodeLabelStatic pattern)

  const [localValue, setLocalValue] = useState(ownLabel);

  useEffect(() => {
    setLocalValue(ownLabel);
  }, [ownLabel]);

  // refs to access latest values in the deselect cleanup
  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  const labelRef = useRef(ownLabel);
  labelRef.current = ownLabel;

  // handlers

  const saveLabel = async (value) => {
    try {
      await db.annotations.update(id, { label: value });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlur = () => {
    if (localValue !== ownLabel) {
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
        cursor: dragged ? "grabbing" : "pointer",
        opacity: dragged ? 0.7 : 1,
        transition: "opacity 0.1s",
      }}
      {...dataProps}
    >
      {/* Screen-px frame — origin = arrow TIP */}
      <g style={{ transform: scaleTransform }}>
        {/* Arrow — the only rotated element; its base overlaps under
                    the bubble fill so the joint stays clean at any angle */}
        <g transform={`rotate(${arrowAngle})`}>
          <path
            d={`M 0 0 L ${-(ARROW_LEN + ARROW_BASE_OVERLAP)} ${-ARROW_HALF_W} L ${-(ARROW_LEN + ARROW_BASE_OVERLAP)} ${ARROW_HALF_W} Z`}
            fill={displayColor}
          />
        </g>

        {/* Bubble — drawn after the arrow (white fill masks the base
                    overlap), NOT rotated so the label stays upright */}
        <circle
          cx={cx}
          cy={cy}
          r={BUBBLE_R}
          fill="#ffffff"
          stroke={displayColor}
          strokeWidth={RING_W}
          style={
            selected
              ? { filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" }
              : {}
          }
        />

        {/* Hit zone — bubble only, the tip area stays click-free */}
        <circle cx={cx} cy={cy} r={BUBBLE_R + 4} fill="transparent" />

        {/* Label — centered on the bubble, editable inline when selected */}
        <foreignObject
          x={cx - BUBBLE_R}
          y={cy - BUBBLE_R}
          width={BUBBLE_R * 2}
          height={BUBBLE_R * 2}
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
                  // Vertically center the single line in the bubble.
                  paddingTop: `${BUBBLE_R - fontSize * 0.6}px`,
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
              <span style={fontStyles}>{ownLabel || "X"}</span>
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
              r={ROT_RING_R}
              fill="none"
              stroke="#555555"
              strokeWidth={1}
              strokeDasharray="4 4"
              style={{ pointerEvents: "none" }}
            />
            <circle
              r={ROT_RING_R}
              fill="none"
              stroke="transparent"
              strokeWidth={14}
              data-interaction="rotate-annotation"
              data-node-id={id}
              style={{ pointerEvents: "stroke", cursor: "grab" }}
            />
            {/* Grip dot on the arrow side, as affordance */}
            <circle
              cx={ROT_RING_R * Math.cos(rad)}
              cy={ROT_RING_R * Math.sin(rad)}
              r={5}
              fill="#ffffff"
              stroke="#555555"
              style={{ pointerEvents: "none" }}
            />

            {/* Action buttons — linked only: "Voir le fond de plan" selects
                the detail baseMap in the map editor, "Voir la source" opens
                the RESOURCES panel on the source PDF at the detail's page */}
            {detailBaseMapId && (
              <foreignObject
                x={-140}
                y={ROT_RING_R + 10}
                width={280}
                height={40}
                style={{ overflow: "visible" }}
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
            )}
          </>
        )}

        {/* Crosshair during a move drag (NodePointStatic pattern) */}
        {dragged && draggedPartType !== "ROTATE" && (
          <g style={{ pointerEvents: "none", opacity: 0.8 }}>
            <line
              x1={-10}
              y1={0}
              x2={10}
              y2={0}
              stroke="black"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={-10}
              x2={0}
              y2={10}
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
