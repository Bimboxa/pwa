// components/DrawingLayer.jsx
import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useEffect,
} from "react";

import { getCircleFrom3Points } from "Features/geometry/utils/getPolylinePointsFromCircle";
import getCoteDisplayValue from "Features/annotations/utils/getCoteDisplayValue";
import { useDrawingMetrics } from "App/contexts/DrawingMetricsContext";
import { expandArcsInPath, typeOf } from "Features/geometry/utils/arcSampling";
import getCenteredBandFromGuideLine from "Features/geometry/utils/getCenteredBandFromGuideLine";

// Number of samples per arc segment — mirrors NodePolylineStatic so the live
// preview matches the committed render.
const ARC_SAMPLES = 16;

// Compute offset polyline with proper miter joints at corners
function offsetPolyline(pts, distance) {
  const len = pts.length;
  if (len < 2) return [];

  // Compute per-segment offset lines (point + direction vector)
  const lines = [];
  for (let i = 0; i < len - 1; i++) {
    const dx = pts[i + 1].x - pts[i].x;
    const dy = pts[i + 1].y - pts[i].y;
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen === 0) continue;
    const ux = dx / segLen,
      uy = dy / segLen;
    const nx = -uy,
      ny = ux; // normal (90° rotation)
    lines.push({
      p: { x: pts[i].x + nx * distance, y: pts[i].y + ny * distance },
      v: { x: ux, y: uy },
      segLen,
    });
  }
  if (lines.length === 0) return [];

  const result = [lines[0].p]; // first point

  // Interior points: miter joint via line-line intersection
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1],
      curr = lines[i];
    const cross = prev.v.x * curr.v.y - prev.v.y * curr.v.x;
    if (Math.abs(cross) < 1e-5) {
      result.push(curr.p); // parallel segments
    } else {
      const dp = { x: curr.p.x - prev.p.x, y: curr.p.y - prev.p.y };
      const t = (dp.x * curr.v.y - dp.y * curr.v.x) / cross;
      result.push({ x: prev.p.x + t * prev.v.x, y: prev.p.y + t * prev.v.y });
    }
  }

  // Last point: project along last segment direction
  const last = lines[lines.length - 1];
  result.push({
    x: last.p.x + last.v.x * last.segLen,
    y: last.p.y + last.v.y * last.segLen,
  });

  return result;
}

// Compute strip band path: original polyline + offset polyline reversed
function computeStripPath(pts, distance) {
  if (pts.length < 2) return "";
  const offset = offsetPolyline(pts, distance);
  if (offset.length < 2) return "";
  const all = [...pts, ...offset.reverse()];
  return "M " + all.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
}

const STRIP_DEFAULT_WIDTH = 20; // px, same as getStripePolygons default

