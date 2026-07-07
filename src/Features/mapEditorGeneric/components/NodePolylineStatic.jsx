import { memo, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSelector } from "react-redux";
import { darken } from "@mui/material/styles";
import theme from "Styles/theme";

// Tracks whether Shift is currently held — used to swap segment/cut hit-area
// cursors to "+"/"−" so the user sees ahead of clicking whether shift+click
// will add or remove from a multi-part selection.
//
// Module-level store shared by every node instance: a single set of window
// listeners, and components opt in via `enabled`. The cursor only matters on
// a selected annotation, so unselected nodes pass enabled=false and never
// re-render on Shift — with thousands of annotations displayed, per-instance
// keydown state froze the app on every Shift press/release.
let isShiftDownGlobal = false;
const shiftSubscribers = new Set();
let shiftWindowListenersInstalled = false;

function ensureShiftWindowListeners() {
  if (shiftWindowListenersInstalled || typeof window === "undefined") return;
  shiftWindowListenersInstalled = true;
  const setShiftDown = (next) => {
    if (isShiftDownGlobal === next) return;
    isShiftDownGlobal = next;
    shiftSubscribers.forEach((cb) => cb());
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") setShiftDown(true);
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") setShiftDown(false);
  });
  window.addEventListener("blur", () => setShiftDown(false));
}

function subscribeToShift(cb) {
  ensureShiftWindowListeners();
  shiftSubscribers.add(cb);
  return () => shiftSubscribers.delete(cb);
}
const subscribeNoop = () => () => {};
const getShiftSnapshot = () => isShiftDownGlobal;
const getShiftSnapshotDisabled = () => false;

function useIsShiftDown(enabled) {
  return useSyncExternalStore(
    enabled ? subscribeToShift : subscribeNoop,
    enabled ? getShiftSnapshot : getShiftSnapshotDisabled
  );
}

const CURSOR_ADD = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='9' fill='%2376ff03' stroke='white' stroke-width='1.5'/><path d='M12 7v10M7 12h10' stroke='white' stroke-width='2' stroke-linecap='round'/></svg>") 12 12, copy`;
const CURSOR_REMOVE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='9' fill='%23f44336' stroke='white' stroke-width='1.5'/><path d='M7 12h10' stroke='white' stroke-width='2' stroke-linecap='round'/></svg>") 12 12, not-allowed`;

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";
import getPolygonSlope from "Features/annotations/utils/getPolygonSlope";
import coerceAnnotationNumericFields from "Features/annotations/utils/coerceAnnotationNumericFields";
import { expandArcsInPath } from "Features/geometry/utils/arcSampling";
import useProfileResolution from "Features/annotations/hooks/useProfileResolution";
import NodeLabelStatic from "./NodeLabelStatic";
import getInnerOffsetSegmentPath from "Features/mapEditorGeneric/utils/getInnerOffsetSegmentPath";

// Extra padding on each side of the visible stroke for hit detection, in
// screen pixels (20 = ~10 px tolerance each side of the visible edge).
const HIT_STROKE_PADDING_SCREEN_PX = 20;

// Offset each point of a (possibly arc-carrying) path along its local
// right-of-tangent normal by `distance`. The per-vertex normal uses the
// neighbour-to-neighbour tangent, which at an arc's circle-midpoint is the
// radial direction — so offsetting an S-C-S triplet yields a concentric arc
// and the curve stays smooth. `type` is preserved so the arc-aware path
// builder still recognises the S-C-S pattern (real arcs, not segments).
function offsetPointsAlongNormals(pts, distance, closed) {
  const n = pts.length;
  if (n < 2) return pts.map((p) => ({ ...p }));
  return pts.map((p, i) => {
    let prev;
    let next;
    if (closed) {
      prev = pts[(i - 1 + n) % n];
      next = pts[(i + 1) % n];
    } else {
      prev = i > 0 ? pts[i - 1] : p;
      next = i < n - 1 ? pts[i + 1] : p;
    }
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const tx = dx / len;
    const ty = dy / len;
    // Right-of-tangent normal (matches the 3D sweep side).
    return { ...p, x: p.x + ty * distance, y: p.y + -tx * distance };
  });
}

// For POLYGON segment hit areas we skip the zoom-aware calc and use a fixed
// screen-space width — polygons have no visible stroke to "grow", so a zoom-
// independent band is what the user can rely on to click a specific edge.
const POLYGON_HIT_STROKE_WIDTH_PX = 10;

// --- CONSTANTES DE STYLE ---
const STYLE_CONSTANTS = {
  COLORS: {
    SELECTED_PART: theme.palette.annotation?.selectedPart || "#ff0000", // Rouge (Segment/Contour sélectionné)
    CUT_SELECTED: "#2196f3", // Bleu (Trou sélectionné)
    CONTEXT: "rgba(0,0,0,0.4)", // Gris foncé (Parties non sélectionnées)
    GHOST: theme.palette.text.disabled || "#ccc", // Pointillés (Segments cachés)
  },
  OPACITIES: {
    FILL_DEFAULT: 0.8,

    // C'est ici qu'on règle la visibilité du reste de l'annotation quand une part est sélectionnée
    FILL_CONTEXT: 0.4, // Augmenté pour meilleure visibilité (était 0.1)
    STROKE_CONTEXT: 0.3, // Opacité des traits non sélectionnés

    CUT_SELECTED_FILL: 0.3, // Remplissage bleuté du trou sélectionné
    CUT_HOVER_FILL: 0.4, // Remplissage au survol d'un trou
    CUT_NORMAL_FILL: 0.1, // Remplissage passif d'un trou (pour le hit)

    GHOST_STROKE: 0.8, // Opacité des pointillés
  },
};

function NodePolylineStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  baseMapMeterByPx,
  baseMapImageScale = 1,
  containerK,
  forceHideLabel,
  isTransient,
  selectedPointId,
  selectedPointIds = [],
  selectedPartId,
  selectedPartIds = [],
  highlightConnectedSegments = false,
  selectMode,
  printMode,
  disableVertexEditing = false,
}) {
  // select temp annotation

  if (annotation.id.startsWith("temp")) selected = true;

  // State local pour le survol immédiat (feedback visuel)
  const [hoveredPartId, setHoveredPartId] = useState(null);
  // Only selected annotations show the Shift "+"/"−" part cursor (see
  // getPartCursor) — unselected/transient nodes skip the subscription so a
  // Shift press never re-renders them.
  const isShiftDown = useIsShiftDown(Boolean(selected) && !isTransient);

  // En aperçu transient (drag de vertex), on ignore complètement le hover :
  // sinon les segments clignotent quand le curseur les survole pendant le drag.
  const effectiveHoveredPartId = isTransient ? null : hoveredPartId;

  // Fusion des props et overrides, puis coercion des champs numériques au
  // cas où des valeurs string traîneraient en base (legacy data) — sinon
  // `computedStrokeWidth + 1` deviendrait `"3" + 1 === "31"` au hover.
  const mergedAnnotation = coerceAnnotationNumericFields({
    ...annotation,
    ...annotationOverride,
  });

  // --- PROPS EXTRACTION ---
  let {
    id: annotationId,
    type,
    points = [],
    cuts = [],
    strokeColor,
    closeLine = type === "POLYGON",
    fillColor,
    fillOpacity,
    fillType = "SOLID",
    strokeType = "SOLID",
    strokeOpacity,
    strokeWidth,
    strokeWidthUnit = "PX",
    hiddenSegmentsIdx = [],
    isoHeightSegmentsIdx = [],
    isExtEdgeSegmentsIdx = [],
  } = mergedAnnotation || {};

  if (type === "POLYGON") closeLine = true;

  const labelAnnotation =
    getAnnotationLabelPropsFromAnnotation(mergedAnnotation);
  const showLabel = mergedAnnotation.showLabel;
  //const showLabel = false;

  strokeColor = type === "POLYGON" ? fillColor : strokeColor;

  // --- EXTRUSION PROFILE (offset preview) ---
  // A POLYLINE whose 3D shape is a profile swept along the contour
  // (shape3D.key === "EXTRUSION_PROFILE") gets a thin offset polyline drawn
  // on the extrusion side, in the profile's color, as a 2D hint of the swept
  // footprint. `extrusionOrientation` (±1) chooses the side and mirrors the
  // 3D sweep (see buildExtrudedProfileMesh).
  const isExtrusionProfile =
    type === "POLYLINE" &&
    mergedAnnotation.shape3D?.key === "EXTRUSION_PROFILE";
  const profileTemplateId = isExtrusionProfile
    ? mergedAnnotation.shape3D?.profileTemplateId
    : undefined;
  const profileResolution = useProfileResolution(profileTemplateId);
  const profileColor =
    profileResolution?.primary?.annotation?.strokeColor ??
    profileResolution?.primary?.annotation?.fillColor ??
    strokeColor;
  const extrusionOrientation =
    mergedAnnotation.extrusionOrientation < 0 ? -1 : 1;

  // --- DATA ATTRIBUTES ---
  const dataProps = {
    "data-node-id": annotationId,
    "data-node-entity-id": mergedAnnotation.entityId,
    "data-node-listing-id": mergedAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": type,
  };

  const patternIdRef = useRef(
    `hatching-${Math.random().toString(36).substr(2, 9)}`
  );

  // --- COULEURS CALCULÉES (Mode Standard) ---
  const hoverStrokeColor = useMemo(() => {
    try {
      return darken(strokeColor, 0.2);
    } catch {
      return strokeColor;
    }
  }, [strokeColor]);

  const hoverFillColor = useMemo(() => {
    try {
      return darken(fillColor, 0.2);
    } catch {
      return fillColor;
    }
  }, [fillColor]);

  const displayStrokeColor = hovered ? hoverStrokeColor : strokeColor;
  const displayFillColor = hovered ? hoverFillColor : fillColor;

  // --- CALCUL ÉPAISSEUR TRAIT ---
  const isCmUnit = strokeWidthUnit === "CM" && baseMapMeterByPx > 0;
  // REVOLUTION_AXIS is a screen-space guide: keep a constant 2px stroke at any
  // zoom (vectorEffect="non-scaling-stroke"), even though its listing is a
  // base-map listing (isForBaseMaps) which would otherwise scale the stroke.
  const isForBaseMaps =
    mergedAnnotation.isForBaseMaps && type !== "REVOLUTION_AXIS";
  const scalesWithZoom = isCmUnit || isForBaseMaps;

  const computedStrokeWidth = useMemo(() => {
    if (type === "POLYGON") return 0.5;
    if (isCmUnit) return (strokeWidth * 0.01) / baseMapMeterByPx;
    if (isForBaseMaps) return strokeWidth * (baseMapImageScale || 1);
    // PX mode: raw value, vectorEffect="non-scaling-stroke" keeps it fixed on screen
    return strokeWidth;
  }, [
    strokeWidth,
    strokeWidthUnit,
    baseMapMeterByPx,
    isCmUnit,
    isForBaseMaps,
    baseMapImageScale,
    type,
  ]);

  // Hit-area stroke width for pointer detection — always computed in screen
  // pixels so the trigger distance is zoom-independent.
  // - `scalesWithZoom` (CM / isForBaseMaps): visible stroke grows with zoom,
  //   so hit = visibleScreenPx + padding. The visible width in screen px is
  //   `computedStrokeWidth * --map-zoom * containerK`, hence the CSS calc.
  // - `!scalesWithZoom` (PX): visible stroke is already fixed on screen via
  //   `vectorEffect="non-scaling-stroke"`, so a fixed padding is enough.
  //   Adding `computedStrokeWidth` here would make thick PX strokes trigger
  //   hover way too far from the visible line.
  const hitStrokeWidthCss = useMemo(() => {
    if (scalesWithZoom) {
      const k = containerK || 1;
      return `calc((${computedStrokeWidth} * var(--map-zoom, 1) * ${k} + ${HIT_STROKE_PADDING_SCREEN_PX}) * 1px)`;
    }
    return `${HIT_STROKE_PADDING_SCREEN_PX}px`;
  }, [computedStrokeWidth, scalesWithZoom, containerK]);

  // --- HELPERS ID & STYLE ---

  const getPartId = (category, index = 0) =>
    `${annotationId}::${category}::${index}`;

  const SEGMENT_HOVER_COLOR = "#76ff03"; // neon green

  const hasAnyPartSelection =
    Boolean(selectedPartId) ||
    (Array.isArray(selectedPartIds) && selectedPartIds.length > 0);
  const isPartSelected = (currentPartId) =>
    selectedPartId === currentPartId ||
    (Array.isArray(selectedPartIds) && selectedPartIds.includes(currentPartId));

  // Cursor for a clickable part hit-area. When Shift is held *and the
  // annotation is already selected*, signal whether a click will add ("+")
  // or remove ("-") that part from the segment multi-selection. On an
  // unselected annotation, Shift means annotation-level multi-select, so
  // keep the plain pointer.
  const getPartCursor = (currentPartId) => {
    if (isTransient) return "crosshair";
    if (!isShiftDown || !selected) return "pointer";
    return isPartSelected(currentPartId) ? CURSOR_REMOVE : CURSOR_ADD;
  };

  const getPartStyle = (currentPartId) => {
    // A0. Segment selection mode — highlight hovered segment in neon green
    if (
      selectMode === "SEGMENT" &&
      effectiveHoveredPartId === currentPartId &&
      !isTransient
    ) {
      return {
        stroke: SEGMENT_HOVER_COLOR,
        fill: SEGMENT_HOVER_COLOR,
        strokeWidth: computedStrokeWidth + 2,
      };
    }

    // A. Mode Standard (Pas de sous-sélection)
    if (!hasAnyPartSelection) {
      if (effectiveHoveredPartId === currentPartId && !isTransient) {
        return {
          stroke: hoverStrokeColor,
          fill: hoverFillColor,
          strokeWidth: computedStrokeWidth + 1,
        };
      }
      return {
        stroke: strokeColor,
        fill: fillColor,
        strokeWidth: computedStrokeWidth,
      };
    }

    // B. Mode Sous-Sélection
    const isSelected = isPartSelected(currentPartId);
    const isHovered = effectiveHoveredPartId === currentPartId;

    if (isSelected) {
      // Selected segments use a fixed-screen-px stroke (3 px, scaling
      // override) — otherwise polygon/polyline default strokes (often
      // 0.5 px or CM-scaled) make the selection hard to see at most
      // zoom levels.
      const SELECTED_STROKE_PX = 3;
      // Hover on a selected part: darken + thicken so the user gets
      // visual feedback (otherwise it blends in with its peers).
      if (isHovered && !isTransient) {
        let hoverSelectedColor = STYLE_CONSTANTS.COLORS.SELECTED_PART;
        try {
          hoverSelectedColor = darken(
            STYLE_CONSTANTS.COLORS.SELECTED_PART,
            0.25
          );
        } catch (e) {
          /* keep base color */
        }
        return {
          stroke: hoverSelectedColor,
          fill: hoverSelectedColor,
          strokeWidth: SELECTED_STROKE_PX,
          forceNonScaling: true,
        };
      }
      return {
        stroke: STYLE_CONSTANTS.COLORS.SELECTED_PART,
        fill: STYLE_CONSTANTS.COLORS.SELECTED_PART,
        strokeWidth: SELECTED_STROKE_PX,
        forceNonScaling: true,
      };
    } else if (isHovered) {
      return {
        stroke: darken(STYLE_CONSTANTS.COLORS.CONTEXT, 0.4),
        fill: darken(STYLE_CONSTANTS.COLORS.CONTEXT, 0.4),
        strokeWidth: computedStrokeWidth + 0,
      };
    } else {
      // Contexte (Parties non sélectionnées)
      return {
        stroke: STYLE_CONSTANTS.COLORS.CONTEXT,
        fill: STYLE_CONSTANTS.COLORS.CONTEXT,
        strokeWidth: computedStrokeWidth,
        strokeOpacity: STYLE_CONSTANTS.OPACITIES.STROKE_CONTEXT,
        fillOpacity: STYLE_CONSTANTS.OPACITIES.FILL_CONTEXT, // <--- C'est ici que l'opacité est gérée
      };
    }
  };

  // --- GÉOMÉTRIE (Path Building) ---

  const typeOf = (p) => (p?.type === "circle" ? "circle" : "square");

  function circleFromThreePoints(p0, p1, p2) {
    const x1 = p0.x,
      y1 = p0.y;
    const x2 = p1.x,
      y2 = p1.y;
    const x3 = p2.x,
      y3 = p2.y;
    const d = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    if (Math.abs(d) < 1e-9) return null;
    const ux =
      (x1 * x1 + y1 * y1) * (y2 - y3) +
      (x2 * x2 + y2 * y2) * (y3 - y1) +
      (x3 * x3 + y3 * y3) * (y1 - y2);
    const uy =
      (x1 * x1 + y1 * y1) * (x3 - x2) +
      (x2 * x2 + y2 * y2) * (x1 - x3) +
      (x3 * x3 + y3 * y3) * (x2 - x1);
    const cx = ux / d;
    const cy = uy / d;
    return { center: { x: cx, y: cy }, r: Math.hypot(x1 - cx, y1 - cy) };
  }

  function buildPathAndMap(absPoints, close) {
    const res = { d: "", segmentMap: [] };
    // Render guard: drop points that didn't resolve to finite pixel
    // coordinates. This happens when an annotation references a point whose
    // db.points record is missing (orphaned ref) — resolvePoints then leaves
    // the ref without x/y, and the "d" string would become "L undefined
    // undefined", which React/SVG rejects. The aggregate count of affected
    // annotations is logged once in useAnnotationsV2.
    const pts = absPoints?.filter(
      (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    );
    if (!pts?.length) return res;

    const types = pts.map(typeOf);
    const n = pts.length;
    const dParts = [`M ${pts[0].x} ${pts[0].y}`];

    if (n === 1) {
      res.d = dParts.join(" ");
      return res;
    }

    const idx = (i) => (close ? (i + n) % n : i);
    const limit = close ? n : n - 1;

    let i = 0;
    let iterations = 0;
    const MAX_ITERATIONS = n * 2; // Garde-fou de sécurité

    try {
      while (i < limit && iterations < MAX_ITERATIONS) {
        iterations++;
        const i0 = idx(i);
        const i1 = idx(i + 1);
        const t0 = types[i0];
        const t1 = types[i1];
        const pStart = pts[i0];

        // EDGE CASE : Si on commence par un cercle ou qu'on a des cercles consécutifs
        // qui ne rentrent pas dans le schéma S-C-S (Square-Circle-Square)
        if (t0 === "square" && t1 === "circle") {
          let j = i + 1;
          // On cherche la fin de la chaîne de cercles
          while (j < i + n && types[idx(j)] === "circle") {
            j += 1;
            if (j - i > n) break; // Sécurité supplémentaire
          }
          const i2 = idx(j);

          // Cas non-fermé : si on finit par des cercles, on trace des lignes droites
          if (!close && j >= n) {
            const P1 = pts[i1];
            const cmd = `L ${P1.x} ${P1.y}`;
            dParts.push(cmd);
            res.segmentMap.push({
              startPointIdx: i0,
              endPointIdx: i1,
              d: `M ${pStart.x} ${pStart.y} ${cmd}`,
            });
            i += 1;
            continue;
          }

          // Cas EXACT Square-Circle-Square (Arc de cercle parfait)
          const isExactSCS =
            j === i + 2 &&
            types[i1] === "circle" &&
            types[idx(i + 2)] === "square";

          if (isExactSCS) {
            const P0 = pts[i0];
            const P1 = pts[i1];
            const P2 = pts[i2];
            const circ = circleFromThreePoints(P0, P1, P2);

            if (
              !circ ||
              !Number.isFinite(circ.r) ||
              circ.r <= 0 ||
              circ.r > 100000
            ) {
              // Fallback en lignes si le cercle est invalide ou quasi plat
              const cmd1 = `L ${P1.x} ${P1.y}`;
              const cmd2 = `L ${P2.x} ${P2.y}`;
              dParts.push(cmd1, cmd2);
              res.segmentMap.push({
                startPointIdx: i0,
                endPointIdx: i1,
                d: `M ${P0.x} ${P0.y} ${cmd1}`,
              });
              res.segmentMap.push({
                startPointIdx: i1,
                endPointIdx: i2,
                d: `M ${P1.x} ${P1.y} ${cmd2}`,
              });
            } else {
              const { center: C, r } = circ;

              // Calcul du produit vectoriel pour déterminer le sens (0 ou 1)
              const cross =
                (P1.x - P0.x) * (P2.y - P0.y) - (P1.y - P0.y) * (P2.x - P0.x);
              const sweep = cross > 0 ? 1 : 0;

              // Important : Pour un arc passant par 3 points, le flag "large-arc"
              // doit être géré si l'angle total dépasse 180°.
              // Ici, on dessine deux demi-arcs pour une précision parfaite.
              const cmd1 = `A ${r} ${r} 0 0 ${sweep} ${P1.x} ${P1.y}`;
              const cmd2 = `A ${r} ${r} 0 0 ${sweep} ${P2.x} ${P2.y}`;

              dParts.push(cmd1, cmd2);

              res.segmentMap.push({
                startPointIdx: i0,
                endPointIdx: i1,
                isArc: true,
                d: `M ${P0.x} ${P0.y} ${cmd1}`,
              });
              res.segmentMap.push({
                startPointIdx: i1,
                endPointIdx: i2,
                isArc: true,
                d: `M ${P1.x} ${P1.y} ${cmd2}`,
              });
            }
            i += 2;
            continue;
          }

          // Cas Multi-Circles ou Complexe : On utilise des courbes de Bézier (C)
          let k = i;
          while (k < j && k < limit) {
            const curr = idx(k);
            const next = idx(k + 1);
            const p0 = pts[curr];
            const p1 = pts[next];
            // Approximation simple pour ne pas bloquer
            const cp1 = {
              x: p0.x + (p1.x - p0.x) / 3,
              y: p0.y + (p1.y - p0.y) / 3,
            };
            const cp2 = {
              x: p1.x - (p1.x - p0.x) / 3,
              y: p1.y - (p1.y - p0.y) / 3,
            };
            const cmd = `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${p1.x} ${p1.y}`;
            dParts.push(cmd);
            res.segmentMap.push({
              startPointIdx: curr,
              endPointIdx: next,
              d: `M ${p0.x} ${p0.y} ${cmd}`,
            });
            k++;
          }
          i = j;
          continue;
        }

        // Cas par défaut : Ligne droite (Square to Square ou Circle isolé au début)
        const P1 = pts[i1];
        const cmd = `L ${P1.x} ${P1.y}`;
        dParts.push(cmd);
        res.segmentMap.push({
          startPointIdx: i0,
          endPointIdx: i1,
          d: `M ${pts[i0].x} ${pts[i0].y} ${cmd}`,
        });
        i++;
      }
    } catch (e) {
      console.error("Geometry Error: Infinite loop prevented", e);
    }

    if (close && dParts.length > 0) dParts.push("Z");
    res.d = dParts.join(" ");
    return res;
  }

  const { d: pathD, segmentMap } = useMemo(
    () => buildPathAndMap(points, closeLine),
    [points, closeLine]
  );

  const holesData = useMemo(() => {
    if (!cuts || cuts.length === 0) return [];
    return cuts.map((cut, index) => ({
      ...buildPathAndMap(cut.points, true),
      id: cut.id,
      partId: getPartId("CUT", index),
      hiddenSegmentsIdx: cut.hiddenSegmentsIdx ?? [],
    }));
  }, [cuts, annotationId]);

  const getCutSegPartId = (cutIdx, segIdx) =>
    `${annotationId}::CUT_SEG::${cutIdx}::${segIdx}`;

  // Strip the leading "M x y" from a segment's `d` string so it can be
  // appended to an already-started path (for building continuous runs).
  // Segments in `segmentMap` always start with "M x y <cmd>".
  const stripLeadingMove = (d) => {
    const m = d.match(/^M\s+\S+\s+\S+\s+(.*)$/);
    return m ? m[1] : d;
  };

  const fullFillD = useMemo(() => {
    let d = pathD;
    if (holesData.length > 0) d += " " + holesData.map((h) => h.d).join(" ");
    return d;
  }, [pathD, holesData]);

  // --- RENDU SEGMENTS (Strokes) ---

  // Build the partId for a given segment inside the current render call.
  // - POLYLINE: per-segment (existing)
  // - POLYGON main: per-segment (`SEG::idx`)
  // - POLYGON cut: per-segment (`CUT_SEG::cutIdx::segIdx`)
  // - Fallback (legacy): whole-part id `basePartType::contextIndex`.
  const getSegmentPartId = (basePartType, contextIndex, idx) => {
    if (type === "POLYLINE") return getPartId("SEG", idx);
    if (type === "POLYGON" && basePartType === "MAIN")
      return getPartId("SEG", idx);
    if (type === "POLYGON" && basePartType === "CUT")
      return getCutSegPartId(contextIndex, idx);
    return getPartId(basePartType, contextIndex);
  };

  const renderSegments = (segmentsList, basePartType, contextIndex = 0) => {
    // For POLYGON, per-segment hit-areas only render when the annotation
    // itself is selected — outside selection, clicks pass through to the
    // fill (which selects the whole polygon / whole cut).
    if (type === "POLYGON" && !selected) return null;

    const isMainPath = segmentsList === segmentMap;
    const hiddenList = isMainPath
      ? (hiddenSegmentsIdx ?? [])
      : (cuts[contextIndex]?.hiddenSegmentsIdx ?? []);
    const isoList = isMainPath
      ? (isoHeightSegmentsIdx ?? [])
      : (cuts[contextIndex]?.isoHeightSegmentsIdx ?? []);

    const useFixedPolygonHit = type === "POLYGON";

    return segmentsList.map((seg, idx) => {
      const partId = getSegmentPartId(basePartType, contextIndex, idx);
      // "SEG" / "CUT_SEG" — exposed so the generic part-click handler
      // sets selectedItem.partType (mirrors the explicit VERTEX path).
      const segPartType = partId.split("::")[1];
      const style = getPartStyle(partId);
      const isSelectedSeg = isPartSelected(partId);
      const isHoveredSeg = effectiveHoveredPartId === partId;

      // Hit area — transparent stroke that captures pointer events.
      const hitAreaPath = useFixedPolygonHit ? (
        <path
          d={seg.d}
          fill="none"
          stroke="transparent"
          strokeWidth={POLYGON_HIT_STROKE_WIDTH_PX}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <path
          d={seg.d}
          fill="none"
          stroke="transparent"
          style={{ strokeWidth: hitStrokeWidthCss }}
          vectorEffect="non-scaling-stroke"
        />
      );

      // --- Ghost (hidden) segment ---
      const isHidden = hiddenList.includes(idx);

      if (isHidden) {
        if (!selected) return null;

        const ghostColor =
          isSelectedSeg || isHoveredSeg
            ? style.stroke
            : STYLE_CONSTANTS.COLORS.GHOST;

        const ghostStrokeWidth = type === "POLYGON" ? 2 : computedStrokeWidth;

        return (
          <g
            key={`seg-hidden-${basePartType}-${contextIndex}-${idx}`}
            onMouseEnter={(e) => {
              e.stopPropagation();
              if (!isTransient) setHoveredPartId(partId);
            }}
            onMouseLeave={() => setHoveredPartId(null)}
            data-part-id={partId}
            data-part-type={segPartType}
            data-node-id={annotationId}
            style={{ cursor: getPartCursor(partId) }}
          >
            {hitAreaPath}
            <path
              d={seg.d}
              fill="none"
              stroke={ghostColor}
              strokeWidth={ghostStrokeWidth}
              strokeDasharray="4 12"
              strokeOpacity={STYLE_CONSTANTS.OPACITIES.GHOST_STROKE}
              strokeLinecap="round"
              vectorEffect={
                type === "POLYGON" || !scalesWithZoom
                  ? "non-scaling-stroke"
                  : undefined
              }
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      }

      // --- Normal segment ---
      // For POLYLINE, visible strokes come from renderContinuousStrokes.
      // For POLYGON we add a thin visible overlay on hover / selected so
      // the user gets feedback even when strokeType is NONE or the
      // visible stroke is the default 0.5 px.
      const showPolygonOverlay =
        type === "POLYGON" && (isSelectedSeg || isHoveredSeg);

      // isoHeight (contour line) segments are drawn in red while the
      // annotation is selected so the user can see which edge keeps a
      // constant height when the face is reshaped as a ramp in 3D.
      const isIsoSeg = selected && isoList.includes(idx);

      return (
        <g
          key={`seg-${basePartType}-${contextIndex}-${idx}-${seg.startPointIdx}`}
          onMouseEnter={(e) => {
            e.stopPropagation();
            if (!isTransient) setHoveredPartId(partId);
          }}
          onMouseLeave={() => setHoveredPartId(null)}
          data-part-id={partId}
          data-part-type={segPartType}
          data-node-id={annotationId}
          style={{ cursor: getPartCursor(partId) }}
        >
          {hitAreaPath}
          {isIsoSeg && (
            <path
              d={seg.d}
              fill="none"
              stroke="#d32f2f"
              strokeWidth={3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          )}
          {showPolygonOverlay && (
            <path
              d={seg.d}
              fill="none"
              stroke={style.stroke || hoverStrokeColor}
              strokeWidth={style.strokeWidth || 3}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
          )}
        </g>
      );
    });
  };

  // --- RENDU CONTINUOUS STROKES (Visual) ---
  //
  // Groups consecutive non-hidden segments sharing the same style into
  // continuous SVG sub-paths so that:
  //   - polyline extremities get flat `butt` caps (net/sharp ends)
  //   - interior junctions are smooth via `strokeLinejoin="round"`
  //     (S-C-S arc patterns are already continuous by construction)
  // A run is only broken when a segment is hidden, or when per-segment
  // styling differs (e.g. hover/selection/CUT highlight).
  const renderContinuousStrokes = (
    segmentsList,
    isClosed,
    basePartType,
    contextIndex = 0
  ) => {
    if (!segmentsList || segmentsList.length === 0) return null;
    if (strokeType === "NONE") return null;

    const isMainPath = segmentsList === segmentMap;
    const hiddenList = isMainPath
      ? (hiddenSegmentsIdx ?? [])
      : (cuts[contextIndex]?.hiddenSegmentsIdx ?? []);

    // If the whole cut (not a single segment) is selected, every segment
    // in that cut gets the blue highlight — mirrors legacy behavior.
    const wholeCutSelected =
      basePartType === "CUT" &&
      selectedPartId === getPartId("CUT", contextIndex);

    // Per-segment metadata (partId, style, hidden flag)
    const segMeta = segmentsList.map((seg, idx) => {
      const partId = getSegmentPartId(basePartType, contextIndex, idx);
      const style = getPartStyle(partId);
      const finalStrokeOpacity = style.strokeOpacity ?? strokeOpacity;
      let displayColor = wholeCutSelected
        ? STYLE_CONSTANTS.COLORS.CUT_SELECTED
        : style.stroke;
      const segStrokeWidth = style.strokeWidth ?? computedStrokeWidth;
      const forceNonScaling = !!style.forceNonScaling;
      const isHidden = hiddenList.includes(idx);
      return {
        seg,
        displayColor,
        strokeOpacity: finalStrokeOpacity,
        strokeWidth: segStrokeWidth,
        forceNonScaling,
        isHidden,
      };
    });

    const total = segmentsList.length;
    const runs = [];
    let current = null;
    const flush = () => {
      if (current) {
        runs.push(current);
        current = null;
      }
    };

    for (let idx = 0; idx < total; idx++) {
      const m = segMeta[idx];

      if (m.isHidden) {
        flush();
        continue;
      }

      if (!current) {
        current = {
          dParts: [m.seg.d],
          displayColor: m.displayColor,
          strokeOpacity: m.strokeOpacity,
          strokeWidth: m.strokeWidth,
          forceNonScaling: m.forceNonScaling,
          firstSegIdx: idx,
          count: 1,
        };
        continue;
      }

      const styleMatches =
        m.displayColor === current.displayColor &&
        m.strokeOpacity === current.strokeOpacity &&
        m.strokeWidth === current.strokeWidth &&
        m.forceNonScaling === current.forceNonScaling;

      if (styleMatches) {
        current.dParts.push(stripLeadingMove(m.seg.d));
        current.count += 1;
      } else {
        flush();
        current = {
          dParts: [m.seg.d],
          displayColor: m.displayColor,
          strokeOpacity: m.strokeOpacity,
          strokeWidth: m.strokeWidth,
          forceNonScaling: m.forceNonScaling,
          firstSegIdx: idx,
          count: 1,
        };
      }
    }
    flush();

    // Closed polygon whose single run covers every segment: append `Z` so
    // the wrap-around join is also smooth via strokeLinejoin.
    if (isClosed && runs.length === 1 && runs[0].count === total) {
      runs[0].dParts.push("Z");
    }

    const isDashed = strokeType === "DASHED";

    return runs.map((run, rIdx) => {
      const d = run.dParts.join(" ");
      return (
        <path
          key={`run-${basePartType}-${contextIndex}-${rIdx}-${run.firstSegIdx}`}
          d={d}
          fill="none"
          stroke={run.displayColor}
          strokeWidth={run.strokeWidth ?? computedStrokeWidth}
          strokeOpacity={run.strokeOpacity}
          strokeLinecap={isDashed ? "bevel" : "butt"}
          strokeLinejoin={isDashed ? "bevel" : "round"}
          vectorEffect={
            run.forceNonScaling || !scalesWithZoom
              ? "non-scaling-stroke"
              : undefined
          }
          style={{ pointerEvents: "none", transition: "stroke 0.2s" }}
          {...(isDashed && { strokeDasharray: "1 1" })}
        />
      );
    });
  };

  // --- RENDU INDICATEURS GHOST (Image D) ---
  //
  // When a polygon is NOT in nested selection mode but has at least one
  // hidden segment on the main contour or a cut, render a thin white dashed
  // line offset slightly toward the polygon fill for each hidden straight
  // segment. Arcs are skipped in v1 — the helper returns null for them.
  const renderGhostOffsetIndicators = () => {
    if (type !== "POLYGON") return null;
    if (selected) return null;
    // Editor helper only — suppress in deliverables (portfolio viewer + PDF/print exports).
    if (printMode) return null;

    const hasMainGhost = (hiddenSegmentsIdx ?? []).length > 0;
    const hasCutGhost = (cuts || []).some(
      (c) => (c.hiddenSegmentsIdx ?? []).length > 0
    );
    if (!hasMainGhost && !hasCutGhost) return null;

    const k = containerK || 1;
    // Screen-space offset = stroke thickness, so the white indicator sits
    // just next to the edge. Adapted to zoom via --map-zoom so it stays
    // constant on screen without React re-renders.
    const STROKE_PX = 2;
    const OFFSET_PX = STROKE_PX;

    const makeIndicator = (key, offset) => {
      const tx = `calc(${offset.nx} * ${OFFSET_PX}px / (var(--map-zoom, 1) * ${k}))`;
      const ty = `calc(${offset.ny} * ${OFFSET_PX}px / (var(--map-zoom, 1) * ${k}))`;
      return (
        <g
          key={key}
          style={{
            transform: `translate(${tx}, ${ty})`,
            pointerEvents: "none",
          }}
        >
          <path
            d={offset.d}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={STROKE_PX}
            strokeDasharray="2 2"
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      );
    };

    const indicators = [];

    if (hasMainGhost) {
      (hiddenSegmentsIdx ?? []).forEach((idx) => {
        const seg = segmentMap[idx];
        if (!seg) return;
        const offset = getInnerOffsetSegmentPath({
          seg,
          contourPoints: points,
          isCut: false,
        });
        if (!offset) return;
        indicators.push(makeIndicator(`ghost-ind-main-${idx}`, offset));
      });
    }

    (cuts || []).forEach((cut, cutIdx) => {
      const hiddenIdxs = cut.hiddenSegmentsIdx ?? [];
      if (hiddenIdxs.length === 0) return;
      const hole = holesData[cutIdx];
      if (!hole?.segmentMap) return;
      hiddenIdxs.forEach((idx) => {
        const seg = hole.segmentMap[idx];
        if (!seg) return;
        const offset = getInnerOffsetSegmentPath({
          seg,
          contourPoints: cut.points,
          isCut: true,
        });
        if (!offset) return;
        indicators.push(
          makeIndicator(`ghost-ind-cut-${cutIdx}-${idx}`, offset)
        );
      });
    });

    return indicators;
  };

  // --- RENDU EXT EDGES (Segment extérieur) ---
  //
  // Segments flagged `isExtEdge` are drawn with a fluo-blue solid stroke
  // directly on the edge. Unlike the isoHeight overlay (selected-only), these
  // stay visible regardless of selection so the user can always see which
  // edges feed the auto-drawing algorithms. Suppressed in print/portfolio.
  const renderExtEdges = () => {
    if (printMode) return null;

    const hasMainExt = (isExtEdgeSegmentsIdx ?? []).length > 0;
    const hasCutExt = (cuts || []).some(
      (c) => (c.isExtEdgeSegmentsIdx ?? []).length > 0
    );
    if (!hasMainExt && !hasCutExt) return null;

    const makeEdge = (key, seg) => (
      <path
        key={key}
        d={seg.d}
        fill="none"
        stroke="#00e5ff"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        style={{ pointerEvents: "none" }}
      />
    );

    const edges = [];

    (isExtEdgeSegmentsIdx ?? []).forEach((idx) => {
      const seg = segmentMap[idx];
      if (!seg) return;
      edges.push(makeEdge(`ext-edge-main-${idx}`, seg));
    });

    (cuts || []).forEach((cut, cutIdx) => {
      const extIdxs = cut.isExtEdgeSegmentsIdx ?? [];
      if (extIdxs.length === 0) return;
      const hole = holesData[cutIdx];
      if (!hole?.segmentMap) return;
      extIdxs.forEach((idx) => {
        const seg = hole.segmentMap[idx];
        if (!seg) return;
        edges.push(makeEdge(`ext-edge-cut-${cutIdx}-${idx}`, seg));
      });
    });

    return edges;
  };

  // --- RENDU IS_EXT INDICATOR (guide "Extérieur") ---
  //
  // Polylines and polygons flagged isExt (exterior-side guides for the
  // auto-drawing algorithms) get a dashed 1px line drawn along the MAIN
  // centerline / outer contour, non-scaling, in the same fluo-cyan as the
  // per-segment "Segment extérieur" markers — visible over the band or fill
  // whatever their color and opacity. Pure visual indicator: never captures
  // pointer events. Suppressed in print.
  const renderIsExtIndicator = () => {
    if (!mergedAnnotation.isExt || printMode) return null;
    if ((type !== "POLYLINE" && type !== "POLYGON") || !pathD) return null;

    return (
      <path
        d={pathD}
        fill="none"
        stroke="#00e5ff"
        strokeWidth={1}
        strokeOpacity={1}
        strokeDasharray="4 4"
        strokeLinecap="butt"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />
    );
  };

  // --- RENDU CONNECTED SEGMENTS (Highlight temporaire) ---
  const renderConnectedSegments = () => {
    if (!selectedPointId || !highlightConnectedSegments) return null;

    const allPaths = [
      { points: mergedAnnotation.points, map: segmentMap },
      ...holesData.map((h) => ({
        points: h.points || cuts.find((c) => c.id === h.id)?.points,
        map: h.segmentMap,
      })),
    ];

    const segmentsToDraw = [];
    allPaths.forEach(({ points, map }) => {
      if (!points || !map) return;
      map.forEach((seg) => {
        const pStart = points[seg.startPointIdx];
        const pEnd = points[seg.endPointIdx];
        const isConnected =
          pStart?.id === selectedPointId || pEnd?.id === selectedPointId;
        if (isConnected) {
          segmentsToDraw.push(
            <path
              key={`highlight-${seg.d}`}
              d={seg.d}
              fill="none"
              stroke={theme.palette.annotation.selected}
              strokeWidth={(computedStrokeWidth || 2) + 2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "none" }}
            />
          );
        }
      });
    });
    return segmentsToDraw;
  };

  // --- RENDU OFFSET EXTRUSION (preview de l'emprise du profil) ---
  //
  // Thin offset polyline drawn on the extrusion side, in the profile color,
  // as a 2D hint of the swept footprint. The contour points are offset along
  // their right-of-tangent normal (flipped by `extrusionOrientation`) while
  // preserving their `type`, then fed to the SAME arc-aware path builder as
  // the main contour — so curved (S-C-S) points stay curved instead of being
  // approximated by straight segments. The offset is in image space (scales
  // with zoom); `non-scaling-stroke` keeps the line width constant on screen.
  // Rendered UNDER the main strokes so it never blocks selection / editing.
  const EXTRUSION_OFFSET_PX = 12;
  const EXTRUSION_STROKE_PX = 4;

  const renderExtrusionOffset = () => {
    if (!isExtrusionProfile || printMode) return null;
    if (!points || points.length < 2) return null;

    const distance = EXTRUSION_OFFSET_PX * extrusionOrientation;
    const offsetPts = offsetPointsAlongNormals(points, distance, closeLine);
    const { d } = buildPathAndMap(offsetPts, closeLine);
    if (!d) return null;

    return (
      <path
        d={d}
        fill="none"
        stroke={profileColor}
        strokeWidth={EXTRUSION_STROKE_PX}
        strokeOpacity={0.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ pointerEvents: "none" }}
      />
    );
  };

  // --- RENDU POINTS (VERTEX) ---

  // User-tunable vertex handle size (2D editor settings popover).
  const vertexSizeMultiplier =
    useSelector((s) => s.mapEditor.vertexSizeMultiplier) || 1;
  const POINT_SIZE = 6 * vertexSizeMultiplier;
  const HALF_SIZE = POINT_SIZE / 2;
  const vertexScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // --- SLOPE INDICATOR (POLYGON with per-vertex offsetTop) ---
  // Computes the best-fit plane direction over the polygon vertices; null
  // when the surface is flat, has too few points, or the toggle is off.
  const slope = useMemo(() => {
    if (type !== "POLYGON") return null;
    if (mergedAnnotation.hideSlope) return null;
    return getPolygonSlope({ points, meterByPx: baseMapMeterByPx });
  }, [type, mergedAnnotation.hideSlope, points, baseMapMeterByPx]);

  const slopeCentroid = useMemo(() => {
    if (!slope || !points || points.length === 0) return null;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const p of points) {
      if (!p || typeof p.x !== "number" || typeof p.y !== "number") continue;
      if (p.isSliding) continue;
      sx += p.x;
      sy += p.y;
      n += 1;
    }
    if (n === 0) return null;
    return { x: sx / n, y: sy / n };
  }, [slope, points]);

  // guideLines (ordered ramp-axis sequence): per-line arc-expanded pixel
  // polyline + slope-arrow geometry. Each line carries an indexed partId so
  // it can be selected / edited independently, and shows its own slope.
  const guideLinesData = useMemo(() => {
    if (type !== "POLYGON") return [];
    const gls = mergedAnnotation.guideLines;
    if (!Array.isArray(gls)) return [];
    return gls
      .map((g, index) => {
        const pts = Array.isArray(g?.points) ? g.points : [];
        const polyline = expandArcsInPath(pts, 16, false)
          .filter((p) => typeof p?.x === "number" && typeof p?.y === "number")
          .map((p) => ({ x: p.x, y: p.y }));
        if (polyline.length < 2) return null;

        // Cumulative arc length along the (arc-expanded) line.
        const cum = [0];
        for (let i = 0; i < polyline.length - 1; i++) {
          cum.push(
            cum[i] +
              Math.hypot(
                polyline[i + 1].x - polyline[i].x,
                polyline[i + 1].y - polyline[i].y
              )
          );
        }
        const L2D = cum[cum.length - 1];
        if (!Number.isFinite(L2D) || L2D < 1e-6) return null;

        // Point on the polyline at a given arc length.
        const at = (s) => {
          const t = Math.max(0, Math.min(L2D, s));
          let i = 0;
          while (i < cum.length - 2 && cum[i + 1] < t) i++;
          const seg = cum[i + 1] - cum[i] || 1;
          const f = (t - cum[i]) / seg;
          return {
            x: polyline[i].x + (polyline[i + 1].x - polyline[i].x) * f,
            y: polyline[i].y + (polyline[i + 1].y - polyline[i].y) * f,
          };
        };

        // Central window = arrow shaft (follows the curve).
        let shaft = [at(L2D * 0.3)];
        for (let i = 0; i < cum.length; i++) {
          if (cum[i] > L2D * 0.3 && cum[i] < L2D * 0.7) shaft.push(polyline[i]);
        }
        shaft.push(at(L2D * 0.7));

        // Uphill = increasing arc-length (height rises along the line in
        // drawing order). Reverse the arrow for a negative slope.
        const slopePct = Number(g?.slopePct) || 0;
        if (slopePct < 0) shaft = shaft.slice().reverse();
        const head = shaft[shaft.length - 1];
        const prev = shaft[shaft.length - 2] || shaft[0];
        const angleDeg =
          (Math.atan2(head.y - prev.y, head.x - prev.x) * 180) / Math.PI;

        return {
          index,
          partId: `${annotationId}::GUIDE_LINE::${index}`,
          polyline,
          slopePct,
          shaft,
          head,
          angleDeg,
          mid: at(L2D / 2),
        };
      })
      .filter(Boolean);
  }, [type, mergedAnnotation.guideLines, annotationId]);

  // Counter-scale for patterns (hatching, eraser) to keep fixed size on screen in PX mode
  const patternTransformStyle = useMemo(() => {
    if (scalesWithZoom) return undefined;
    const k = containerK || 1;
    return { transform: `scale(calc(1 / (var(--map-zoom, 1) * ${k})))` };
  }, [containerK, scalesWithZoom]);

  const renderVertex = (pt, cutIndex, source) => {
    const isPointSelected =
      selectedPointId === pt.id || selectedPointIds.includes(pt.id);
    const isCircle = pt.type === "circle";
    const isCut = cutIndex !== undefined && cutIndex !== null;
    const isInner = source === "INNER";
    const isSliding = !!pt.isSliding;
    const isBasePoint = !!pt.isBasePoint;
    const isGuide = source === "GUIDE";
    const keyPrefix = isGuide
      ? "guide"
      : isInner
        ? "inner"
        : isCut
          ? `cut-${cutIndex}`
          : "main";
    // Dashed stroke for sliding vertices: the handle is still visible but
    // visually flagged as "derived" — its position is recomputed at each
    // commit rather than user-controlled.
    const strokeDasharray = isSliding ? "3,2" : undefined;

    return (
      <g
        key={`${keyPrefix}-${pt.id}`}
        transform={`translate(${pt.x}, ${pt.y})`}
        style={{
          cursor: isTransient ? "crosshair" : "pointer",
          pointerEvents: "all",
        }}
        data-node-type="VERTEX"
        data-point-id={pt.id}
        data-annotation-id={annotationId}
        {...(isCut ? { "data-cut-index": cutIndex } : {})}
        {...(isInner ? { "data-inner": "1" } : {})}
        {...(isGuide ? { "data-guide": "1" } : {})}
      >
        <g style={{ transform: vertexScaleTransform }}>
          {isBasePoint && (
            <circle
              cx={0}
              cy={0}
              r={HALF_SIZE + 3}
              fill="none"
              stroke={strokeColor}
              strokeWidth={2}
            />
          )}
          {isCircle ? (
            <circle
              cx={0}
              cy={0}
              r={HALF_SIZE}
              fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
              stroke="#2196f3"
              strokeWidth={1.5}
              strokeDasharray={strokeDasharray}
            />
          ) : (
            <rect
              x={-HALF_SIZE}
              y={-HALF_SIZE}
              width={POINT_SIZE}
              height={POINT_SIZE}
              fill={isPointSelected ? "#FF0000" : "#FFFFFF"}
              stroke="#2196f3"
              strokeWidth={1.5}
              strokeDasharray={strokeDasharray}
            />
          )}
        </g>
      </g>
    );
  };

  // --- FILTRAGE DES POINTS À AFFICHER ---
  // Each entry is { point, cutIndex, source } where:
  //   - cutIndex is undefined for the outer contour and inner points,
  //     and an index into mergedAnnotation.cuts for hole points.
  //   - source is "INNER" for points coming from mergedAnnotation.innerPoints
  //     (Steiner points dropped via the ADD_INNER_POINT tool), undefined
  //     otherwise.
  // The cutIndex/source flow into renderVertex so the SVG vertex carries
  // data-cut-index / data-inner, allowing InteractionLayer and
  // PanelPropertiesPoints to address points across all rings.
  const allPointEntries = [
    ...(mergedAnnotation.points || []).map((p) => ({
      point: p,
      cutIndex: undefined,
      source: undefined,
    })),
    ...(mergedAnnotation.cuts || []).flatMap((c, ci) =>
      (c?.points || []).map((p) => ({
        point: p,
        cutIndex: ci,
        source: undefined,
      }))
    ),
    ...(mergedAnnotation.innerPoints || []).map((p) => ({
      point: p,
      cutIndex: undefined,
      source: "INNER",
    })),
    ...(mergedAnnotation.guideLines || [])
      .flatMap((g) => g?.points || [])
      .map((p) => ({ point: p, cutIndex: undefined, source: "GUIDE" })),
  ];

  let pointEntriesToRender = [];
  // Multi-selection context (lasso, or successive shift+clicks curating
  // points / segments): keep ALL vertices on screen — even when segments are
  // selected — so the user can freely add or remove points by shift+clicking
  // the squares / circles alongside the highlighted segments.
  const hasMultiSelection =
    (selectedPointIds?.length || 0) > 0 || (selectedPartIds?.length || 0) > 0;

  if (hasMultiSelection) {
    pointEntriesToRender = allPointEntries;
  } else if (selectedPartId) {
    const parts = selectedPartId.split("::");
    const partType = parts[1];
    const partIndex = parseInt(parts[2], 10);

    if (partType === "CUT" || partType === "CUT_SEG") {
      pointEntriesToRender = (
        mergedAnnotation.cuts?.[partIndex]?.points || []
      ).map((p) => ({ point: p, cutIndex: partIndex, source: undefined }));
    } else if (partType === "MAIN" || partType === "SEG") {
      pointEntriesToRender = (mergedAnnotation.points || []).map((p) => ({
        point: p,
        cutIndex: undefined,
        source: undefined,
      }));
    }
    // Inner points are always rendered alongside the part-restricted set so
    // the user can still see/select them while a contour part is focused.
    pointEntriesToRender = [
      ...pointEntriesToRender,
      ...(mergedAnnotation.innerPoints || []).map((p) => ({
        point: p,
        cutIndex: undefined,
        source: "INNER",
      })),
      ...(mergedAnnotation.guideLines || [])
        .flatMap((g) => g?.points || [])
        .map((p) => ({ point: p, cutIndex: undefined, source: "GUIDE" })),
    ];
  } else {
    pointEntriesToRender = allPointEntries;
  }

  // Sécurité : inclure le point sélectionné (legacy single selection only)
  if (selectedPointId) {
    const specificEntry = allPointEntries.find(
      (e) => e.point.id === selectedPointId
    );
    if (
      specificEntry &&
      !pointEntriesToRender.find((e) => e.point.id === selectedPointId)
    ) {
      pointEntriesToRender = [...pointEntriesToRender, specificEntry];
    }
  }

  // --- RENDER FINAL ---

  if (!points?.length) return null;

  const showFill = type === "POLYGON";
  const HATCHING_SPACING = 12;

  // --- NOUVEAU : Logique Eraser ---
  const isEraser = mergedAnnotation.isEraser;
  const ERASER_PATTERN_ID = `eraser-${annotationId}`;
  const ERASER_SPACING = 10; // Espacement des tirets

  const mainPartId = getPartId("MAIN", 0);
  const mainFillStyle = getPartStyle(mainPartId);

  // Détermination de la valeur finale de fill (Couleur ou Pattern)
  let finalFill = mainFillStyle?.fill;

  if (isEraser) {
    finalFill = `url(#${ERASER_PATTERN_ID})`;
  } else if (fillType === "HATCHING" || fillType === "HATCHING_LEFT") {
    finalFill = `url(#${patternIdRef.current})`;
  }

  // Hatching lines must follow the same color as a solid fill would:
  // grey when the body is "context" (a segment is sub-selected), hover
  // color on body hover, etc. Otherwise hatching stays its raw color while
  // the FILL variant correctly greys out (mismatch on selection).
  const hatchingStroke = mainFillStyle?.fill ?? fillColor;

  return (
    <g {...dataProps}>
      {/* HATCHING PATTERN */}
      <defs>
        {/* 1. PATTERN ERASER (Petits tirets horizontaux) */}
        {isEraser && (
          <pattern
            id={ERASER_PATTERN_ID}
            patternUnits="userSpaceOnUse"
            width={ERASER_SPACING}
            height={ERASER_SPACING}
            style={patternTransformStyle}
          >
            {/* Petit trait horizontal centré */}
            <line
              x1={2}
              y1={ERASER_SPACING / 2}
              x2={ERASER_SPACING - 2}
              y2={ERASER_SPACING / 2}
              stroke={fillColor}
              strokeWidth={1.5}
              strokeOpacity={0.7}
            />
          </pattern>
        )}

        {/* 2. PATTERN HACHURES (Existant) */}
        {!isEraser &&
          showFill &&
          (fillType === "HATCHING" || fillType === "HATCHING_LEFT") && (
            <pattern
              id={patternIdRef.current}
              patternUnits="userSpaceOnUse"
              width={HATCHING_SPACING}
              height={HATCHING_SPACING}
              style={patternTransformStyle}
            >
              {fillType === "HATCHING" ? (
                <path
                  d={`M 0,${HATCHING_SPACING} L ${HATCHING_SPACING},0`}
                  stroke={hatchingStroke}
                  strokeWidth={2}
                />
              ) : (
                <path
                  d={`M 0,0 L ${HATCHING_SPACING},${HATCHING_SPACING}`}
                  stroke={hatchingStroke}
                  strokeWidth={2}
                />
              )}
            </pattern>
          )}
      </defs>

      {/* MAIN FILL */}
      {showFill && (
        <path
          d={fullFillD}
          fill={finalFill} // Utilise le pattern calculé
          fillOpacity={
            isEraser ? 1 : (mainFillStyle.fillOpacity ?? fillOpacity)
          } // Opacité pleine pour le motif eraser
          fillRule="evenodd"
          stroke="none"
          style={{
            cursor: isTransient ? "crosshair" : "pointer",
            transition: "fill 0.2s",
          }}
          onMouseEnter={() => {
            if (!isTransient) setHoveredPartId(mainPartId);
          }}
          onMouseLeave={() => setHoveredPartId(null)}
          data-part-type="MAIN"
          {...dataProps}
        />
      )}

      {/* CUTS FILL (Hit Area + Selection Feedback) */}
      {selected &&
        !isTransient &&
        holesData.map((hole, i) => {
          const partId = getPartId("CUT", i);
          const style = getPartStyle(partId);
          const isSelected = selectedPartId === partId;
          const isHovered = effectiveHoveredPartId === partId;

          // Bleu si sélectionné, sinon couleur dynamique (ou contexte)
          const holeFill = isSelected
            ? STYLE_CONSTANTS.COLORS.CUT_SELECTED
            : isHovered
              ? style.fill
              : displayFillColor;

          // Gestion fine des opacités pour les trous
          let holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_NORMAL_FILL; // Par défaut faible
          if (isSelected)
            holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_SELECTED_FILL;
          else if (isHovered)
            holeOpacity = STYLE_CONSTANTS.OPACITIES.CUT_HOVER_FILL;

          return (
            <path
              key={`hole-fill-${i}`}
              d={hole.d}
              fill={holeFill}
              fillOpacity={holeOpacity}
              stroke="none"
              style={{ cursor: getPartCursor(partId) }}
              data-part-id={partId}
              data-part-type="CUT"
              data-node-id={annotationId}
              onMouseEnter={(e) => {
                e.stopPropagation();
                if (!isTransient) setHoveredPartId(partId);
              }}
              onMouseLeave={() => setHoveredPartId(null)}
            />
          );
        })}

      {/* EXTRUSION PROFILE OFFSET — drawn UNDER the main strokes so it
                never blocks selection / editing of the contour. */}
      {renderExtrusionOffset()}

      {/* STROKES (Main) — continuous visual runs, then per-segment hit areas */}
      {strokeType !== "NONE" &&
        renderContinuousStrokes(segmentMap, closeLine, "MAIN", 0)}
      {strokeType !== "NONE" && renderSegments(segmentMap, "MAIN", 0)}

      {/* STROKES (Cuts) */}
      {strokeType !== "NONE" &&
        holesData.map((hole, i) => (
          <g key={`hole-strokes-${i}`}>
            {renderContinuousStrokes(hole.segmentMap, true, "CUT", i)}
            {renderSegments(hole.segmentMap, "CUT", i)}
          </g>
        ))}

      {/* GHOST OFFSET INDICATORS (Image D — polygon only, when unselected) */}
      {renderGhostOffsetIndicators()}

      {/* EXT EDGES (Segment extérieur — fluo-blue, always visible) */}
      {renderExtEdges()}

      {/* IS_EXT INDICATOR (guide "Extérieur" — 1px axis line, no events) */}
      {renderIsExtIndicator()}

      {/* CONNECTED SEGMENTS HIGHLIGHT */}
      {renderConnectedSegments()}

      {/* POINTS — full handles when the annotation is selected.
                Skipped for non-editable annotations (e.g. revolution proxies):
                they can be selected but not vertex-edited. */}
      {selected &&
        !disableVertexEditing &&
        pointEntriesToRender.map(({ point, cutIndex, source }) =>
          renderVertex(point, cutIndex, source)
        )}

      {/* INNER POINT CURSORS — visible even when the annotation is not selected.
                Small fixed-size cross (zoom-invariant via vertexScaleTransform),
                non-interactive (pointerEvents:none). To interact (select / drag /
                edit offsets) the user must first select the parent polygon, which
                switches over to the full square/circle handles above. */}
      {!selected &&
        (mergedAnnotation.innerPoints || []).map((pt) => (
          <g
            key={`inner-cursor-${pt.id}`}
            transform={`translate(${pt.x}, ${pt.y})`}
            style={{ pointerEvents: "none" }}
          >
            <g style={{ transform: vertexScaleTransform }}>
              <line
                x1={-4}
                y1={0}
                x2={4}
                y2={0}
                stroke="#2196f3"
                strokeWidth={2}
              />
              <line
                x1={0}
                y1={-4}
                x2={0}
                y2={4}
                stroke="#2196f3"
                strokeWidth={2}
              />
            </g>
          </g>
        ))}

      {/* LABEL */}
      {showLabel && (
        <NodeLabelStatic
          annotation={labelAnnotation}
          containerK={containerK}
          hidden={!mergedAnnotation.showLabel}
        />
      )}

      {/* SLOPE INDICATOR — arrow pointing uphill + percentage label.
                `getPolygonSlope` returns a downhill unit vector by convention,
                so we negate the components when computing the arrow rotation.
                Visible on POLYGON unless the template sets `hideSlope`, and
                a measurable gradient (rounded slope >= 1%). Arrow + text are
                wrapped in `vertexScaleTransform` so they keep a constant
                on-screen size in both Map and Portfolio viewers, matching
                the technique used by NodeCoteStatic. */}
      {/* guideLine: drawn while the annotation is selected so the user
                can see / re-draw the ramp axis. Solid when the slope arrow is
                shown, dashed otherwise. */}
      {selected &&
        !disableVertexEditing &&
        guideLinesData.map((gl) => {
          const guidePartId = gl.partId;
          const isSelectedGuide = selectedPartId === guidePartId;
          const isHoveredGuide = effectiveHoveredPartId === guidePartId;
          const pointsStr = gl.polyline.map((p) => `${p.x},${p.y}`).join(" ");
          const strokeColor = isSelectedGuide
            ? STYLE_CONSTANTS.COLORS.SELECTED_PART
            : "#1976d2";
          const strokeWidth = isSelectedGuide || isHoveredGuide ? 3 : 2;
          const strokeOpacity = isSelectedGuide || isHoveredGuide ? 1 : 0.7;
          return (
            <g
              key={guidePartId}
              onMouseEnter={(e) => {
                e.stopPropagation();
                if (!isTransient) setHoveredPartId(guidePartId);
              }}
              onMouseLeave={() => setHoveredPartId(null)}
              data-part-id={guidePartId}
              data-part-type="GUIDE_LINE"
              data-node-id={annotationId}
              style={{ cursor: getPartCursor(guidePartId) }}
            >
              {/* Hit area (transparent wide stroke) */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="transparent"
                strokeWidth={POLYGON_HIT_STROKE_WIDTH_PX}
                vectorEffect="non-scaling-stroke"
              />
              {/* Visible stroke */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                strokeOpacity={strokeOpacity}
                strokeDasharray={mergedAnnotation.hideSlope ? "6 5" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ pointerEvents: "none" }}
              />
            </g>
          );
        })}

      {/* Slope arrow along the MIDDLE of the guideLine, following the
                curve and pointing uphill (replaces the centroid arrow when a
                guideLine exists). */}
      {!mergedAnnotation.hideSlope &&
        guideLinesData
          .filter((gl) => Math.round(Math.abs(gl.slopePct)) >= 1)
          .map((gl) => {
            const headLen = 12;
            const headW = 9;
            const arrowColor = "#000";
            return (
              <g key={`arrow-${gl.partId}`} style={{ pointerEvents: "none" }}>
                <polyline
                  points={gl.shaft.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={arrowColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                <g transform={`translate(${gl.head.x}, ${gl.head.y})`}>
                  <g transform={`rotate(${gl.angleDeg})`}>
                    <g style={{ transform: vertexScaleTransform }}>
                      <polygon
                        points={`0,0 ${-headLen},${-headW / 2} ${-headLen},${headW / 2}`}
                        fill={arrowColor}
                      />
                    </g>
                  </g>
                </g>
                <g transform={`translate(${gl.mid.x}, ${gl.mid.y})`}>
                  <g style={{ transform: vertexScaleTransform }}>
                    <text
                      x={0}
                      y={-12}
                      textAnchor="middle"
                      dominantBaseline="alphabetic"
                      fontSize={14}
                      fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                      fill={arrowColor}
                      style={{
                        userSelect: "none",
                        paintOrder: "stroke",
                        stroke: "white",
                        strokeWidth: 3,
                        strokeLinejoin: "round",
                      }}
                    >
                      {`${Math.round(gl.slopePct)}%`}
                    </text>
                  </g>
                </g>
              </g>
            );
          })}

      {guideLinesData.length === 0 &&
        slope &&
        slopeCentroid &&
        Math.round(slope.slopePct) >= 1 &&
        (() => {
          const angleDeg =
            (Math.atan2(-slope.dirY, -slope.dirX) * 180) / Math.PI;
          const L = 40; // arrow total length in screen pixels
          const headLen = 8; // arrowhead length in screen pixels
          const headW = 6; // arrowhead width in screen pixels
          const arrowColor = "#000";
          return (
            <g
              transform={`translate(${slopeCentroid.x}, ${slopeCentroid.y})`}
              style={{ pointerEvents: "none" }}
            >
              <g transform={`rotate(${angleDeg})`}>
                <g style={{ transform: vertexScaleTransform }}>
                  <line
                    x1={-L / 2}
                    y1={0}
                    x2={L / 2 - headLen}
                    y2={0}
                    stroke={arrowColor}
                    strokeWidth={1.5}
                  />
                  <polygon
                    points={`${L / 2},0 ${L / 2 - headLen},${-headW / 2} ${L / 2 - headLen},${headW / 2}`}
                    fill={arrowColor}
                  />
                </g>
              </g>
              <g style={{ transform: vertexScaleTransform }}>
                <text
                  x={0}
                  y={-8}
                  textAnchor="middle"
                  dominantBaseline="alphabetic"
                  fontSize={14}
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={arrowColor}
                  style={{
                    userSelect: "none",
                    paintOrder: "stroke",
                    stroke: "white",
                    strokeWidth: 3,
                    strokeLinejoin: "round",
                  }}
                >
                  {`${Math.round(slope.slopePct)}%`}
                </text>
              </g>
            </g>
          );
        })()}
    </g>
  );
}

export default memo(NodePolylineStatic);
