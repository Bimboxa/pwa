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
  onPoseChangeStart, // () => void
  onPoseChangeEnd, // (deltaPose: { x, y, k }) => void
  enabledDrawingMode,
  locked = false,
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

  // We keep edit mode internal in your version
  // const poseEditable = selected;
  const poseEditable = false;

  // --- hooks (always called) ---
  const [delta, setDelta] = useState({ x: 0, y: 0, k: 1 });
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (poseEditable) {
      setDelta({ x: 0, y: 0, k: 1 });
      setIsInteracting(false);
    }
  }, [poseEditable]);

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

  // Handle size: keep 8px visual size by inversely scaling with _F
  const handleSize = useMemo(() => {
    const DESIRED_VISUAL_SIZE = 8;
    return DESIRED_VISUAL_SIZE / _F;
  }, [_F]);

  // Border width: keep 1px visual size by inversely scaling with _F
  const handleBorderWidth = useMemo(() => {
    const DESIRED_VISUAL_BORDER = 1;
    return DESIRED_VISUAL_BORDER / _F;
  }, [_F]);

  // Delta in CSS px for Rnd
  const cssPos = useMemo(
    () => ({ x: delta.x, y: delta.y }),
    [delta.x, delta.y]
  );
  // const cssSize = useMemo(
  //   () => ({ width: width * delta.k * F, height: height * delta.k * F }), // 🔧 add * F
  //   [width, height, delta.k, F]
  // );

  const cssSize = { width: width * delta.k * F, height: height * delta.k * F };

  refSize.current = cssSize;

  // Stop bubbling into the map; let wheel bubble unless interacting
  const stopPointerCapture = useCallback((e) => {
    e.stopPropagation();
  }, []);
  const maybeStopWheel = useCallback(
    (e) => {
      if (isInteracting) e.stopPropagation();
    },
    [isInteracting]
  );

  const startInteraction = useCallback(() => {
    console.log("debug_51_nodeSvg startInteraction");
    if (!isInteracting) {
      setIsInteracting(true);
      onPoseChangeStart?.();
    }
  }, [isInteracting, onPoseChangeStart]);

  const endInteraction = useCallback(() => {
    setIsInteracting(false);
  }, []);

  // Live updates (CSS -> LOCAL)
  const onDrag = useCallback(
    (e, d) => {
      console.log("dragging...");
      setDelta((p) => ({ ...p, x: d.x, y: d.y }));
    },
    [_F] // 🔧 depend on F
  );

  const onResize = useCallback(
    (e, _dir, ref, _delta, pos) => {
      const newK = ref.offsetWidth / F / width; // uniform scale from width
      setDelta((p) => ({ ...p, x: pos.x, y: pos.y, k: newK }));
    },
    [_F, width]
  );

  // Commit delta (LOCAL), then reset to identity
  const onDragStop = useCallback(
    (_e, d) => {
      onPoseChangeEnd?.({ x: d.x / F, y: d.y / F, k: delta.k });
      setDelta({ x: 0, y: 0, k: 1 });
      endInteraction();
    },
    [F, delta.k, onPoseChangeEnd, endInteraction]
  );

  const onResizeStop = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      onPoseChangeEnd?.({
        x: pos.x / F,
        y: pos.y / F,
        k: ref.offsetWidth / F / width,
      });
      setDelta({ x: 0, y: 0, k: 1 });
      endInteraction();
    },
    [F, width, onPoseChangeEnd, endInteraction]
  );

  if (!src || !width || !height) return null;



  return (
    <>
      {!poseEditable && (
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
      )}

      {poseEditable && (
        <foreignObject
          x={0}
          y={0}
          width={width}
          height={height}
          onPointerDownCapture={stopPointerCapture}
          onPointerMoveCapture={stopPointerCapture}
          onPointerUpCapture={stopPointerCapture}
          onTouchStartCapture={stopPointerCapture}
          onTouchMoveCapture={stopPointerCapture}
          onTouchEndCapture={stopPointerCapture}
          onWheelCapture={maybeStopWheel}
          style={{ overflow: "visible" }}
          {...dataProps}
        >
          <div
            data-stop-pan
            style={{
              width: "100%",
              height: "100%",
              position: "relative",
              //border: "1px solid red",
            }}
          >
            <Rnd
              //bounds="parent" // 🔁 keep for predictable UX
              position={cssPos} // need that to restore the position once drag / resize ends.
              size={cssSize}
              scale={_F}
              onDragStart={startInteraction}
              onResizeStart={startInteraction}
              onDrag={onDrag}
              onResize={onResize}
              onDragStop={onDragStop}
              onResizeStop={onResizeStop}
              lockAspectRatio
              enableResizing={{
                top: true,
                right: true,
                bottom: true,
                left: true,
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: true,
              }}
              resizeHandleStyles={{
                topLeft: {
                  width: handleSize,
                  height: handleSize,
                  border: `${handleBorderWidth}px solid #1976d2`,
                  background: "#fff",
                },
                topRight: {
                  width: handleSize,
                  height: handleSize,
                  border: `${handleBorderWidth}px solid #1976d2`,
                  background: "#fff",
                },
                bottomLeft: {
                  width: handleSize,
                  height: handleSize,
                  border: `${handleBorderWidth}px solid #1976d2`,
                  background: "#fff",
                },
                bottomRight: {
                  width: handleSize,
                  height: handleSize,
                  border: `${handleBorderWidth}px solid #1976d2`,
                  background: "#fff",
                },
              }}
              style={{
                border: "1px dashed rgba(25,118,210,.75)",
                background: "transparent",
                boxSizing: "border-box",
              }}
            >
              <img
                src={src}
                alt=""
                draggable={false}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "fill",
                  userSelect: "none",
                  pointerEvents: "none",
                  display: "block",
                  imageRendering: "optimizeSpeed",
                  opacity: opacity,
                  filter: grayScale ? "grayscale(100%)" : "none",
                }}
              />
            </Rnd>
          </div>
        </foreignObject>
      )}
    </>
  );
});
