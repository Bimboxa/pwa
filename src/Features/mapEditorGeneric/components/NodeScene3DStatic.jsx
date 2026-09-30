import { memo, useMemo } from "react";
import theme from "Styles/theme";

import useScene3dTopViewUrl from "Features/scene3d/hooks/useScene3dTopViewUrl";
import { getScene3dDisplay2d } from "Features/scene3d/constants/scene3dConstants";

const HANDLE_SIZE = 10;
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 30;
const ORIGIN_MARK_SIZE = 8;
const MOVE_HANDLE_RADIUS = 14;

// SCENE_3D annotation (3D scan) in the 2D editor: its top-down projection
// drawn in the bbox (the metric footprint of the scan) — never resized, the
// scan is at scale.
//
// A scan is a BACKDROP, often as large as the plan: its body is selectable
// by a click but NOT draggable (a drag over it pans the map, and nothing
// moves it by accident). Once selected it shows two handles: a move handle
// at its centre and the rotation handle (same drag pipeline as OBJECT_3D).
// `sceneDisplay2d: "HIDDEN"` draws nothing but the dashed footprint of a
// selected annotation (so it can still be moved / found).
export default memo(function NodeScene3DStatic({
  annotation,
  hovered,
  selected,
  dragged,
  draggedPartType,
  containerK = 1,
}) {
  const { bbox, id, opacity, scene3d } = annotation;
  const { x, y, width, height } = bbox ?? {};

  const displayWidth = width || 100;
  const displayHeight = height || 100;
  const cx = displayWidth / 2;
  const cy = displayHeight / 2;
  const rotation = annotation.rotation || 0;
  const isHidden = getScene3dDisplay2d(annotation) === "HIDDEN";

  const topViewUrl = useScene3dTopViewUrl(scene3d);

  const handleScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // Position of the scan origin (0, 0) inside the bbox: image top = scan +Y.
  const origin = useMemo(() => {
    const min = scene3d?.bbox?.min;
    const max = scene3d?.bbox?.max;
    if (!min || !max) return null;
    const extentX = max[0] - min[0];
    const extentY = max[1] - min[1];
    if (!(extentX > 0) || !(extentY > 0)) return null;
    return {
      x: (-min[0] / extentX) * displayWidth,
      y: (max[1] / extentY) * displayHeight,
    };
  }, [scene3d?.bbox, displayWidth, displayHeight]);

  // Body: selectable node, deliberately without data-interaction="draggable".
  const nodeProps = {
    "data-node-id": id,
    "data-node-entity-id": annotation.entityId,
    "data-node-listing-id": annotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "SCENE_3D",
  };

  const selectedColor = theme.palette.editor?.selected || "#00ff00";
  const placeholderColor = annotation.fillColor || theme.palette.secondary.main;

  // Move handle: the only draggable part (whole-annotation move).
  const renderMoveHandle = () => (
    <g
      transform={`translate(${cx}, ${cy}) rotate(${-rotation})`}
      style={{ pointerEvents: "auto" }}
    >
      <g
        {...nodeProps}
        data-interaction="draggable"
        style={{ transform: handleScaleTransform, cursor: "move" }}
      >
        <circle
          r={MOVE_HANDLE_RADIUS}
          fill="#fff"
          stroke={selectedColor}
          strokeWidth={1.5}
        />
        {/* four-way arrows */}
        <path
          d="M0 -9 V9 M-9 0 H9 M-3 -6 L0 -9 L3 -6 M-3 6 L0 9 L3 6 M-6 -3 L-9 0 L-6 3 M6 -3 L9 0 L6 3"
          fill="none"
          stroke={selectedColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );

  // Rotation handle (move + rotate only — the scan is never resized)
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
        stroke={selectedColor}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <g style={{ transform: handleScaleTransform }}>
        <circle
          cx={0}
          cy={0}
          r={HALF_HANDLE}
          fill="#fff"
          stroke={selectedColor}
          strokeWidth={1.5}
          data-interaction="rotate-annotation"
          data-node-id={id}
          data-node-type="ANNOTATION"
          style={{ cursor: "grab" }}
        />
      </g>
    </g>
  );

  // Origin of the scan frame (the point placed by the click): a fixed-size
  // cross, shown on the selected annotation.
  const renderOriginMark = () =>
    origin && (
      <g
        transform={`translate(${origin.x}, ${origin.y})`}
        style={{ pointerEvents: "none" }}
      >
        <g style={{ transform: handleScaleTransform }}>
          <circle r={ORIGIN_MARK_SIZE / 2} fill="#fff" stroke={selectedColor} />
          <path
            d={`M${-ORIGIN_MARK_SIZE} 0 H${ORIGIN_MARK_SIZE} M0 ${-ORIGIN_MARK_SIZE} V${ORIGIN_MARK_SIZE}`}
            stroke={selectedColor}
            strokeWidth={1.5}
          />
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

  const cursorStyle = hovered && !selected ? "pointer" : "default";

  // Hidden in 2D: nothing to draw nor to hit, unless selected.
  if (isHidden && !selected) return null;

  return (
    <g
      transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${cx}, ${cy})`}
      style={{ opacity: dragged ? 0.7 : (opacity ?? 1) }}
    >
      <g {...nodeProps}>
        {!isHidden && topViewUrl ? (
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
            fill={placeholderColor}
            fillOpacity={isHidden ? 0 : 0.1}
            stroke={placeholderColor}
            strokeWidth={2}
            strokeDasharray="6 3"
            vectorEffect="non-scaling-stroke"
            style={{ cursor: cursorStyle }}
          />
        )}

        {/* Invisible hit area: keeps the whole footprint clickable (the
            image has transparent holes) */}
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
      </g>

      {selected && renderOriginMark()}

      {selected && renderMoveHandle()}

      {selected && !dragged && <g>{renderRotationHandle()}</g>}

      {dragged && draggedPartType === "ROTATE" && renderAngleBadge()}
    </g>
  );
});
