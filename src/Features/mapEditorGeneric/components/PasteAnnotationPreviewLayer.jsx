import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useSelector } from "react-redux";

import applyPasteTransformToPoints from "Features/mapEditor/utils/applyPasteTransformToPoints";

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

const PasteAnnotationPreviewLayer = forwardRef((_props, ref) => {
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  const pasteTransform = useSelector((s) => s.mapEditor.pasteTransform);

  const lastCursorRef = useRef(null);
  const polygonRef = useRef(null);
  const polylineRef = useRef(null);
  const stripPathRef = useRef(null);
  const pointCircleRef = useRef(null);
  const cutPathRef = useRef(null);

  const annotation = pasteClipboard?.annotation;
  const type = annotation?.type;

  const isPolyline = type === "POLYLINE";
  const isPolygon = type === "POLYGON";
  const isStrip = type === "STRIP";
  const isPointLike = type === "POINT" || type === "MARKER";

  const strokeColor = annotation?.strokeColor || "#2196f3";
  const fillColor = annotation?.fillColor || "rgba(33, 150, 243, 0.2)";

  // Reapply the transform using the last known cursor whenever the
  // clipboard or the transform changes (e.g. user presses R or I).
  useEffect(() => {
    if (lastCursorRef.current) render(lastCursorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasteClipboard, pasteTransform]);

  function render(cursorPos) {
    if (!pasteClipboard || !cursorPos) return;

    const sourceCenter = pasteClipboard.sourceCenter;

    if (isPolyline && pasteClipboard.basePoints?.length) {
      const transformed = applyPasteTransformToPoints(
        pasteClipboard.basePoints,
        sourceCenter,
        cursorPos,
        pasteTransform,
      );
      if (polylineRef.current) {
        polylineRef.current.setAttribute("points", pointsToAttr(transformed));
        polylineRef.current.style.display = "block";
      }
      return;
    }

    if (isPolygon && pasteClipboard.basePoints?.length) {
      const transformed = applyPasteTransformToPoints(
        pasteClipboard.basePoints,
        sourceCenter,
        cursorPos,
        pasteTransform,
      );
      if (polygonRef.current) {
        polygonRef.current.setAttribute("points", pointsToAttr(transformed));
        polygonRef.current.style.display = "block";
      }

      // Render cuts as evenodd-fill holes within a single combined path.
      if (cutPathRef.current) {
        if (pasteClipboard.baseCuts?.length) {
          const outerD =
            "M " + transformed.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
          const cutsD = pasteClipboard.baseCuts
            .map((cut) => {
              if (!cut.points?.length) return "";
              const cutTransformed = applyPasteTransformToPoints(
                cut.points,
                sourceCenter,
                cursorPos,
                pasteTransform,
              );
              return (
                "M " +
                cutTransformed.map((p) => `${p.x} ${p.y}`).join(" L ") +
                " Z"
              );
            })
            .filter(Boolean)
            .join(" ");
          cutPathRef.current.setAttribute("d", `${outerD} ${cutsD}`);
          cutPathRef.current.style.display = "block";
        } else {
          cutPathRef.current.style.display = "none";
        }
      }
      return;
    }

    if (isStrip && pasteClipboard.basePoints?.length) {
      const transformed = applyPasteTransformToPoints(
        pasteClipboard.basePoints,
        sourceCenter,
        cursorPos,
        pasteTransform,
      );
      const width =
        pasteClipboard.stripWidthPx ?? STRIP_DEFAULT_WIDTH_PX;
      const orientation = pasteClipboard.stripOrientation ?? 1;
      const d = stripPathD(transformed, orientation * width);
      if (stripPathRef.current && d) {
        stripPathRef.current.setAttribute("d", d);
        stripPathRef.current.style.display = "block";
      }
      // Also draw the source polyline so the user sees the band's spine
      if (polylineRef.current) {
        polylineRef.current.setAttribute("points", pointsToAttr(transformed));
        polylineRef.current.style.display = "block";
      }
      return;
    }

    if (isPointLike && pasteClipboard.basePoint) {
      // Single point: rotation/flip around the point itself = noop, so this
      // just translates to the cursor.
      const transformed = applyPasteTransformToPoints(
        [pasteClipboard.basePoint],
        sourceCenter,
        cursorPos,
        pasteTransform,
      );
      const [p] = transformed;
      if (pointCircleRef.current && p) {
        pointCircleRef.current.setAttribute("cx", String(p.x));
        pointCircleRef.current.setAttribute("cy", String(p.y));
        pointCircleRef.current.style.display = "block";
      }
    }
  }

  useImperativeHandle(ref, () => ({
    updatePreview: (cursorPos) => {
      if (!cursorPos) return;
      lastCursorRef.current = cursorPos;
      render(cursorPos);
    },
    clearPreview: () => {
      lastCursorRef.current = null;
      [polygonRef, polylineRef, stripPathRef, pointCircleRef, cutPathRef].forEach(
        (r) => {
          if (r.current) r.current.style.display = "none";
        },
      );
    },
  }));

  if (!pasteClipboard) return null;

  return (
    <g className="paste-preview-layer" style={{ pointerEvents: "none" }}>
      {isStrip && (
        <path
          ref={stripPathRef}
          fill={fillColor}
          opacity={0.4}
          stroke="none"
          style={{ display: "none", pointerEvents: "none" }}
        />
      )}

      {isPolygon && (
        <path
          ref={cutPathRef}
          fill={fillColor}
          fillRule="evenodd"
          stroke={strokeColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          opacity={0.8}
          style={{ display: "none", pointerEvents: "none" }}
        />
      )}

      {/* Polygon outline (used when there are no cuts — kept here for
          consistency; cutPath above handles polygons with or without cuts). */}
      {isPolygon && (
        <polygon
          ref={polygonRef}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
          style={{ display: "none", pointerEvents: "none" }}
        />
      )}

      {(isPolyline || isStrip) && (
        <polyline
          ref={polylineRef}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
          style={{ display: "none", pointerEvents: "none" }}
        />
      )}

      {isPointLike && (
        <circle
          ref={pointCircleRef}
          r={POINT_GHOST_RADIUS_PX}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={2}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
          opacity={0.9}
          style={{ display: "none", pointerEvents: "none" }}
        />
      )}
    </g>
  );
});

PasteAnnotationPreviewLayer.displayName = "PasteAnnotationPreviewLayer";

export default PasteAnnotationPreviewLayer;
