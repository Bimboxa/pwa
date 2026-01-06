// NodeSvgImage.jsx
import { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Rnd } from "react-rnd";

import theme from "Styles/theme";

/**
 * Renders an <image> normally, or a react-rnd editor when poseEditable is true.
 * - Manages a LOCAL delta pose starting at { x:0, y:0, k:1 }
 * - Emits delta via onPoseChangeEnd({ x, y, k }) in the LOCAL SVG coords
 * - Converts CSS <-> LOCAL using F = worldScale * containerK to avoid drift
 * - Prevents bubbling so the map won't pan; wheel bubbles unless interacting
 */
export default memo(function NodeSvgImage({
  src,
  dataNodeId,
  dataNodeType,
  width,
  height,
  worldScale = 1, // MapEditorGeneric.world.k
  containerK = 1, // 🔁 was bgPoseK — the immediate parent's scale (here: basePose.k)
  selected,
  hovered,
  opacity,
  grayScale = false,
}) {
  const refSize = useRef();

  // dataProps

  const dataProps = {
    "data-node-id": dataNodeId,
    "data-node-type": dataNodeType,
    "data-annotation-type": "IMAGE",
  };

  // CSS <-> LOCAL factor: use the scale actually applied at this node
  const _F = useMemo(
    () => (worldScale || 1) * (containerK || 1),
    [worldScale, containerK]
  );
  const F = 1;

  // Border width for hover effect: keep 2px visual size
  const hoverBorderWidth = useMemo(() => {
    const DESIRED_VISUAL_BORDER = 2;
    return DESIRED_VISUAL_BORDER / _F;
  }, [_F]);


  if (!src || !width || !height) return null;



  return (
    <g>
      <image
        href={src}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="none"
        style={{
          imageRendering: "optimizeSpeed",
          opacity: opacity,
          filter: grayScale ? "grayscale(100%)" : "none",
        }}
        {...dataProps}
      />
      {hovered && !selected && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={theme.palette.baseMap.hovered}
          strokeWidth={hoverBorderWidth}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {selected && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={theme.palette.baseMap.selected}
          strokeWidth={hoverBorderWidth}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
});
