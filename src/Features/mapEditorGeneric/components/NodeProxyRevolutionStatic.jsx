import { useMemo, useState } from "react";

import getAnnulusSectorPath, {
  normalizeSpan,
  polar,
} from "Features/mapEditorGeneric/utils/getAnnulusSectorPath";

// Plan-view node for a PARTIAL revolution proxy. Replaces the full-ring polygon
// renderer when src.shape3D.partialRevolution is on. It draws the donut as an
// annulus SECTOR (or a pie slice when the inner radius is ~0) spanning
// angleStart → angleEnd (the kept material), with a small centre cross.
//
// When `selected`, two draggable handles sit at the outer radius on each angle,
// joined to the centre by radial lines (the black lines in the spec image).
// Geometry comes in resolved to image px; dragging reports the NEW angles back
// via onChangeAngles(angleStart, angleEnd) on mouse-up. A selected proxy is
// hidden in StaticMapContent and drawn only by EditedObjectLayer, so the live
// preview can live in local state — no separate transient layer is needed.
//
// Modelled on NodeClippingPlanStatic (same drag math: getScreenCTM().inverse()).
export default function NodeProxyRevolutionStatic({
  center, // { x, y } in image px
  rOuter, // image px
  rInner = 0, // image px (0 → pie slice)
  angleStart, // radians (plan / image-pixel frame, y down)
  angleEnd, // radians
  fillColor = "#1976d2",
  selected = false,
  containerK = 1, // basePose.k — keep handles a fixed screen size
  imageSize, // { width, height } — to normalize drag positions (3D parity, unused here)
  onChangeAngles, // (angleStart, angleEnd) => void
}) {
  // state - live angles during a handle drag (null = use props)

  const [draft, setDraft] = useState(null);

  // helpers - fixed-on-screen sizes (image px = screen px / containerK)

  const k = containerK || 1;
  const HANDLE_R = 6 / k;
  const HANDLE_HIT_R = 13 / k;
  const STROKE_W = 1.5 / k;
  const CROSS = 10 / k;

  const aStart = draft ? draft.angleStart : angleStart;
  const aEnd = draft ? draft.angleEnd : angleEnd;

  const path = useMemo(
    () => getAnnulusSectorPath(center, rOuter, rInner, aStart, aEnd),
    [center?.x, center?.y, rOuter, rInner, aStart, aEnd]
  );

  // handlers

  function handleHandleMouseDown(which, e) {
    // Prevent MapEditorViewport from starting a pan (its onMouseDown bubbles).
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget;
    const svg = el.ownerSVGElement;
    if (!svg || !center) return;

    let next = { angleStart, angleEnd };

    const move = (ev) => {
      const ctm = el.getScreenCTM();
      if (!ctm) return;
      const pt = svg.createSVGPoint();
      pt.x = ev.clientX;
      pt.y = ev.clientY;
      const loc = pt.matrixTransform(ctm.inverse());
      const theta = Math.atan2(loc.y - center.y, loc.x - center.x);
      next =
        which === "start"
          ? { angleStart: theta, angleEnd }
          : { angleStart, angleEnd: theta };
      setDraft(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setDraft(null);
      onChangeAngles?.(next.angleStart, next.angleEnd);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  // render

  if (!center || !(rOuter > 0)) return null;

  const span = normalizeSpan(aEnd - aStart);
  const pStart = polar(center.x, center.y, rOuter, aStart);
  const pEnd = polar(center.x, center.y, rOuter, aStart + span);

  return (
    <g className="proxy-revolution-node">
      {/* sector fill */}
      <path
        d={path}
        fill={fillColor}
        fillOpacity={0.35}
        stroke={fillColor}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />

      {selected && (
        <>
          {/* radial lines centre → handles */}
          {[pStart, pEnd].map((p, i) => (
            <line
              key={`radial-${i}`}
              x1={center.x}
              y1={center.y}
              x2={p.x}
              y2={p.y}
              stroke="#000"
              strokeWidth={STROKE_W}
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
          ))}

          {/* centre cross */}
          <line
            x1={center.x - CROSS}
            y1={center.y}
            x2={center.x + CROSS}
            y2={center.y}
            stroke="#000"
            strokeWidth={STROKE_W}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />
          <line
            x1={center.x}
            y1={center.y - CROSS}
            x2={center.x}
            y2={center.y + CROSS}
            stroke="#000"
            strokeWidth={STROKE_W}
            vectorEffect="non-scaling-stroke"
            style={{ pointerEvents: "none" }}
          />

          {/* draggable angle handles */}
          {[
            ["start", pStart],
            ["end", pEnd],
          ].map(([which, p]) => (
            <g key={which}>
              <circle
                cx={p.x}
                cy={p.y}
                r={HANDLE_HIT_R}
                fill="transparent"
                style={{ cursor: "grab", pointerEvents: "auto" }}
                onMouseDown={(e) => handleHandleMouseDown(which, e)}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={HANDLE_R}
                fill={fillColor}
                stroke="#fff"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "none" }}
              />
            </g>
          ))}
        </>
      )}
    </g>
  );
}
