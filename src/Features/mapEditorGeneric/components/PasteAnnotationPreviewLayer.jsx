import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useSelector } from "react-redux";

const POINT_GHOST_RADIUS_PX = 8;
const STRIP_DEFAULT_WIDTH_PX = 20;

function pointsToAttr(points) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function offsetPolyline(pts, distance) {
  const len = pts.length;
  if (len < 2) return [];
  const lines = [];
  for (let i = 0; i < len - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const nx = -uy;
    const ny = ux;
    lines.push({
      p: { x: pts[i].x + nx * distance, y: pts[i].y + ny * distance },
      v: { x: ux, y: uy },
      segLen,
    });
  }
  if (lines.length === 0) return [];
  const result = [lines[0].p];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1];
    const curr = lines[i];
    const cross = prev.v.x * curr.v.y - prev.v.y * curr.v.x;
    if (Math.abs(cross) < 1e-5) {
      result.push(curr.p);
    } else {
      const dp = { x: curr.p.x - prev.p.x, y: curr.p.y - prev.p.y };
      const t = (dp.x * curr.v.y - dp.y * curr.v.x) / cross;
      result.push({ x: prev.p.x + t * prev.v.x, y: prev.p.y + t * prev.v.y });
    }
  }
  const last = lines[lines.length - 1];
  result.push({
    x: last.p.x + last.v.x * last.segLen,
    y: last.p.y + last.v.y * last.segLen,
  });
  return result;
}

function stripPathD(pts, distance) {
  if (pts.length < 2) return "";
  const offset = offsetPolyline(pts, distance);
  if (offset.length < 2) return "";
  const all = [...pts, ...offset.reverse()];
  return "M " + all.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
}

// One ghost shape per clipboard item, drawn in absolute base-px coords. The
// parent <g> carries the single rigid transform that places the whole group.
function renderItem(item, key) {
  const ann = item.annotation;
  const type = ann?.type;
  const strokeColor = ann?.strokeColor || "#2196f3";
  const fillColor = ann?.fillColor || "rgba(33, 150, 243, 0.2)";

  if (type === "POLYGON" && item.basePoints?.length) {
    const outerD =
      "M " + item.basePoints.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
    const cutsD = (item.baseCuts || [])
      .map((cut) =>
        cut.points?.length
          ? "M " + cut.points.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z"
          : "",
      )
      .filter(Boolean)
      .join(" ");
    return (
      <path
        key={key}
        d={cutsD ? `${outerD} ${cutsD}` : outerD}
        fill={fillColor}
        fillRule="evenodd"
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
        opacity={0.8}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "COTE" && item.basePoints?.length) {
    return (
      <polyline
        key={key}
        points={pointsToAttr(item.basePoints)}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
        opacity={0.9}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "POLYLINE" && item.basePoints?.length) {
    return (
      <polyline
        key={key}
        points={pointsToAttr(item.basePoints)}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
        opacity={0.9}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  if (type === "STRIP" && item.basePoints?.length) {
    const width = item.stripWidthPx ?? STRIP_DEFAULT_WIDTH_PX;
    const orientation = item.stripOrientation ?? 1;
    const d = stripPathD(item.basePoints, orientation * width);
    return (
      <g key={key}>
        {d && (
          <path
            d={d}
            fill={fillColor}
            opacity={0.4}
            stroke="none"
            style={{ pointerEvents: "none" }}
          />
        )}
        <polyline
          points={pointsToAttr(item.basePoints)}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  }

  if ((type === "POINT" || type === "MARKER") && item.basePoint) {
    return (
      <circle
        key={key}
        cx={item.basePoint.x}
        cy={item.basePoint.y}
        r={POINT_GHOST_RADIUS_PX}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
        opacity={0.9}
        style={{ pointerEvents: "none" }}
      />
    );
  }

  return null;
}

const PasteAnnotationPreviewLayer = forwardRef((_props, ref) => {
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const pasteTransform = useSelector((s) => s.mapEditor.pasteTransform);

  const groupRef = useRef(null);
  const lastCursorRef = useRef(null);

  const items = pasteClipboard?.items;
  const sourceCenter = pasteClipboard?.sourceCenter;

  // The whole group shares one rigid transform: flip → rotate around the group
  // source center → translate that center onto the cursor. SVG applies right to
  // left, so this matches applyPasteTransformToPoints exactly.
  function applyTransform(cursorPos) {
    if (!groupRef.current || !cursorPos || !sourceCenter) return;
    const { rotationDeg = 0, flipX = false } = pasteTransform ?? {};
    const sx = flipX ? -1 : 1;
    const t =
      `translate(${cursorPos.x} ${cursorPos.y}) ` +
      `rotate(${rotationDeg}) ` +
      `scale(${sx} 1) ` +
      `translate(${-sourceCenter.x} ${-sourceCenter.y})`;
    groupRef.current.setAttribute("transform", t);
    groupRef.current.style.display = "block";
  }

  // Reapply with the last known cursor whenever clipboard/transform change
  // (e.g. user presses R or I).
  useEffect(() => {
    if (lastCursorRef.current) applyTransform(lastCursorRef.current);
  }, [pasteClipboard, pasteTransform]);

  useImperativeHandle(ref, () => ({
    updatePreview: (cursorPos) => {
      if (!cursorPos) return;
      lastCursorRef.current = cursorPos;
      applyTransform(cursorPos);
    },
    clearPreview: () => {
      lastCursorRef.current = null;
      if (groupRef.current) groupRef.current.style.display = "none";
    },
  }));

  if (!pasteClipboard || !items?.length) return null;

  return (
    <g
      ref={groupRef}
      className="paste-preview-layer"
      style={{ display: "none", pointerEvents: "none" }}
    >
      {items.map((item, idx) => renderItem(item, idx))}
    </g>
  );
});

PasteAnnotationPreviewLayer.displayName = "PasteAnnotationPreviewLayer";

export default PasteAnnotationPreviewLayer;
