import { memo, useMemo } from "react";

import theme from "Styles/theme";

import useBlockDefinitionInStore from "../hooks/useBlockDefinitionInStore";
import { BLOCK_INSTANCE_TYPE } from "../utils/blockTypes";
import {
  getBlockInstanceAnchorPx,
  getBlockInstanceTransform,
} from "../utils/blockInstanceGeometry";

const HANDLE_RADIUS = 5;
const ROTATION_HANDLE_OFFSET = 30; // screen px above the bounds
const PLACEHOLDER_SIZE = 28; // screen px

// One instance of a block on its host base map: a single <use> of the
// block's definition (BlockDefinitionsDefs), placed at the instance anchor,
// turned by its rotation, at real size. The pointer events of a <use> target
// the <use> itself, so the whole instance is one selectable / draggable node.
//
// Per-instance state (hover, selection, rotation handle) is drawn around the
// block bounds — the shared definition is never restyled.
// An instance whose block draws nothing (deleted block, no member yet) shows
// a dashed placeholder so it stays selectable / deletable.
export default memo(function NodeBlockInstanceStatic({
  annotation,
  hovered,
  selected,
  dragged,
  draggedPartType,
  containerK = 1,
  baseMapMeterByPx,
}) {
  // data

  const definition = useBlockDefinitionInStore(annotation.instanceOfBlockId);

  // helpers

  const { id, opacity } = annotation;
  const rotation = annotation.rotation || 0;
  const anchorPx = getBlockInstanceAnchorPx(annotation);
  const hostMeterByPx = baseMapMeterByPx || annotation._planMeterByPx;
  const hasScale = hostMeterByPx > 0;
  const boundsM = definition?.boundsM;
  const hasDefinition = Boolean(definition) && Boolean(boundsM) && hasScale;

  const handleScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const interactionProps = {
    "data-node-id": id,
    "data-node-listing-id": annotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": BLOCK_INSTANCE_TYPE,
    "data-interaction": "draggable",
  };

  const cursorStyle = selected ? "move" : hovered ? "pointer" : "default";
  const selectedColor = theme.palette.baseMap?.selected || "#ff9800";
  const hoveredColor = theme.palette.baseMap?.hovered || "#2196f3";
  const handleColor = theme.palette.editor?.selected || "#00ff00";

  // bounds in host px, in the instance's own (unrotated) frame
  const local = hasDefinition
    ? {
        x: boundsM.minX / hostMeterByPx,
        y: boundsM.minY / hostMeterByPx,
        width: (boundsM.maxX - boundsM.minX) / hostMeterByPx,
        height: (boundsM.maxY - boundsM.minY) / hostMeterByPx,
      }
    : null;

  // render

  if (!anchorPx) return null;

  const outlineColor = selected ? selectedColor : hovered ? hoveredColor : null;

  return (
    <g style={{ opacity: dragged ? 0.7 : (opacity ?? 1) }}>
      {hasDefinition ? (
        <>
          <use
            href={`#${definition.defId}`}
            transform={getBlockInstanceTransform({
              anchorPx,
              rotationDeg: rotation,
              hostMeterByPx,
            })}
            style={{ cursor: cursorStyle }}
            {...interactionProps}
          />
          <g
            transform={`translate(${anchorPx.x} ${anchorPx.y}) rotate(${rotation})`}
          >
            {outlineColor && !dragged && (
              <rect
                x={local.x}
                y={local.y}
                width={local.width}
                height={local.height}
                fill="none"
                stroke={outlineColor}
                strokeWidth={selected ? 2 : 1.5}
                strokeDasharray={selected ? undefined : "6 3"}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}

            {/* insertion point */}
            {selected && (
              <g style={{ transform: handleScaleTransform, pointerEvents: "none" }}>
                <path
                  d="M-6 0 L6 0 M0 -6 L0 6"
                  stroke={selectedColor}
                  strokeWidth={1.5}
                  fill="none"
                />
              </g>
            )}

            {/* rotation handle, above the bounds */}
            {selected && !dragged && (
              <g
                transform={`translate(${local.x + local.width / 2} ${local.y})`}
                style={{ pointerEvents: "auto" }}
              >
                <g style={{ transform: handleScaleTransform }}>
                  <line
                    x1={0}
                    y1={0}
                    x2={0}
                    y2={-ROTATION_HANDLE_OFFSET}
                    stroke={handleColor}
                    strokeWidth={1}
                  />
                  <circle
                    cx={0}
                    cy={-ROTATION_HANDLE_OFFSET}
                    r={HANDLE_RADIUS}
                    fill="#fff"
                    stroke={handleColor}
                    strokeWidth={1.5}
                    data-interaction="rotate-annotation"
                    data-node-id={id}
                    data-node-type="ANNOTATION"
                    style={{ cursor: "grab" }}
                  />
                </g>
              </g>
            )}
          </g>
        </>
      ) : (
        <g transform={`translate(${anchorPx.x} ${anchorPx.y})`}>
          <g style={{ transform: handleScaleTransform }}>
            <rect
              x={-PLACEHOLDER_SIZE / 2}
              y={-PLACEHOLDER_SIZE / 2}
              width={PLACEHOLDER_SIZE}
              height={PLACEHOLDER_SIZE}
              rx={4}
              fill="rgba(255,255,255,0.6)"
              stroke={outlineColor || theme.palette.text.disabled}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              style={{ cursor: cursorStyle }}
              {...interactionProps}
            />
            <path
              d="M-5 0 L5 0 M0 -5 L0 5"
              stroke={outlineColor || theme.palette.text.disabled}
              strokeWidth={1.5}
              fill="none"
              pointerEvents="none"
            />
          </g>
        </g>
      )}

      {/* angle badge while turning */}
      {dragged && draggedPartType === "ROTATE" && (
        <g
          transform={`translate(${anchorPx.x} ${anchorPx.y})`}
          style={{ pointerEvents: "none" }}
        >
          <g style={{ transform: handleScaleTransform }}>
            <rect x={-26} y={-12} width={52} height={24} rx={12} fill="rgba(0,0,0,0.75)" />
            <text
              x={0}
              y={4}
              textAnchor="middle"
              fill="#fff"
              fontSize={12}
              fontFamily={theme.typography?.fontFamily}
            >
              {Math.round(((rotation % 360) + 360) % 360)}°
            </text>
          </g>
        </g>
      )}
    </g>
  );
});
