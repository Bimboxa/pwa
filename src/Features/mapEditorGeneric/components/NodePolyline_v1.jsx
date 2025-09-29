// NodePolyligne.js
import { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";

/**
 * Props:
 * - imageSize: { w, h }  // container image pixel size
 * - toBaseFromClient: (clientX:number, clientY:number) => { x:number, y:number } in container-local pixels
 * - onPolylineComplete: (points: Array<{x:number,y:number}>) => void
 *
 * Redux:
 * - s.mapEditor.drawingPolylinePoints: Array<{x:number,y:number}>  (relative coords 0..1)
 * - s.mapEditor.enabledDrawingMode === "EDITED_POLYLINE" to draw
 */
export default function NodePolyline({
  polyline,
  onPolyineChange,
  imageSize,
  toBaseFromClient,
  isDrawing,
  onComplete,
}) {
  // handlers
  const drawingPolylinePoints = polyline?.points ?? [];

  // Add hover state
  const [isHovered, setIsHovered] = useState(false);

  // local preview state (last mouse position in relative coords)
  const [currentMousePos, setCurrentMousePos] = useState(null);

  // rAF throttle for mousemove
  const nextPosRef = useRef(null);
  const rafIdRef = useRef(null);

  useEffect(() => {
    if (!isDrawing) {
      // reset local preview when not drawing
      setCurrentMousePos(null);
      return;
    }

    function onMove(e) {
      const containerLocal = toBaseFromClient(e.clientX, e.clientY);

      const w = imageSize?.w || 1;
      const h = imageSize?.h || 1;

      const rx = containerLocal.x / w;
      const ry = containerLocal.y / h;

      nextPosRef.current = { x: rx, y: ry };

      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          if (nextPosRef.current) {
            setCurrentMousePos(nextPosRef.current);
          }
        });
      }
    }

    function onDblClick() {
      if (drawingPolylinePoints.length >= 2) {
        onComplete && onComplete(drawingPolylinePoints);
        setCurrentMousePos(null);
      }
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("dblclick", onDblClick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("dblclick", onDblClick);
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [
    isDrawing,
    imageSize?.w,
    imageSize?.h,
    drawingPolylinePoints.length,
    onComplete,
    toBaseFromClient,
  ]);

  // Build preview points: committed clicks + moving endpoint
  const allPoints = [...drawingPolylinePoints];
  if (isDrawing && currentMousePos && drawingPolylinePoints.length > 0) {
    allPoints.push(currentMousePos);
  }

  // relative -> pixel coords in container image
  const w = imageSize?.w || 0;
  const h = imageSize?.h || 0;
  const pxPts = allPoints.map((p) => ({ x: p.x * w, y: p.y * h }));

  const lastCommitted =
    drawingPolylinePoints.length > 0
      ? drawingPolylinePoints[drawingPolylinePoints.length - 1]
      : null;

  return (
    <g>
      {/* Transparent helper path for easier mouse interaction */}
      {pxPts.length >= 2 && (
        <polyline
          points={pxPts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="transparent"
          strokeWidth="12" // Much wider for easier clicking
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}

      {/* Visible polyline path */}
      {pxPts.length >= 2 && (
        <polyline
          points={pxPts.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={isHovered ? "#0066cc" : "#ff0000"}
          strokeWidth={isHovered ? "3" : "2"}
          strokeDasharray="5,5"
          style={{ pointerEvents: "none" }} // No pointer events on visible path
        />
      )}

      {/* Transparent helper for preview segment */}
      {lastCommitted && currentMousePos && isDrawing && (
        <line
          x1={lastCommitted.x * w}
          y1={lastCommitted.y * h}
          x2={currentMousePos.x * w}
          y2={currentMousePos.y * h}
          stroke="transparent"
          strokeWidth="12" // Wide for easier interaction
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      )}

      {/* Visible preview segment from last committed point to mouse */}
      {lastCommitted && currentMousePos && isDrawing && (
        <line
          x1={lastCommitted.x * w}
          y1={lastCommitted.y * h}
          x2={currentMousePos.x * w}
          y2={currentMousePos.y * h}
          stroke={isHovered ? "#0066cc" : "#ff0000"}
          strokeWidth="2"
          strokeDasharray="3,3"
          opacity="0.7"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* Transparent helper circles for points */}
      {pxPts.map((p, i) => (
        <circle
          key={`helper-${i}`}
          cx={p.x}
          cy={p.y}
          r="12" // Much larger hit area
          fill="transparent"
          stroke="transparent"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
      ))}

      {/* Visible points */}
      {pxPts.map((p, i) => (
        <circle
          key={`visible-${i}`}
          cx={p.x}
          cy={p.y}
          r={isHovered ? "5" : "4"}
          fill={isHovered ? "#0066cc" : "#ff0000"}
          stroke="#ffffff"
          strokeWidth="2"
          style={{ pointerEvents: "none" }}
        />
      ))}
    </g>
  );
}
