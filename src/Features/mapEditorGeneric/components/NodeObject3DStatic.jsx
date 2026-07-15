import { memo, useMemo } from "react";
import theme from "Styles/theme";

import useObject3DTopView from "Features/object3D/hooks/useObject3DTopView";

const HANDLE_SIZE = 10;
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 30;

export default memo(function NodeObject3DStatic({
  annotation,
  hovered,
  selected,
  dragged,
  draggedPartType,
  containerK = 1,
}) {
  const { bbox, id, opacity } = annotation;
  const { x, y, width, height } = bbox ?? {};

  const displayWidth = width || 100;
  const displayHeight = height || 100;
  const cx = displayWidth / 2;
  const cy = displayHeight / 2;
  const rotation = annotation.rotation || 0;

  // Top-down projection of the GLB (persisted on the template, or lazily
  // generated from db.files for annotations created before it existed).
  const topViewUrl = useObject3DTopView(annotation.object3D);

  const handleScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const interactionProps = {
    "data-node-id": id,
    "data-node-entity-id": annotation.entityId,
    "data-node-listing-id": annotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "OBJECT_3D",
    "data-interaction": "draggable",
  };

  const fillColor = annotation.fillColor || theme.palette.secondary.main;

  // Rotation handle (move + rotate only — no resize per spec)
  const renderRotationHandle = () => (
    <g
      transform={`translate(${cx}, ${-ROTATION_HANDLE_OFFSET})`}
      style={{ pointerEvents: "auto" }}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={ROTATION_HANDLE_OFFSET}
        stroke={theme.palette.editor?.selected || "#00ff00"}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <g style={{ transform: handleScaleTransform }}>
        <circle
          cx={0}
          cy={0}
          r={HALF_HANDLE}
          fill="#fff"
          stroke={theme.palette.editor?.selected || "#00ff00"}
          strokeWidth={1.5}
          data-interaction="rotate-annotation"
          data-node-id={id}
          data-node-type="ANNOTATION"
          style={{ cursor: "grab" }}
        />
      </g>
    </g>
  );

  // Cube icon (drawn at the rectangle center, fixed pixel size)
  const iconSize = 24;
  const renderCubeIcon = () => (
    <g
      transform={`translate(${cx}, ${cy})`}
      style={{ pointerEvents: "none" }}
    >
      <g style={{ transform: handleScaleTransform }}>
        <g transform={`translate(${-iconSize / 2}, ${-iconSize / 2})`}>
          <path
            d={`M${iconSize / 2} 2 L${iconSize - 3} ${iconSize / 4} L${
              iconSize - 3
            } ${(iconSize * 3) / 4} L${iconSize / 2} ${
              iconSize - 2
            } L3 ${(iconSize * 3) / 4} L3 ${iconSize / 4} Z`}
            fill="none"
            stroke={fillColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          <path
            d={`M3 ${iconSize / 4} L${iconSize / 2} ${iconSize / 2} L${
              iconSize - 3
            } ${iconSize / 4} M${iconSize / 2} ${iconSize / 2} L${
              iconSize / 2
            } ${iconSize - 2}`}
            fill="none"
            stroke={fillColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  );

  // Angle badge shown while rotating (counter-rotated to stay readable)
  const renderAngleBadge = () => {
    const displayedAngle = Math.round(((rotation % 360) + 360) % 360);
    return (
      <g
        transform={`translate(${cx}, ${cy}) rotate(${-rotation})`}
        style={{ pointerEvents: "none" }}
      >
        <g style={{ transform: handleScaleTransform }}>
          <rect
            x={-26}
            y={-12}
            width={52}
            height={24}
            rx={12}
            fill="rgba(0,0,0,0.75)"
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontFamily={theme.typography?.fontFamily}
          >
            {displayedAngle}°
          </text>
        </g>
      </g>
    );
  };

  const cursorStyle = selected ? "move" : hovered ? "pointer" : "default";

  return (
    <g
      transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${cx}, ${cy})`}
      style={{ opacity: dragged ? 0.7 : opacity ?? 1 }}
    >
      <g {...interactionProps}>
        {topViewUrl ? (
          <image
            href={topViewUrl}
            x={0}
            y={0}
            width={displayWidth}
            height={displayHeight}
            preserveAspectRatio="none"
            style={{ cursor: cursorStyle }}
          />
        ) : (
          <rect
            x={0}
            y={0}
            width={displayWidth}
            height={displayHeight}
            fill={fillColor}
            fillOpacity={0.15}
            stroke={fillColor}
            strokeWidth={2}
            strokeDasharray="6 3"
            vectorEffect="non-scaling-stroke"
            style={{ cursor: cursorStyle }}
          />
        )}

        {/* Invisible hit area: keeps the whole footprint clickable */}
        <rect
          x={0}
          y={0}
          width={displayWidth}
          height={displayHeight}
          fill="transparent"
          stroke="none"
          style={{ cursor: cursorStyle }}
        />

        {hovered && !selected && !dragged && (
          <rect
            x={0}
            y={0}
            width={displayWidth}
            height={displayHeight}
            fill="none"
            stroke={theme.palette.baseMap?.hovered || "#2196f3"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}

        {selected && (
          <rect
            x={0}
            y={0}
            width={displayWidth}
            height={displayHeight}
            fill="none"
            stroke={theme.palette.baseMap?.selected || "#ff9800"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}

        {!topViewUrl && renderCubeIcon()}
      </g>

      {selected && !dragged && <g>{renderRotationHandle()}</g>}

      {dragged && draggedPartType === "ROTATE" && renderAngleBadge()}
    </g>
  );
});
