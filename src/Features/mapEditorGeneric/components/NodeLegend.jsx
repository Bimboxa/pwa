import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Rnd } from "react-rnd";

import { Polyline, Pentagon as Polygon, Rectangle } from "@mui/icons-material";

export default memo(function NodeLegend({
  id = "legend",
  legendItems = [],
  spriteImage,
  worldScale = 1, // <- keep previous logic
  containerK = 1, // <- keep previous logic
  selected = false,
  legendFormat, // { x, y, width, height? } in BG-local units
  onLegendFormatChange,
}) {
  const poseEditable = selected;
  const { x = 16, y = 16, width = 260, fontSize = 18 } = legendFormat ?? {};

  // --- dataProps ---

  const dataProps = {
    "data-node-id": id,
    "data-node-type": "LEGEND",
  };

  // DRAG

  const [delta, setDelta] = useState({ x: 0, y: 0, k: 1 });
  // Delta in CSS px for Rnd
  const cssPos = useMemo(
    () => ({ x: delta.x, y: delta.y }),
    [delta.x, delta.y]
  );
  // Live updates (CSS -> LOCAL)
  const onDrag = useCallback(
    (e, d) => {
      setDelta((p) => ({ ...p, x: d.x, y: d.y }));
    },
    [] // 🔧 depend on F
  );

  // ===== scale: BG-local -> CSS px
  const F = useMemo(
    () => (worldScale || 1) * (containerK || 1),
    [worldScale, containerK]
  );

  // ===== measure content height in CSS px
  const contentRef = useRef(null);
  const [measuredCssH, setMeasuredCssH] = useState(1);
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    const el = contentRef.current;
    const ro = new ResizeObserver(() => setMeasuredCssH(el.scrollHeight));
    ro.observe(el);
    setMeasuredCssH(el.scrollHeight);
    return () => ro.disconnect();
  }, [legendItems]);

  const widthLocal = width;
  const heightLocal = Math.max(1, measuredCssH); // foreignObject height in BG-local

  // stop bubbling only when editing
  const stopIfEditing = useCallback(
    (e) => {
      if (poseEditable) e.stopPropagation();
    },
    [poseEditable]
  );

  // ===== RND handlers (NOTE: pos/size are CSS px; convert with F)

  const onDragStop = useCallback(
    (_e, d) => {
      onLegendFormatChange?.({
        x: x + d.x,
        y: y + d.y,
        width: widthLocal,
        height: heightLocal, // auto height committed in BG-local
      });
      setDelta({ x: 0, y: 0, k: 1 });
    },
    [x, y, F, widthLocal, heightLocal, onLegendFormatChange]
  );

  const onResizeStop = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      const _F = F;
      const newWidthLocal = ref.offsetWidth;
      const newHeightLocal = ref.offsetHeight;
      onLegendFormatChange?.({
        ...legendFormat,
        x: x + pos.x / _F,
        y: y + pos.y / _F,
        width: newWidthLocal,
        height: newHeightLocal,
      });
    },
    [x, y, F, onLegendFormatChange]
  );

  // ===== visuals
  const ICON_PX = 36;
  const ROW_GAP = 6;
  const PADDING = 10;
  const {
    url,
    tile = 32,
    columns = 3,
    rows = 3,
    iconKeys = [],
  } = spriteImage || {};

  function LegendIcon({ type, iconKey, fillColor, strokeColor, closeLine }) {
    // If type is POLYLINE, use MUI Polyline icon
    if (type === "POLYLINE" && !closeLine) {
      return (
        <div
          style={{
            width: `${ICON_PX}px`,
            height: `${ICON_PX}px`,
            borderRadius: "50%",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            border: `2px solid ${strokeColor}`,
            boxSizing: "border-box",
          }}
        >
          <Polyline
            // style={{
            //   color: strokeColor || "#ffffff",
            //   fontSize: ICON_PX * 0.6,
            // }}
            style={{ fill: fillColor, scale: 0.8 }}
          />
        </div>
      );
    }

    if (type === "POLYLINE" && closeLine) {
      return (
        <div
          style={{
            width: `${ICON_PX}px`,
            height: `${ICON_PX}px`,
            borderRadius: "50%",
            //background: fillColor ?? "white",
            background: "white",
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            border: `2px solid ${strokeColor}`,
            boxSizing: "border-box",
          }}
        >
          <Polygon
            // style={{
            //   color: fillColor || "#ffffff",
            //   fontSize: ICON_PX * 0.6,
            // }}
            style={{ fill: fillColor, scale: 0.8 }}
          />
        </div>
      );
    }
    if (type === "RECTANGLE") {
      return (
        <div
          style={{
            width: `${ICON_PX}px`,
            height: `${ICON_PX}px`,
            borderRadius: "50%",
            background: "white",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            border: `2px solid ${fillColor}`,
            boxSizing: "border-box",
          }}
        >
          <Rectangle style={{ fill: fillColor, scale: 0.7 }} />
        </div>
      );
    }

    // Default behavior for other types
    const idx = Math.max(0, iconKeys.indexOf(iconKey));
    const row = Math.floor(idx / columns);
    const col = idx % columns;
    return (
      <div
        style={{
          width: `${ICON_PX}px`,
          height: `${ICON_PX}px`,
          borderRadius: "50%",
          background: fillColor || "#f44336",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {url && (
          <svg
            width={ICON_PX * 0.8}
            height={ICON_PX * 0.8}
            viewBox={`${col * tile} ${row * tile} ${tile} ${tile}`}
          >
            <image
              href={url}
              width={columns * tile}
              height={rows * tile}
              preserveAspectRatio="none"
            />
          </svg>
        )}
      </div>
    );
  }

  const LegendBoxInner = (
    <div
      ref={contentRef}
      style={{
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(0,0,0,0.15)",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        padding: PADDING,
        display: "flex",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `${ICON_PX}px 1fr`,
          //gridAutoRows: "minmax(20px,auto)",
          rowGap: ROW_GAP,
          columnGap: 10,
          alignContent: "start",
          width: "100%",
        }}
      >
        {legendItems.map((it, i) => (
          <div key={i} style={{ display: "contents" }}>
            <div
              style={{
                alignSelf: "start",
                //display: "flex",
                //alignItems: "center",
                //justifyContent: "center",
                //height: `${ICON_PX}px`,
                //border: "1px solid black",
              }}
            >
              <LegendIcon
                type={it.type}
                iconKey={it.iconType ?? it.iconKey}
                fillColor={it.fillColor}
                strokeColor={it.strokeColor}
              />
            </div>
            <div
              style={{
                alignSelf: "center",
                overflowWrap: "anywhere",
                wordBreak: "break-word",
                lineHeight: 1.25,
                fontSize,
              }}
            >
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ===== render
  if (!poseEditable) {
    return (
      <foreignObject
        x={x}
        y={y}
        width={widthLocal}
        height={heightLocal}
        {...dataProps}
        style={{ overflow: "visible" }}
      >
        <div style={{ width: "100%" }}>{LegendBoxInner}</div>
      </foreignObject>
    );
  }

  return (
    <foreignObject
      x={x}
      y={y}
      width={widthLocal}
      height={heightLocal}
      {...dataProps}
      style={{ overflow: "visible" }}
      onPointerDownCapture={stopIfEditing}
      onPointerMoveCapture={stopIfEditing}
      onPointerUpCapture={stopIfEditing}
      onTouchStartCapture={stopIfEditing}
      onTouchMoveCapture={stopIfEditing}
      onTouchEndCapture={stopIfEditing}
    >
      <div style={{ width: "100%", position: "relative" }}>
        <Rnd
          position={cssPos}
          //size={{ width: widthCss, height: measuredCssH }} // CSS px
          size={{ width: "100%", height: "100%" }}
          scale={F} // <- SAME F everywhere
          onDrag={onDrag}
          onDragStop={onDragStop}
          //onResize={onResize}
          onResizeStop={onResizeStop}
          lockAspectRatio={false}
          enableResizing={{
            left: true,
            right: true,
            top: false,
            bottom: false,
            topLeft: false,
            topRight: false,
            bottomLeft: false,
            bottomRight: false,
          }}
          resizeHandleStyles={handleStyles}
          style={{
            border: "1px dashed rgba(25,118,210,.7)",
            background: "transparent",
            boxSizing: "border-box",
          }}
          // optional: CSS min sizes (they're in CSS px already)
          minWidth={ICON_PX + 80}
          minHeight={ICON_PX + PADDING * 2}
        >
          <div style={{ width: "100%" }}>{LegendBoxInner}</div>
        </Rnd>
      </div>
    </foreignObject>
  );
});

const handleStyles = { left: knob(), right: knob() };
function knob() {
  return {
    width: 18,
    height: 18,
    border: "2px solid #1976d2",
    background: "#fff",
    borderRadius: 2,
  };
}