const DrawingLayer = forwardRef(
  (
    {
      points,
      newAnnotation,
      enabledDrawingMode,
      containerK,
      meterByPx,
      baseMapImageScale = 1,
      isForBaseMaps = false,
      orthoSnapAngleOffset = 0,
      rampWidthM = 1,
    },
    ref
  ) => {
    // Refs pour l'accès DOM direct (Performance)
    const previewLineRef = useRef(null);
    const previewArcPathRef = useRef(null); // arc preview for an "open" circle tail
    const previewFillRef = useRef(null);
    const previewRectRef = useRef(null); // <--- NOUVELLE REF
    const previewCircleRef = useRef(null);
    const previewStripRef = useRef(null);
    const previewRampRef = useRef(null); // ramp band preview (centered on the median line)
    // Cote preview refs (offset dimension line + dashed extensions + value text)
    const previewCoteGroupRef = useRef(null);
    const previewCoteMainRef = useRef(null);
    const previewCoteExt1Ref = useRef(null);
    const previewCoteExt2Ref = useRef(null);
    const previewCoteLabelOuterRef = useRef(null); // translate + rotate (SVG attr)
    const previewCoteLabelInnerRef = useRef(null); // counter-scale (CSS var)
    const previewCoteTextRef = useRef(null);
    // Endpoint tick markers (perpendicular to the cote line, fixed screen size)
    const previewCoteTick1OuterRef = useRef(null);
    const previewCoteTick2OuterRef = useRef(null);

    // Keep refs so the imperative handle always reads fresh values
    const newAnnotationRef = useRef(newAnnotation);
    useEffect(() => {
      newAnnotationRef.current = newAnnotation;
    }, [newAnnotation]);

    // Sync ref immediately during render (not in useEffect which runs after paint)
    const pointsRef = useRef(points);
    pointsRef.current = points;

    const meterByPxRef = useRef(meterByPx);
    meterByPxRef.current = meterByPx;

    const rampWidthMRef = useRef(rampWidthM);
    rampWidthMRef.current = rampWidthM;

    const orthoSnapAngleOffsetRef = useRef(orthoSnapAngleOffset);
    orthoSnapAngleOffsetRef.current = orthoSnapAngleOffset;

    // Rectangle typed X/Y dimensions (in meters) — optional, only set when the
    // map editor is wrapped in <DrawingMetricsProvider> (V3 pipeline).
    const drawingMetrics = useDrawingMetrics();
    const rectMetricsRef = drawingMetrics?.rectMetricsRef;

    const {
      strokeColor: rawStrokeColor,
      fillColor: rawFillColor,
      type,
      strokeWidth,
      strokeWidthUnit,
      strokeOpacity,
      strokeType,
    } = newAnnotation || {};

    // Openings (ouvertures) are drawn in red @ 0.8 opacity regardless of the
    // draft's own colours. Gated strictly on the opening context so normal
    // POLYLINE / STRIP drawing (and its strokeWidth) is left untouched.
    const isOpening = Boolean(newAnnotation?.isOpening) || type === "CUT";
    const OPENING_COLOR = "#ff0000";
    const strokeColor = isOpening ? OPENING_COLOR : rawStrokeColor;
    const fillColor = isOpening ? OPENING_COLOR : rawFillColor;

    // Détection des types
    const isPolygon = type === "POLYGON";

    // --- STYLE DE TRAIT (preview) ---
    // POLYLINE / segment previews mirror the annotation's stroke (width,
    // opacity, dash style) so the temporary trait looks like the final one and
    // there is no jump on finalize. POLYGON / STRIP / RAMP keep the legacy
    // fixed 2px dashed guide: for POLYGON the contour styling differs, and for
    // STRIP/RAMP `strokeWidth` is the band width (already drawn by the dedicated
    // band preview), so the rubber-band line must stay a thin fixed helper.
    const previewUsesAnnotationStyle =
      type !== "POLYGON" && type !== "STRIP" && enabledDrawingMode !== "RAMP";
    const previewIsCmUnit =
      previewUsesAnnotationStyle && strokeWidthUnit === "CM" && meterByPx > 0;
    const previewScalesWithZoom =
      previewUsesAnnotationStyle && (previewIsCmUnit || isForBaseMaps);
    const previewStrokeWidth = useMemo(() => {
      if (!previewUsesAnnotationStyle) return 2;
      const raw = strokeWidth ?? 2;
      // Mirror NodePolylineStatic.computedStrokeWidth. When the width scales
      // with zoom (CM / isForBaseMaps), vectorEffect is dropped below so the
      // SVG-space stroke grows with the zoom transform, like the committed path.
      if (previewIsCmUnit) return (raw * 0.01) / meterByPx;
      if (isForBaseMaps) return raw * (baseMapImageScale || 1);
      // PX mode: raw value, vectorEffect="non-scaling-stroke" keeps it fixed.
      return raw;
    }, [
      previewUsesAnnotationStyle,
      strokeWidth,
      previewIsCmUnit,
      meterByPx,
      isForBaseMaps,
      baseMapImageScale,
    ]);
    const previewVectorEffect = previewScalesWithZoom
      ? undefined
      : "non-scaling-stroke";
    // Opacity of the temporary trait: mirror the annotation for POLYLINE /
    // segment; undefined (→ 1) for POLYGON / STRIP / RAMP, as before.
    const previewStrokeOpacity = isOpening
      ? 0.8
      : previewUsesAnnotationStyle
        ? strokeOpacity
        : undefined;
    // Dash pattern of the temporary trait (rubber band / arc):
    // - POLYLINE / segment: solid, unless the annotation style is DASHED.
    // - POLYGON / STRIP / RAMP: legacy "5,5" guide dashes.
    const previewTempDashArray = previewUsesAnnotationStyle
      ? strokeType === "DASHED"
        ? "1 1"
        : undefined
      : "5,5";
    // Dash pattern of the already-validated segments (static stroke): solid,
    // unless the POLYLINE / segment annotation style is DASHED.
    const previewStaticDashArray =
      previewUsesAnnotationStyle && strokeType === "DASHED" ? "1 1" : undefined;

    // Mirror NodePolylineStatic: for POLYGON the visible stroke matches the
    // fillColor, so the live drawing preview must do the same — otherwise the
    // contour color jumps the moment the user finalizes the shape.
    const effectiveStrokeColor = isPolygon ? fillColor : strokeColor;
    const isStrip = type === "STRIP";
    // RAMP draws a POLYGON (type === "POLYGON") but previews a band centered on
    // the drawn median line instead of the closed polygon-of-the-clicks.
    const isRamp = enabledDrawingMode === "RAMP";
    const isLocalizedRepair = enabledDrawingMode === "LOCALIZED_REPAIR";
    const drawRectangle = [
      "RECTANGLE",
      "POLYLINE_RECTANGLE",
      "POLYGON_RECTANGLE",
      "CUT_RECTANGLE",
      "LOCALIZED_REPAIR",
    ].includes(enabledDrawingMode);
    const drawCircle = [
      "CIRCLE",
      "POLYLINE_CIRCLE",
      "POLYGON_CIRCLE",
      "CUT_CIRCLE",
    ].includes(enabledDrawingMode);
    // Center + radius circle: 1st point = center, cursor defines the radius.
    const drawCircleRadius = [
      "POLYLINE_CIRCLE_RADIUS",
      "POLYGON_CIRCLE_RADIUS",
    ].includes(enabledDrawingMode);
    const drawCote = enabledDrawingMode === "COTE_TWO_CLICK";

    const firstPoint = points?.[0];

    useImperativeHandle(ref, () => ({
      // Force-update the points ref immediately (bypasses React render cycle)
      setPoints: (newPoints) => {
        pointsRef.current = newPoints;
      },
      updatePreview: (cursorPos) => {
        // Use ref to always get the latest points
        const currentPoints = pointsRef.current;
        // S'il n'y a pas encore de point posé, on ne dessine rien
        if (!currentPoints || currentPoints.length === 0) return;

        const lastPoint = currentPoints[currentPoints.length - 1];

        // ------------------------------------------------
        // CAS 1 : RECTANGLE (1er point fixe -> Curseur)
        // ------------------------------------------------
        if (drawRectangle && previewRectRef.current) {
          // On cache les éléments inutiles pour ce mode
          if (previewLineRef.current)
            previewLineRef.current.style.display = "none";
          if (previewFillRef.current)
            previewFillRef.current.style.display = "none";

          const angle = orthoSnapAngleOffsetRef.current || 0;

          // Typed X/Y dimensions override (in meters → image pixels)
          const metrics = rectMetricsRef?.current;
          const mbp = meterByPxRef.current;
          const hasScale = Number.isFinite(mbp) && mbp > 0;
          const mPerPx = hasScale ? mbp : 1;
          const forcedDx =
            metrics?.rectX != null ? metrics.rectX / mPerPx : null;
          const forcedDy =
            metrics?.rectY != null ? metrics.rectY / mPerPx : null;

          if (angle === 0) {
            // Axis-aligned rectangle (original behavior)
            const cx =
              forcedDx != null ? lastPoint.x + forcedDx : cursorPos.x;
            const cy =
              forcedDy != null ? lastPoint.y + forcedDy : cursorPos.y;
            const x = Math.min(lastPoint.x, cx);
            const y = Math.min(lastPoint.y, cy);
            const width = Math.abs(cx - lastPoint.x);
            const height = Math.abs(cy - lastPoint.y);
            previewRectRef.current.setAttribute(
              "points",
              `${x},${y} ${x + width},${y} ${x + width},${y + height} ${x},${y + height}`
            );
          } else {
            // Rotated rectangle: project diagonal onto ortho snap grid axes
            // Snap grid primary axis is at -offset in screen coords (Y down)
            const theta = (-angle * Math.PI) / 180;
            const ax1 = { x: Math.cos(theta), y: Math.sin(theta) };
            const ax2 = { x: -Math.sin(theta), y: Math.cos(theta) };

            const dx = cursorPos.x - lastPoint.x;
            const dy = cursorPos.y - lastPoint.y;

            // Project diagonal onto the two grid axes (overrideable per axis)
            const d1 = forcedDx != null ? forcedDx : dx * ax1.x + dy * ax1.y;
            const d2 = forcedDy != null ? forcedDy : dx * ax2.x + dy * ax2.y;

            // 4 corners: A, B, C (=cursor projected), D
            const A = lastPoint;
            const B = { x: A.x + d1 * ax1.x, y: A.y + d1 * ax1.y };
            const C = { x: B.x + d2 * ax2.x, y: B.y + d2 * ax2.y };
            const D = { x: A.x + d2 * ax2.x, y: A.y + d2 * ax2.y };

            previewRectRef.current.setAttribute(
              "points",
              `${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`
            );
          }

          previewRectRef.current.style.display = "block";
          return; // On arrête ici pour le rectangle
        }

        // ------------------------------------------------
        // CAS 1c : COTE (1 point placed -> live preview of offset dim line)
        // ------------------------------------------------
        if (drawCote && previewCoteGroupRef.current) {
          if (previewLineRef.current)
            previewLineRef.current.style.display = "none";
          if (previewFillRef.current)
            previewFillRef.current.style.display = "none";
          if (previewRectRef.current)
            previewRectRef.current.style.display = "none";
          if (previewCircleRef.current)
            previewCircleRef.current.style.display = "none";
          if (previewStripRef.current)
            previewStripRef.current.style.display = "none";

          const p1 = currentPoints[0];
          const p2 = cursorPos;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len > 0.5) {
            const ux = dx / len;
            const uy = dy / len;
            const nx = -uy;
            const ny = ux;

            const na = newAnnotationRef.current || {};
            const off = Number(na.extensionOffset ?? 8);
            const offUnit = na.extensionOffsetUnit ?? "PX";
            const mbp = meterByPxRef.current;
            const hasScale = Number.isFinite(mbp) && mbp > 0;
            const offPx =
              offUnit === "CM" && hasScale ? (off * 0.01) / mbp : off;

            const D1 = { x: p1.x + nx * offPx, y: p1.y + ny * offPx };
            const D2 = { x: p2.x + nx * offPx, y: p2.y + ny * offPx };

            previewCoteMainRef.current?.setAttribute("x1", D1.x);
            previewCoteMainRef.current?.setAttribute("y1", D1.y);
            previewCoteMainRef.current?.setAttribute("x2", D2.x);
            previewCoteMainRef.current?.setAttribute("y2", D2.y);

            previewCoteExt1Ref.current?.setAttribute("x1", p1.x);
            previewCoteExt1Ref.current?.setAttribute("y1", p1.y);
            previewCoteExt1Ref.current?.setAttribute("x2", D1.x);
            previewCoteExt1Ref.current?.setAttribute("y2", D1.y);

            previewCoteExt2Ref.current?.setAttribute("x1", p2.x);
            previewCoteExt2Ref.current?.setAttribute("y1", p2.y);
            previewCoteExt2Ref.current?.setAttribute("x2", D2.x);
            previewCoteExt2Ref.current?.setAttribute("y2", D2.y);

            // Endpoint ticks — perpendicular to the cote direction, rotated
            // to the same angle as the line.
            const tickAngleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
            previewCoteTick1OuterRef.current?.setAttribute(
              "transform",
              `translate(${p1.x} ${p1.y}) rotate(${tickAngleDeg})`
            );
            previewCoteTick2OuterRef.current?.setAttribute(
              "transform",
              `translate(${p2.x} ${p2.y}) rotate(${tickAngleDeg})`
            );

            const valueText = getCoteDisplayValue({
              p1,
              p2,
              meterByPx: mbp,
              unit: na.unit ?? "CM",
              decimals: na.decimals ?? 0,
              showUnitLabel: na.showUnitLabel ?? false,
            });
            if (
              previewCoteTextRef.current &&
              previewCoteLabelOuterRef.current &&
              previewCoteLabelInnerRef.current
            ) {
              const mid = { x: (D1.x + D2.x) / 2, y: (D1.y + D2.y) / 2 };
              let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
              let textFlip = false;
              if (angleDeg > 90) {
                angleDeg -= 180;
                textFlip = true;
              } else if (angleDeg < -90) {
                angleDeg += 180;
                textFlip = true;
              }
              const k = containerK || 1;
              const textNormalSign =
                (textFlip ? -1 : 1) * (offPx >= 0 ? 1 : -1);
              const fs = Number(na.fontSize) || 18;
              // Outer group: position + rotation (SVG attribute).
              previewCoteLabelOuterRef.current.setAttribute(
                "transform",
                `translate(${mid.x} ${mid.y}) rotate(${angleDeg})`
              );
              // Inner group: counter-scale via CSS (supports var(--map-zoom)).
              // Mirrors the NodeCoteStatic final render so preview size matches.
              previewCoteLabelInnerRef.current.style.transform = `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
              previewCoteTextRef.current.textContent = valueText;
              previewCoteTextRef.current.setAttribute("font-size", fs);
              previewCoteTextRef.current.setAttribute(
                "y",
                String(textNormalSign * 4)
              );
              previewCoteTextRef.current.setAttribute(
                "dominant-baseline",
                textNormalSign < 0 ? "alphabetic" : "hanging"
              );
            }

            previewCoteGroupRef.current.style.display = "block";
          } else {
            previewCoteGroupRef.current.style.display = "none";
          }
          return;
        }

        // ------------------------------------------------
        // CAS 1b : CIRCLE (2 points placed -> preview with cursor as 3rd)
        // ------------------------------------------------
        if (
          drawCircle &&
          currentPoints.length >= 2 &&
          previewCircleRef.current
        ) {
          if (previewLineRef.current)
            previewLineRef.current.style.display = "none";
          if (previewFillRef.current)
            previewFillRef.current.style.display = "none";
          if (previewRectRef.current)
            previewRectRef.current.style.display = "none";

          const circle = getCircleFrom3Points(
            currentPoints[0],
            currentPoints[1],
            cursorPos
          );
          if (circle) {
            previewCircleRef.current.setAttribute("cx", circle.cx);
            previewCircleRef.current.setAttribute("cy", circle.cy);
            previewCircleRef.current.setAttribute("r", circle.r);
            previewCircleRef.current.style.display = "block";
          } else {
            previewCircleRef.current.style.display = "none";
          }
          return;
        }

        // ------------------------------------------------
        // CAS 1b' : CIRCLE_RADIUS (center placed -> cursor sets the radius)
        // ------------------------------------------------
        if (drawCircleRadius && previewCircleRef.current) {
          if (previewLineRef.current)
            previewLineRef.current.style.display = "none";
          if (previewFillRef.current)
            previewFillRef.current.style.display = "none";
          if (previewRectRef.current)
            previewRectRef.current.style.display = "none";

          const center = currentPoints[0];
          const r = Math.hypot(cursorPos.x - center.x, cursorPos.y - center.y);
          if (r > 0) {
            previewCircleRef.current.setAttribute("cx", center.x);
            previewCircleRef.current.setAttribute("cy", center.y);
            previewCircleRef.current.setAttribute("r", r);
            previewCircleRef.current.style.display = "block";
          } else {
            previewCircleRef.current.style.display = "none";
          }
          return;
        }

        // Hide circle preview when not in CIRCLE mode with 2+ points
        if (previewCircleRef.current)
          previewCircleRef.current.style.display = "none";

        // ------------------------------------------------
        // CAS 2b : STRIP (Band preview)
        // ------------------------------------------------
        if (isStrip && previewStripRef.current) {
          if (previewRectRef.current)
            previewRectRef.current.style.display = "none";

          const allPts = [...currentPoints, cursorPos];
          const na = newAnnotationRef.current;
          const rawWidth = na?.strokeWidth ?? STRIP_DEFAULT_WIDTH;
          const stripOrientation = na?.stripOrientation ?? 1;
          const isCm = na?.strokeWidthUnit === "CM" && meterByPxRef.current > 0;
          const stripWidth = isCm
            ? (rawWidth * 0.01) / meterByPxRef.current
            : rawWidth;
          const centerline = expandArcsInPath(allPts, ARC_SAMPLES, false);
          const d = computeStripPath(centerline, stripWidth * stripOrientation);
          previewStripRef.current.setAttribute("d", d);
          previewStripRef.current.style.display = "block";

          // Also show elastic line
          if (previewLineRef.current) {
            previewLineRef.current.setAttribute("x1", lastPoint.x);
            previewLineRef.current.setAttribute("y1", lastPoint.y);
            previewLineRef.current.setAttribute("x2", cursorPos.x);
            previewLineRef.current.setAttribute("y2", cursorPos.y);
            previewLineRef.current.style.display = "block";
          }
          return;
        }

        // ------------------------------------------------
        // CAS 2c : RAMP (band centered on the median line)
        // ------------------------------------------------
        if (isRamp && previewRampRef.current) {
          if (previewRectRef.current)
            previewRectRef.current.style.display = "none";
          if (previewFillRef.current)
            previewFillRef.current.style.display = "none";

          const mbp = meterByPxRef.current;
          const widthPx = mbp > 0 ? (Number(rampWidthMRef.current) || 0) / mbp : 0;
          // Centered band from the median CONTROL points (arcs kept as arcs),
          // mirroring useHandleCommitRamp; expand only for the SVG path so the
          // preview matches the committed geometry.
          const ring = getCenteredBandFromGuideLine(
            [...currentPoints, cursorPos],
            widthPx
          );
          if (ring.length >= 3) {
            const expandedRing = expandArcsInPath(ring, ARC_SAMPLES, true);
            const d =
              "M " +
              expandedRing.map((p) => `${p.x} ${p.y}`).join(" L ") +
              " Z";
            previewRampRef.current.setAttribute("d", d);
            previewRampRef.current.style.display = "block";
          } else {
            previewRampRef.current.style.display = "none";
          }

          // Elastic line from the last point to the cursor (hidden while the
          // last point is an open arc — the band curve already conveys it).
          const lastIsOpenCircle =
            currentPoints.length >= 2 && typeOf(lastPoint) === "circle";
          if (!lastIsOpenCircle && previewLineRef.current) {
            previewLineRef.current.setAttribute("x1", lastPoint.x);
            previewLineRef.current.setAttribute("y1", lastPoint.y);
            previewLineRef.current.setAttribute("x2", cursorPos.x);
            previewLineRef.current.setAttribute("y2", cursorPos.y);
            previewLineRef.current.style.display = "block";
          } else if (previewLineRef.current) {
            previewLineRef.current.style.display = "none";
          }
          return;
        }

        // ------------------------------------------------
        // CAS 2 : POLYLINE / POLYGON / SEGMENT
        // ------------------------------------------------

        // On s'assure que le rectangle est caché
        if (previewRectRef.current)
          previewRectRef.current.style.display = "none";
        if (previewStripRef.current)
          previewStripRef.current.style.display = "none";

        // 1. Mise à jour de la ligne élastique
        // Si le dernier point posé est un "circle" ouvert (pas encore suivi
        // d'un square), on dessine l'arc [avant-dernier, circle, curseur] au
        // lieu de la ligne droite, pour voir la courbe s'adapter au mouseMove.
        const lastIsOpenCircle =
          currentPoints.length >= 2 && typeOf(lastPoint) === "circle";
        if (lastIsOpenCircle && previewArcPathRef.current) {
          const prev = currentPoints[currentPoints.length - 2];
          const arcPts = expandArcsInPath(
            [prev, lastPoint, cursorPos],
            ARC_SAMPLES,
            false
          );
          previewArcPathRef.current.setAttribute(
            "d",
            "M " + arcPts.map((p) => `${p.x} ${p.y}`).join(" L ")
          );
          previewArcPathRef.current.style.display = "block";
          if (previewLineRef.current)
            previewLineRef.current.style.display = "none";
        } else {
          if (previewArcPathRef.current)
            previewArcPathRef.current.style.display = "none";
          if (previewLineRef.current) {
            previewLineRef.current.setAttribute("x1", lastPoint.x);
            previewLineRef.current.setAttribute("y1", lastPoint.y);
            previewLineRef.current.setAttribute("x2", cursorPos.x);
            previewLineRef.current.setAttribute("y2", cursorPos.y);
            previewLineRef.current.style.display = "block";
          }
        }

        // 2. Mise à jour du remplissage dynamique (Polygone uniquement)
        if (isPolygon && previewFillRef.current) {
          const fillPts = expandArcsInPath(
            [...currentPoints, cursorPos],
            ARC_SAMPLES,
            false
          );
          const d =
            "M " + fillPts.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
          previewFillRef.current.setAttribute("d", d);
          previewFillRef.current.style.display = "block";
        }
      },

      clearPreview: () => {
        if (previewLineRef.current)
          previewLineRef.current.style.display = "none";
        if (previewArcPathRef.current)
          previewArcPathRef.current.style.display = "none";
        if (previewFillRef.current)
          previewFillRef.current.style.display = "none";
        if (previewRectRef.current)
          previewRectRef.current.style.display = "none";
        if (previewCircleRef.current)
          previewCircleRef.current.style.display = "none";
        if (previewStripRef.current)
          previewStripRef.current.style.display = "none";
        if (previewRampRef.current)
          previewRampRef.current.style.display = "none";
        if (previewCoteGroupRef.current)
          previewCoteGroupRef.current.style.display = "none";
      },
    }));

    // Construction du chemin statique (ce qui est déjà cliqué)
    // Pour le rectangle, "points" ne contient qu'un seul point pendant le dessin, donc staticPath sera vide, ce qui est correct.
    // Les arcs S-C-S validés sont rendus courbes (cohérent avec NodePolylineStatic).
    // Si le dernier point est un "circle" ouvert (pas encore suivi d'un square),
    // on le retire du tracé statique : il est dessiné par l'aperçu live à la place.
    const staticPath = useMemo(() => {
      if (!points || points.length <= 1) return "";
      let committed = points;
      const trailingOpenCircle =
        points.length >= 2 && typeOf(points[points.length - 1]) === "circle";
      if (trailingOpenCircle) committed = points.slice(0, -1);
      const expanded = expandArcsInPath(committed, ARC_SAMPLES, false);
      return expanded.length > 1
        ? "M " + expanded.map((p) => `${p.x} ${p.y}`).join(" L ")
        : "";
    }, [points]);

    // Scale pour les points fixes
    const scaleTransform = useMemo(() => {
      const k = containerK || 1;
      return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    return (
      <g className="drawing-layer">
        {/* A0. Strip band — dynamic preview (all points + cursor) */}
        {isStrip && (
          <path
            ref={previewStripRef}
            fill={strokeColor || fillColor || "rgba(92, 92, 236, 0.3)"}
            opacity={isOpening ? 0.8 : 0.25}
            stroke="none"
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* A0b. Ramp band — dynamic preview centered on the median line */}
        {isRamp && (
          <path
            ref={previewRampRef}
            fill={fillColor || "rgba(92, 92, 236, 0.3)"}
            fillOpacity={newAnnotation?.fillOpacity ?? 0.5}
            stroke="none"
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* A. Dynamic Fill (Polygon) — suppressed for RAMP (band shown instead) */}
        {isPolygon && !isRamp && (
          <path
            ref={previewFillRef}
            fill={fillColor || "rgba(0, 0, 255, 0.1)"}
            fillRule="evenodd"
            stroke="none"
            opacity={0.5}
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* B. Dynamic Rectangle (polygon for rotation support) */}
        {drawRectangle && (
          <polygon
            ref={previewRectRef}
            fill="none"
            {...(!isLocalizedRepair &&
              isPolygon && { fill: fillColor || "rgba(92, 92, 236, 0.1)" })}
            fillOpacity={newAnnotation?.fillOpacity ?? 0.8}
            stroke={isLocalizedRepair ? "#00ff00" : effectiveStrokeColor || "#2196f3"}
            strokeWidth={isLocalizedRepair ? 2 : previewStrokeWidth}
            vectorEffect={isLocalizedRepair ? "non-scaling-stroke" : previewVectorEffect}
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* B2. Dynamic Circle preview */}
        {(drawCircle || drawCircleRadius) && (
          <circle
            ref={previewCircleRef}
            fill="none"
            {...(isPolygon && { fill: fillColor || "rgba(92, 92, 236, 0.1)" })}
            fillOpacity={newAnnotation?.fillOpacity ?? 0.8}
            stroke={effectiveStrokeColor || "#2196f3"}
            strokeWidth={previewStrokeWidth}
            vectorEffect={previewVectorEffect}
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* C. Static Stroke (Traits déjà validés) — hidden in COTE mode
            since the dedicated preview group renders its own dimension line */}
        {!drawCote && (
          <path
            d={staticPath}
            stroke={effectiveStrokeColor || "blue"}
            strokeWidth={previewStrokeWidth}
            strokeOpacity={previewStrokeOpacity}
            fill="none"
            vectorEffect={previewVectorEffect}
            {...(previewStaticDashArray && {
              strokeDasharray: previewStaticDashArray,
            })}
          />
        )}

        {/* D. Vertices (Points déjà validés) — hidden in COTE mode (the
            preview group renders perpendicular ticks instead) */}
        {!drawCote &&
          points.map((p, i) => (
            <circle
              key={i}
              r={3} // Taille fixe visuelle (avant transform)
              cx={0}
              cy={0} // Centré car on translate via le groupe ou le transform direct
              fill={effectiveStrokeColor || "blue"}
              style={{
                transform: `translate(${p.x}px, ${p.y}px) ${scaleTransform}`,
                vectorEffect: "non-scaling-stroke", // Peut-être redundante si on scale le container, mais safe
              }}
            />
          ))}

        {/* E. Zone Closing — now handled in InteractionLayer via screen-distance check */}

        {/* F. Dynamic Rubber Band (Ligne élastique pour polyline/segment) */}
        {!drawRectangle && !(drawCircle && points.length >= 2) && !drawCote && (
          <line
            ref={previewLineRef}
            stroke={effectiveStrokeColor || "blue"}
            strokeWidth={previewStrokeWidth}
            strokeOpacity={previewStrokeOpacity}
            vectorEffect={previewVectorEffect}
            {...(previewTempDashArray && {
              strokeDasharray: previewTempDashArray,
            })}
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* F2. Dynamic arc preview (replaces the rubber band when the last
            placed point is an "open" circle — the curve follows the cursor) */}
        {!drawRectangle && !(drawCircle && points.length >= 2) && !drawCote && (
          <path
            ref={previewArcPathRef}
            fill="none"
            stroke={effectiveStrokeColor || "blue"}
            strokeWidth={previewStrokeWidth}
            strokeOpacity={previewStrokeOpacity}
            vectorEffect={previewVectorEffect}
            {...(previewTempDashArray && {
              strokeDasharray: previewTempDashArray,
            })}
            style={{ display: "none", pointerEvents: "none" }}
          />
        )}

        {/* G. COTE preview (offset dim line + dashed extensions + value) */}
        {drawCote && (
          <g
            ref={previewCoteGroupRef}
            style={{ display: "none", pointerEvents: "none" }}
          >
            <line
              ref={previewCoteMainRef}
              stroke={strokeColor || "#2196f3"}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              ref={previewCoteExt1Ref}
              stroke={strokeColor || "#2196f3"}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <line
              ref={previewCoteExt2Ref}
              stroke={strokeColor || "#2196f3"}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {/* Start/end ticks — perpendicular to the cote direction,
                counter-scaled so they stay at fixed screen size. */}
            <g ref={previewCoteTick1OuterRef}>
              <g style={{ transform: scaleTransform }}>
                <line
                  x1={0}
                  y1={-6}
                  x2={0}
                  y2={6}
                  stroke={strokeColor || "#2196f3"}
                  strokeWidth={2}
                />
              </g>
            </g>
            <g ref={previewCoteTick2OuterRef}>
              <g style={{ transform: scaleTransform }}>
                <line
                  x1={0}
                  y1={-6}
                  x2={0}
                  y2={6}
                  stroke={strokeColor || "#2196f3"}
                  strokeWidth={2}
                />
              </g>
            </g>
            <g ref={previewCoteLabelOuterRef}>
              <g ref={previewCoteLabelInnerRef}>
                <text
                  ref={previewCoteTextRef}
                  textAnchor="middle"
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={strokeColor || "#2196f3"}
                  style={{
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                    userSelect: "none",
                  }}
                />
              </g>
            </g>
          </g>
        )}
      </g>
    );
  }
);

export default DrawingLayer;
