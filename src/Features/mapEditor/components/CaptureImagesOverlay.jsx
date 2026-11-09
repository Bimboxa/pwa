import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setImageModeImagesOverlay } from "../mapEditorSlice";

import ImageIndexBadgeSvg from "Features/popperImages/components/ImageIndexBadgeSvg";
import {
  IMAGE_LINK_STROKE,
  IMAGE_LINK_STROKE_WIDTH,
} from "Features/popperImages/constants/imageDisplay";
import resolveImagesOverlayGeometry, {
  IMAGES_ZONE_MIN_WIDTH,
} from "../utils/resolveImagesOverlayGeometry";
import layoutCaptureImageTiles from "../utils/layoutCaptureImageTiles";

// ---------------------------------------------------------------------------
// CaptureImagesOverlay — the "Ex situ" photos inside the captured page:
// Paper-style floating tiles (white card, shadow, rounded) laid out in
// columns in a transparent zone of the capture rect, each tied to its anchor
// in the scene by a leader ("Ligne") and / or by its display number
// ("Numéro", the anchor badge being drawn by the live renderers). Rendered INSIDE the
// ImageModeOverlay svg, in viewport px: the `data-capture-keep` groups are
// captured with the plan, the move / resize handles are `data-capture-hide`.
// The zone geometry lives in mapEditor.imageModeImagesOverlay (legend-like
// drag pattern). Anchors come from the host's anchorProjector (client px →
// svg px) and follow the camera through its `subscribe`.
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 12;
const TILE_PADDING = 4;
const CAPTION_HEIGHT = 16;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export default function CaptureImagesOverlay({
  rect,
  images,
  showLines,
  showNumbers,
  anchorProjector,
  getSvgRect,
  captureToolActive,
  legendDefaultBottom = 0,
}) {
  const dispatch = useDispatch();

  // data

  const overlay = useSelector((s) => s.mapEditor.imageModeImagesOverlay);
  const zone = resolveImagesOverlayGeometry(overlay, rect, {
    legendDefaultBottom,
  });

  // tiles (zone-local px), in display order
  const { tiles, height: zoneHeight } = useMemo(() => {
    const items = (images ?? []).map((a) => {
      const b = a.bbox;
      const size = a.image?.imageSize;
      const aspect =
        b?.width > 0 && b?.height > 0
          ? b.width / b.height
          : size?.width > 0 && size?.height > 0
            ? size.width / size.height
            : 4 / 3;
      return {
        id: a.id,
        aspect,
        captionHeight: a.label ? CAPTION_HEIGHT : 0,
      };
    });
    return layoutCaptureImageTiles({
      items,
      zone: { width: zone.width, columns: zone.columns, gap: zone.gap },
    });
  }, [images, zone.width, zone.columns, zone.gap]);
  const imagesById = useMemo(
    () => Object.fromEntries((images ?? []).map((a) => [a.id, a])),
    [images]
  );

  // anchors (svg px), refreshed on camera change
  const [anchors, setAnchors] = useState({});
  const anchorsKeyRef = useRef("");
  const rafRef = useRef(null);
  const computeAnchors = useCallback(() => {
    const svgRect = getSvgRect?.();
    if (!svgRect || !anchorProjector) return;
    const next = {};
    (images ?? []).forEach((a) => {
      const p = anchorProjector.project(a);
      if (!p) return;
      next[a.id] = { x: p.x - svgRect.left, y: p.y - svgRect.top };
    });
    const key = Object.entries(next)
      .map(([id, p]) => `${id}:${p.x | 0},${p.y | 0}`)
      .join("|");
    if (key !== anchorsKeyRef.current) {
      anchorsKeyRef.current = key;
      setAnchors(next);
    }
  }, [images, anchorProjector, getSvgRect]);
  const scheduleAnchors = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      computeAnchors();
    });
  }, [computeAnchors]);
  useEffect(() => {
    if (!showLines) return undefined;
    scheduleAnchors();
    const unsubscribe = anchorProjector?.subscribe?.(scheduleAnchors);
    window.addEventListener("resize", scheduleAnchors);
    return () => {
      unsubscribe?.();
      window.removeEventListener("resize", scheduleAnchors);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [showLines, anchorProjector, scheduleAnchors, rect.left, rect.top]);

  // drag / resize (legend pattern)
  const dragRef = useRef(null);
  const overlayRef = useRef(overlay);
  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);
  const pendingRef = useRef(null);
  const commitRafRef = useRef(null);
  const commitOverlay = useCallback(
    (next) => {
      pendingRef.current = next;
      if (commitRafRef.current) return;
      commitRafRef.current = requestAnimationFrame(() => {
        commitRafRef.current = null;
        if (pendingRef.current) {
          dispatch(setImageModeImagesOverlay(pendingRef.current));
          pendingRef.current = null;
        }
      });
    },
    [dispatch]
  );
  useEffect(() => {
    function handleMove(e) {
      if (!dragRef.current) return;
      const { type, startX, startY, base } = dragRef.current;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (type === "MOVE") {
        commitOverlay({
          ...base,
          x: clamp(base.x + dx, 0, Math.max(0, rect.width - base.width)),
          y: clamp(base.y + dy, 0, Math.max(0, rect.height - 20)),
        });
      } else if (type === "RESIZE") {
        commitOverlay({
          ...base,
          width: clamp(
            base.width + dx,
            IMAGES_ZONE_MIN_WIDTH,
            Math.max(IMAGES_ZONE_MIN_WIDTH, rect.width - base.x)
          ),
        });
      }
    }
    function handleUp() {
      dragRef.current = null;
      document.body.style.cursor = "";
    }
    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [commitOverlay, rect.width, rect.height]);

  function startDrag(type, e) {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      type,
      startX: e.clientX,
      startY: e.clientY,
      // Seed with the resolved geometry so dragging from the defaults works.
      base: { ...overlayRef.current, x: zone.x, y: zone.y, width: zone.width },
    };
    document.body.style.cursor = type === "MOVE" ? "grabbing" : "ew-resize";
  }

  // render

  if (!tiles.length) return null;

  const originX = rect.left + zone.x;
  const originY = rect.top + zone.y;

  return (
    <>
      {/* Leaders: tile edge → anchor (svg px). Part of the AI content, like
          the legend (no data-capture-decor). */}
      {showLines && (
        <g data-capture-keep style={{ pointerEvents: "none" }}>
          {tiles.map((t) => {
            const a = anchors[t.id];
            if (!a) return null;
            const left = originX + t.x;
            const midY = originY + t.y + t.height / 2;
            const x1 = a.x < left + t.width / 2 ? left : left + t.width;
            return (
              <line
                key={t.id}
                x1={x1}
                y1={midY}
                x2={a.x}
                y2={a.y}
                stroke={IMAGE_LINK_STROKE}
                strokeWidth={IMAGE_LINK_STROKE_WIDTH}
              />
            );
          })}
        </g>
      )}

      <g transform={`translate(${originX}, ${originY})`}>
        {/* Move target (whole zone), capture tool only — never captured. */}
        {captureToolActive && (
          <g data-capture-hide>
            <rect
              x={-4}
              y={-4}
              width={zone.width + 8}
              height={zoneHeight + 8}
              fill="rgba(255,255,255,0.01)"
              stroke="#2196f3"
              strokeWidth={1}
              strokeDasharray="4 3"
              rx={6}
              style={{ cursor: "grab", pointerEvents: "auto" }}
              onMouseDown={(e) => startDrag("MOVE", e)}
            />
          </g>
        )}

        {/* Tiles */}
        <g data-capture-keep style={{ pointerEvents: "none" }}>
          {tiles.map((t) => {
            const a = imagesById[t.id];
            const src = a?.image?.imageUrlClient ?? a?.image?.thumbnail;
            return (
              <g key={t.id} transform={`translate(${t.x}, ${t.y})`}>
                <foreignObject
                  width={t.width}
                  height={t.height}
                  style={{ overflow: "visible" }}
                >
                  <div
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      width: t.width,
                      height: t.height,
                      boxSizing: "border-box",
                      background: "#fff",
                      borderRadius: 8,
                      padding: TILE_PADDING,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    {src && (
                      <img
                        src={src}
                        alt=""
                        style={{
                          flex: 1,
                          minHeight: 0,
                          width: "100%",
                          objectFit: "cover",
                          borderRadius: 5,
                          display: "block",
                          transform: a?.imageFlipY ? "scaleY(-1)" : undefined,
                        }}
                      />
                    )}
                    {a?.label && (
                      <div
                        style={{
                          font: "600 11px sans-serif",
                          lineHeight: `${CAPTION_HEIGHT - 2}px`,
                          height: CAPTION_HEIGHT - 2,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          color: "#222",
                        }}
                      >
                        {a.label}
                      </div>
                    )}
                  </div>
                </foreignObject>
                {showNumbers && (
                  <g transform="translate(2, 2)">
                    <ImageIndexBadgeSvg number={t.number} />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* SE resize handle (width), capture tool only. */}
        {captureToolActive && (
          <g data-capture-hide>
            <rect
              x={zone.width - HANDLE_SIZE / 2}
              y={zoneHeight - HANDLE_SIZE / 2}
              width={HANDLE_SIZE}
              height={HANDLE_SIZE}
              fill="#2196f3"
              stroke="white"
              strokeWidth={1}
              rx={2}
              style={{ cursor: "ew-resize", pointerEvents: "auto" }}
              onMouseDown={(e) => startDrag("RESIZE", e)}
            />
          </g>
        )}
      </g>
    </>
  );
}
