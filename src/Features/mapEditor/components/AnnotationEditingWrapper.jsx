import { useMemo } from "react";
import theme from "Styles/theme";

const HANDLE_SIZE = 10;
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 50;
const WRAPPER_NODE_ID = "wrapper";

export default function AnnotationEditingWrapper({
  bbox,
  containerK = 1,
  annotationIds,
  dragged,
  rotation = 0,
  rotationCenter,
}) {
  // data

  const { x, y, width, height } = bbox ?? {};

  // helpers

  const handleScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // Rotation pivot: if rotationCenter is provided (e.g. from a group rotation),
  // use it; otherwise default to the bbox's own center.
  const pivotX = rotationCenter ? rotationCenter.x - x : width / 2;
  const pivotY = rotationCenter ? rotationCenter.y - y : height / 2;

  // Handle layout center: always the bbox's own center (for handle positioning)
  const cx = width / 2;
  const cy = height / 2;

  const selectedColor = theme.palette.editor?.selected || "#00ff00";

  // render - resize handle

  const renderResizeHandle = (type, hx, hy) => (
    <g
      transform={`translate(${hx}, ${hy})`}
      style={{ pointerEvents: "auto" }}
    >
      <g style={{ transform: handleScaleTransform }}>
        <rect
          x={-HALF_HANDLE}
          y={-HALF_HANDLE}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="#fff"
          stroke={selectedColor}
          strokeWidth={1}
          data-interaction="resize-annotation"
          data-handle-type={type}
          data-node-id={WRAPPER_NODE_ID}
          data-node-type="ANNOTATION"
          style={{ cursor: `${type.toLowerCase()}-resize` }}
        />
      </g>
    </g>
  );

  // render - rotation handle

  const renderRotationHandle = () => (
    <g
      transform={`translate(${cx}, 0)`}
      style={{ pointerEvents: "auto" }}
    >
      <g style={{ transform: handleScaleTransform }}>
        <line
          x1={0}
          y1={0}
          x2={0}
          y2={-ROTATION_HANDLE_OFFSET}
          stroke={selectedColor}
          strokeWidth={1}
        />
        <circle
          cx={0}
          cy={-ROTATION_HANDLE_OFFSET}
          r={HALF_HANDLE}
          fill="#fff"
          stroke={selectedColor}
          strokeWidth={1.5}
          data-interaction="rotate-annotation"
          data-node-id={WRAPPER_NODE_ID}
          data-node-type="ANNOTATION"
          style={{ cursor: "grab" }}
        />
      </g>
    </g>
  );

  // render

  if (width == null || height == null) return null;

  return (
    <g transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${pivotX}, ${pivotY})`}>
      {/* Draggable body (invisible hit area) */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        stroke={selectedColor}
        strokeWidth={1}
        strokeDasharray="6 3"
        vectorEffect="non-scaling-stroke"
        data-interaction="draggable"
        data-node-id={WRAPPER_NODE_ID}
        data-node-type="ANNOTATION"
        style={{ cursor: dragged ? "grabbing" : "move", pointerEvents: "all" }}
      />

      {/* Handles (hidden during drag) */}
      {!dragged && (
        <g>
          {renderResizeHandle("NW", 0, 0)}
          {renderResizeHandle("NE", width, 0)}
          {renderResizeHandle("SW", 0, height)}
          {renderResizeHandle("SE", width, height)}
          {renderRotationHandle()}
        </g>
      )}
    </g>
  );
}
