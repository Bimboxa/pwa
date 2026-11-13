import { useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

import {
  selectPrintZonesTileSizeMode,
  selectPrintZonesTileSizePx,
} from "../popperImagesSlice";

import {
  PRINT_ZONES_TILE_SIZE_DEFAULT_PX,
  PRINT_ZONES_TILE_SIZE_MIN_PX,
} from "../services/popperImagesLocalStorage";
import getImageAnnotationAspect from "../utils/getImageAnnotationAspect";
import layoutImagePrintZones from "../utils/layoutImagePrintZones";

// ---------------------------------------------------------------------------
// useImagePrintZonesLayout — live "print zones" layout of the photos of an
// editor (ImagesPrintZonesOverlay) or of a capture frame
// (CaptureImagePrintZonesOverlay).
//
// `getFrame()` → { origin: {left, top}, rect: {left, top, width, height},
// reserved: [{left, top, width, height}] } in CLIENT px, or null: `rect` is
// where the 4 bands run, `reserved` the areas to keep free, `origin` the
// top-left corner the returned coordinates are relative to.
//
// Returns { tiles, anchorsById, insets }:
// - anchorsById[id] = { x, y, inside } follows the camera frame by frame
//   (anchorProjector.subscribe), so the leaders stick to their anchors;
// - tiles (layoutImagePrintZones, + origin offset) only move once the camera
//   has been still for SETTLE_MS: the photos never jump from an edge to
//   another during a pan / zoom. A photo whose anchor is outside the rect
//   gets no tile.
// ---------------------------------------------------------------------------

const SETTLE_MS = 250;
const EMPTY = { tiles: [], insets: { top: 0, right: 0, bottom: 0, left: 0 } };

function tilesKey(tiles) {
  return tiles
    .map((t) => `${t.id}:${t.side},${t.x},${t.y},${t.width},${t.height}`)
    .join("|");
}

export default function useImagePrintZonesLayout({
  active,
  images,
  anchorProjector,
  getFrame,
  invalidateKey,
}) {
  // data

  const tileSizeMode = useSelector(selectPrintZonesTileSizeMode);
  const tileSizePx = useSelector(selectPrintZonesTileSizePx);

  // state

  const [layout, setLayout] = useState(EMPTY);
  const [anchorsById, setAnchorsById] = useState({});
  const layoutKeyRef = useRef("");
  const anchorsKeyRef = useRef("");
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  // helpers

  const measure = useCallback(() => {
    const frame = active && anchorProjector ? getFrame?.() : null;
    if (!frame?.rect || !(frame.rect.width > 0) || !(frame.rect.height > 0)) {
      return null;
    }
    const { origin, rect } = frame;
    const anchors = {};
    (images ?? []).forEach((a) => {
      const p = anchorProjector.project(a);
      if (!p) return;
      anchors[a.id] = {
        x: p.x - origin.left,
        y: p.y - origin.top,
        inside:
          p.x >= rect.left &&
          p.x <= rect.left + rect.width &&
          p.y >= rect.top &&
          p.y <= rect.top + rect.height,
      };
    });
    return { frame, anchors };
  }, [active, anchorProjector, getFrame, images]);

  const relayout = useCallback(() => {
    const m = measure();
    if (!m) {
      if (layoutKeyRef.current !== "") {
        layoutKeyRef.current = "";
        setLayout(EMPTY);
      }
      return;
    }
    const { origin, rect, reserved } = m.frame;
    const dx = rect.left - origin.left;
    const dy = rect.top - origin.top;
    const items = (images ?? [])
      .filter((a) => m.anchors[a.id]?.inside)
      .map((a) => ({
        id: a.id,
        anchor: { x: m.anchors[a.id].x - dx, y: m.anchors[a.id].y - dy },
        aspect: getImageAnnotationAspect(a),
      }));
    const fixed = tileSizeMode === "FIXED";
    const result = layoutImagePrintZones({
      items,
      rect: { width: rect.width, height: rect.height },
      tileSize: fixed ? tileSizePx : PRINT_ZONES_TILE_SIZE_DEFAULT_PX,
      minTileSize: PRINT_ZONES_TILE_SIZE_MIN_PX,
      autoShrink: !fixed,
      reserved: (reserved ?? []).map((r) => ({
        x: r.left - rect.left,
        y: r.top - rect.top,
        width: r.width,
        height: r.height,
      })),
    });
    const tiles = result.tiles.map((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    const key = tilesKey(tiles);
    if (key !== layoutKeyRef.current) {
      layoutKeyRef.current = key;
      setLayout({ tiles, insets: result.insets });
    }
  }, [measure, images, tileSizeMode, tileSizePx]);

  const settle = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      relayout();
    }, SETTLE_MS);
  }, [relayout]);

  // One pass per frame: refresh the anchors; a move re-arms the settle timer.
  const tick = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const anchors = measure()?.anchors ?? {};
      const key = Object.entries(anchors)
        .map(([id, p]) => `${id}:${p.x | 0},${p.y | 0},${p.inside ? 1 : 0}`)
        .join("|");
      if (key === anchorsKeyRef.current) return;
      anchorsKeyRef.current = key;
      setAnchorsById(anchors);
      settle();
    });
  }, [measure, settle]);

  // effects

  // Data / settings / host layout changes: lay out right away.
  useEffect(() => {
    relayout();
    tick();
  }, [relayout, tick, invalidateKey]);

  // Camera, window size, end of a panel drag (reserved areas moved).
  useEffect(() => {
    if (!active) return undefined;
    const unsubscribe = anchorProjector?.subscribe?.(tick);
    window.addEventListener("resize", settle);
    window.addEventListener("mouseup", settle);
    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", settle);
      window.removeEventListener("mouseup", settle);
    };
  }, [active, anchorProjector, tick, settle]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearTimeout(timerRef.current);
      rafRef.current = null;
      timerRef.current = null;
    },
    []
  );

  return { tiles: layout.tiles, insets: layout.insets, anchorsById };
}
