import { useCallback, useEffect, useRef, useState } from "react";

import {
  IMAGE_LINK_STROKE,
  IMAGE_LINK_STROKE_WIDTH,
  IMAGE_LINK_STROKE_WIDTH_SELECTED,
  IMAGE_VEIL_ELEMENT_OPACITY,
} from "../constants/imageDisplay";
import { isImageAnnotationVeiled } from "../utils/imageAnnotationSelection";

// ---------------------------------------------------------------------------
// ImagesLinksOverlay — ex situ: one leader per photo ("Ligne"), or only the
// leader of the selected photo (`onlySelected`, "Ligne" off), from its tile
// in PopperImages (DOM rect) to its anchor in the scene (anchorProjector,
// client px: 2D camera matrix or 3D projection). Absolute SVG over the editor
// box, ABOVE the panel (the leader must visibly reach its tile), never takes
// the mouse, excluded from captures. Recomputed in one rAF
// per camera frame / panel move / grid scroll; no line when the anchor is
// off-viewport or the tile is scrolled out of the grid.
// ---------------------------------------------------------------------------

function linesKey(lines) {
  return lines
    .map(
      (l) =>
        `${l.id}:${l.x1 | 0},${l.y1 | 0},${l.x2 | 0},${l.y2 | 0},${l.veiled ? 1 : 0},${l.selected ? 1 : 0}`
    )
    .join("|");
}

export default function ImagesLinksOverlay({
  active,
  images,
  selectedImageId,
  onlySelected = false,
  getTileRect,
  getGridRect,
  scrollEl,
  observeEl,
  anchorProjector,
  invalidateKey,
}) {
  const svgRef = useRef(null);
  const [lines, setLines] = useState([]);
  const keyRef = useRef("");
  const rafRef = useRef(null);

  const compute = useCallback(() => {
    const svg = svgRef.current;
    if (!svg || !active || !anchorProjector) {
      if (keyRef.current !== "") {
        keyRef.current = "";
        setLines([]);
      }
      return;
    }
    const o = svg.getBoundingClientRect();
    const vp = anchorProjector.getViewportRect?.();
    const grid = getGridRect?.();
    const next = [];
    for (const a of images || []) {
      if (onlySelected && a.id !== selectedImageId) continue;
      const p = anchorProjector.project(a);
      if (!p) continue;
      if (
        vp &&
        (p.x < vp.left || p.x > vp.right || p.y < vp.top || p.y > vp.bottom)
      ) {
        continue;
      }
      const t = getTileRect?.(a.id);
      if (!t) continue;
      const cy = t.top + t.height / 2;
      if (grid && (cy < grid.top || cy > grid.bottom)) continue;
      next.push({
        id: a.id,
        x1: t.left - o.left,
        y1: cy - o.top,
        x2: p.x - o.left,
        y2: p.y - o.top,
        veiled: isImageAnnotationVeiled(a.id, selectedImageId),
        selected: a.id === selectedImageId,
      });
    }
    const key = linesKey(next);
    if (key !== keyRef.current) {
      keyRef.current = key;
      setLines(next);
    }
  }, [
    active,
    anchorProjector,
    images,
    selectedImageId,
    onlySelected,
    getTileRect,
    getGridRect,
  ]);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      compute();
    });
  }, [compute]);

  // Data / layout changes.
  useEffect(() => {
    schedule();
  }, [schedule, invalidateKey]);

  // Camera, window, grid scroll, panel size.
  useEffect(() => {
    if (!active) return undefined;
    const unsubscribe = anchorProjector?.subscribe?.(schedule);
    window.addEventListener("resize", schedule);
    const scroller = scrollEl?.current;
    scroller?.addEventListener("scroll", schedule, { passive: true });
    let observer;
    const observed = observeEl?.current ?? scroller;
    if (observed && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(schedule);
      observer.observe(observed);
    }
    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", schedule);
      scroller?.removeEventListener("scroll", schedule);
      observer?.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, anchorProjector, schedule, scrollEl, observeEl]);

  if (!active) return null;

  return (
    <svg
      ref={svgRef}
      data-capture-hide
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        // Above the PopperImages Paper (zIndex 10).
        zIndex: 11,
        overflow: "hidden",
      }}
    >
      {lines.map((l) => (
        <g
          key={l.id}
          style={{ opacity: l.veiled ? IMAGE_VEIL_ELEMENT_OPACITY : 1 }}
        >
          <line
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={IMAGE_LINK_STROKE}
            strokeWidth={
              l.selected
                ? IMAGE_LINK_STROKE_WIDTH_SELECTED
                : IMAGE_LINK_STROKE_WIDTH
            }
          />
          <circle cx={l.x1} cy={l.y1} r={3} fill={IMAGE_LINK_STROKE} />
        </g>
      ))}
    </svg>
  );
}
