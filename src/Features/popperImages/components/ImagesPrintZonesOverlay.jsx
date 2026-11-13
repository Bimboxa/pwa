import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectImagesLinkLine,
  selectImagesLinkNumber,
  selectImagesPhotosHidden,
  selectImagesPrintZones,
  selectPrintZonesZones,
  setPrintZonesImagePinnedSide,
  setPrintZonesZone,
} from "../popperImagesSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box } from "@mui/material";

import TileImageAnnotation from "./TileImageAnnotation";
import DialogImageViewer from "Features/images/components/DialogImageViewer";

import useImagePrintZonesLayout from "../hooks/useImagePrintZonesLayout";
import {
  IMAGE_LINK_STROKE,
  IMAGE_LINK_STROKE_WIDTH,
  IMAGE_LINK_STROKE_WIDTH_SELECTED,
  IMAGE_VEIL_ELEMENT_OPACITY,
} from "../constants/imageDisplay";
import {
  buildImageAnnotationSelectionItem,
  isImageAnnotationVeiled,
  selectSelectedImageAnnotationId,
} from "../utils/imageAnnotationSelection";
import {
  PRINT_ZONE_SIDES,
  getPrintZoneTileLinkPoint,
} from "../utils/layoutImagePrintZones";
import { PRINT_ZONES_TILE_SIZE_MIN_PX } from "../services/popperImagesLocalStorage";

// ---------------------------------------------------------------------------
// ImagesPrintZonesOverlay — "print zones" display mode of the photos in an
// editor (2D and 3D): each photo is a paper tile in one of 4 bands along the
// edges of the editor box (useImagePrintZonesLayout: close to its anchor,
// bands evenly loaded, editor corner controls avoided), tied to
// its anchor in the scene by a leader ("Ligne", always drawn for the selected
// photo) and / or its display number ("Numéro"). The zones are fixed and the
// tiles centred in them: nothing follows the camera. A tile click selects the
// annotation, the selected tile offers "Fullscreen", a hovered tile a pin
// toggle that keeps the photo in its zone. A hovered zone shows its dashed
// outline and 3 handles: thickness (inner edge) and the two ends
// (popperImages.printZonesZones). Rendered in the editor's floating panels
// frame (PortalEditorFloatingPanels); only the tiles and the handles take
// the mouse (the zone hover is read from window mousemove). Excluded from
// captures, which draw their own tiles (CaptureImagePrintZonesOverlay).
// ---------------------------------------------------------------------------

// Elements of the app the tiles must not cover: the editor controls tagged
// for it (the floating panels are not avoided).
const AVOID_SELECTOR = "[data-print-zones-avoid]";
const AVOID_MAX_AREA_RATIO = 0.5;
const TILE_FRAME_PX = 4;
// Zone outline: drawn this far around the zone, hovered this far around it.
const ZONE_OUTLINE_MARGIN_PX = 4;
const ZONE_HOVER_MARGIN_PX = 12;
const ZONE_HANDLE_LENGTH_PX = 28;
const ZONE_HANDLE_THICKNESS_PX = 8;
// Inward direction of each zone, as a factor of the pointer (dx, dy).
const INWARD = {
  TOP: { x: 0, y: 1 },
  BOTTOM: { x: 0, y: -1 },
  LEFT: { x: 1, y: 0 },
  RIGHT: { x: -1, y: 0 },
};

function isHorizontalSide(side) {
  return side === "TOP" || side === "BOTTOM";
}

// The 3 handles of a zone outline `o` ({x, y, width, height}): centre point
// + whether the handle bar lies horizontally.
function getZoneHandles(side, o) {
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  if (isHorizontalSide(side)) {
    return [
      {
        kind: "THICKNESS",
        x: cx,
        y: side === "TOP" ? o.y + o.height : o.y,
        flat: true,
      },
      { kind: "START", x: o.x, y: cy, flat: false },
      { kind: "END", x: o.x + o.width, y: cy, flat: false },
    ];
  }
  return [
    {
      kind: "THICKNESS",
      x: side === "LEFT" ? o.x + o.width : o.x,
      y: cy,
      flat: false,
    },
    { kind: "START", x: cx, y: o.y, flat: true },
    { kind: "END", x: cx, y: o.y + o.height, flat: true },
  ];
}

export default function ImagesPrintZonesOverlay({
  images,
  indexById,
  anchorProjector,
  hostInvalidateKey,
}) {
  const dispatch = useDispatch();

  // data

  const printZones = useSelector(selectImagesPrintZones);
  const linkLine = useSelector(selectImagesLinkLine);
  const linkNumber = useSelector(selectImagesLinkNumber);
  const photosHidden = useSelector(selectImagesPhotosHidden);
  const zonesSettings = useSelector(selectPrintZonesZones);
  const rawSelectedImageId = useSelector(selectSelectedImageAnnotationId);
  const selectedImageId = images?.some((a) => a.id === rawSelectedImageId)
    ? rawSelectedImageId
    : null;
  // The open right tool drawer slides over the editor: step aside.
  const rightDrawerWidth = useSelector((s) =>
    s.rightPanel.selectedMenuItemKey ? s.rightPanel.width : 0
  );

  // state

  const rootRef = useRef(null);
  const [fullscreenImageId, setFullscreenImageId] = useState(null);
  const [hoveredSide, setHoveredSide] = useState(null);
  const [resizingSide, setResizingSide] = useState(null);
  const dragRef = useRef(null);

  // helpers

  const active = printZones && !photosHidden && Boolean(images?.length);

  const getFrame = useCallback(() => {
    const root = rootRef.current;
    if (!root) return null;
    const o = root.getBoundingClientRect();
    const vp = anchorProjector?.getViewportRect?.() ?? o;
    const left = Math.max(o.left, vp.left);
    const top = Math.max(o.top, vp.top);
    const right = Math.min(o.right, vp.right) - rightDrawerWidth;
    const bottom = Math.min(o.bottom, vp.bottom);
    const rect = { left, top, width: right - left, height: bottom - top };
    const reserved = [];
    const maxArea = rect.width * rect.height * AVOID_MAX_AREA_RATIO;
    const avoid = (el) => {
      if (!el || el === root || root.contains(el)) return;
      const r = el.getBoundingClientRect();
      if (!(r.width > 0) || !(r.height > 0)) return;
      // Full-frame layers (leaders svg…) are not panels.
      if (r.width * r.height > maxArea) return;
      reserved.push({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      });
    };
    // The floating panels (PopperMapListings…) are NOT avoided: the zones
    // keep the full edges and slide under the panels.
    document.querySelectorAll(AVOID_SELECTOR).forEach(avoid);
    return { origin: { left: o.left, top: o.top }, rect, reserved };
  }, [anchorProjector, rightDrawerWidth]);

  const { tiles, zones, rect, anchorsById } = useImagePrintZonesLayout({
    active,
    images,
    anchorProjector,
    getFrame,
    invalidateKey: `${hostInvalidateKey}|${rightDrawerWidth}`,
    zones: zonesSettings,
    keepOutside: true,
  });

  const imagesById = useMemo(
    () => Object.fromEntries((images ?? []).map((a) => [a.id, a])),
    [images]
  );
  const fullscreenImage = fullscreenImageId
    ? imagesById[fullscreenImageId]
    : null;

  const shownSide = resizingSide ?? hoveredSide;
  const shownZone = shownSide ? zones[shownSide] : null;
  const outline = shownZone
    ? {
        x: shownZone.x - ZONE_OUTLINE_MARGIN_PX,
        y: shownZone.y - ZONE_OUTLINE_MARGIN_PX,
        width: shownZone.width + 2 * ZONE_OUTLINE_MARGIN_PX,
        height: shownZone.height + 2 * ZONE_OUTLINE_MARGIN_PX,
      }
    : null;

  // effects

  // Zone hover, without taking the mouse from the editor: the occupied zone
  // under the pointer (none while a mouse button is down: pan, drawing…).
  useEffect(() => {
    if (!active) return undefined;
    const onMove = (e) => {
      if (dragRef.current || e.buttons) return;
      const root = rootRef.current;
      if (!root) return;
      const o = root.getBoundingClientRect();
      const x = e.clientX - o.left;
      const y = e.clientY - o.top;
      const m = ZONE_HOVER_MARGIN_PX;
      const side =
        PRINT_ZONE_SIDES.find((s) => {
          const z = zones[s];
          return (
            z?.count > 0 &&
            x >= z.x - m &&
            x <= z.x + z.width + m &&
            y >= z.y - m &&
            y <= z.y + z.height + m
          );
        }) ?? null;
      setHoveredSide((prev) => (prev === side ? prev : side));
    };
    const onLeave = () => {
      if (!dragRef.current) setHoveredSide(null);
    };
    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [active, zones]);

  // handlers

  function handleTogglePin(annotation) {
    const tile = tiles.find((t) => t.id === annotation.id);
    if (!tile) return;
    dispatch(
      setPrintZonesImagePinnedSide({
        id: annotation.id,
        side: tile.pinned ? null : tile.side,
      })
    );
  }

  function handleHandlePointerDown(e, side, kind) {
    const zone = zones[side];
    if (!zone || !rect) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const horizontal = isHorizontalSide(side);
    const rectStart = horizontal ? rect.x : rect.y;
    const rectLength = horizontal ? rect.width : rect.height;
    const zoneStart = horizontal ? zone.x : zone.y;
    const zoneLength = horizontal ? zone.width : zone.height;
    dragRef.current = {
      side,
      kind,
      horizontal,
      x0: e.clientX,
      y0: e.clientY,
      thickness: horizontal ? zone.height : zone.width,
      startInset: zoneStart - rectStart,
      endInset: rectStart + rectLength - (zoneStart + zoneLength),
      rectLength,
    };
    setResizingSide(side);
  }

  function handleHandlePointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    const along = d.horizontal ? dx : dy;
    const maxInset = (other) =>
      Math.max(0, d.rectLength - other - PRINT_ZONES_TILE_SIZE_MIN_PX);
    const clampTo = (v, max) => Math.min(max, Math.max(0, v));
    let patch;
    if (d.kind === "THICKNESS") {
      const inward = INWARD[d.side];
      patch = { thickness: d.thickness + dx * inward.x + dy * inward.y };
    } else if (d.kind === "START") {
      patch = {
        startInset: clampTo(d.startInset + along, maxInset(d.endInset)),
      };
    } else {
      patch = {
        endInset: clampTo(d.endInset - along, maxInset(d.startInset)),
      };
    }
    dispatch(setPrintZonesZone({ side: d.side, patch }));
  }

  function handleHandlePointerUp() {
    dragRef.current = null;
    setResizingSide(null);
  }

  function handleSelect(annotation) {
    const alreadySelected = annotation.id === selectedImageId;
    dispatch(
      setSelectedItem(
        alreadySelected ? null : buildImageAnnotationSelectionItem(annotation)
      )
    );
  }

  // render

  if (!active) return null;

  return (
    <>
      <Box
        ref={rootRef}
        data-capture-hide
        // Inline: the frame gives the mouse to its direct children.
        style={{ pointerEvents: "none" }}
        sx={{
          position: "absolute",
          inset: 0,
          // Under the floating panels of the frame (zIndex 10).
          zIndex: 9,
          overflow: "hidden",
        }}
      >
        {(linkLine || selectedImageId) && (
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          >
            {tiles.map((t) => {
              const a = anchorsById[t.id];
              const selected = t.id === selectedImageId;
              // "Ligne" off: the leader of the selected photo only.
              if (!a?.inside || !(linkLine || selected)) return null;
              const p = getPrintZoneTileLinkPoint(t, a);
              return (
                <g
                  key={t.id}
                  style={{
                    opacity: isImageAnnotationVeiled(t.id, selectedImageId)
                      ? IMAGE_VEIL_ELEMENT_OPACITY
                      : 1,
                  }}
                >
                  <line
                    x1={p.x}
                    y1={p.y}
                    x2={a.x}
                    y2={a.y}
                    stroke={IMAGE_LINK_STROKE}
                    strokeWidth={
                      selected
                        ? IMAGE_LINK_STROKE_WIDTH_SELECTED
                        : IMAGE_LINK_STROKE_WIDTH
                    }
                  />
                  <circle cx={p.x} cy={p.y} r={3} fill={IMAGE_LINK_STROKE} />
                </g>
              );
            })}
          </svg>
        )}

        {tiles.map((t) => {
          const annotation = imagesById[t.id];
          if (!annotation) return null;
          return (
            <Box
              key={t.id}
              sx={{
                position: "absolute",
                left: t.x,
                top: t.y,
                width: t.width,
                height: t.height,
                boxSizing: "border-box",
                p: `${TILE_FRAME_PX}px`,
                bgcolor: "common.white",
                borderRadius: 1.5,
                boxShadow: 3,
                pointerEvents: "auto",
                // No lag behind the handle while a zone is resized.
                transition: resizingSide
                  ? "none"
                  : "left 0.2s ease, top 0.2s ease, width 0.2s ease, height 0.2s ease",
              }}
            >
              <TileImageAnnotation
                annotation={annotation}
                number={indexById?.[t.id]}
                selected={t.id === selectedImageId}
                veiled={isImageAnnotationVeiled(t.id, selectedImageId)}
                fill
                showNumber={linkNumber}
                pinned={Boolean(t.pinned)}
                onTogglePin={handleTogglePin}
                onSelect={handleSelect}
                onFullscreen={(a) => setFullscreenImageId(a.id)}
              />
            </Box>
          );
        })}

        {/* Hovered zone: dashed outline + thickness / ends handles. */}
        {outline && (
          <>
            <Box
              sx={{
                position: "absolute",
                left: outline.x,
                top: outline.y,
                width: outline.width,
                height: outline.height,
                boxSizing: "border-box",
                border: "1.5px dashed",
                borderColor: "primary.main",
                borderRadius: 2,
                pointerEvents: "none",
              }}
            />
            {getZoneHandles(shownSide, outline).map((h) => {
              const w = h.flat
                ? ZONE_HANDLE_LENGTH_PX
                : ZONE_HANDLE_THICKNESS_PX;
              const hgt = h.flat
                ? ZONE_HANDLE_THICKNESS_PX
                : ZONE_HANDLE_LENGTH_PX;
              return (
                <Box
                  key={h.kind}
                  onPointerDown={(e) =>
                    handleHandlePointerDown(e, shownSide, h.kind)
                  }
                  onPointerMove={handleHandlePointerMove}
                  onPointerUp={handleHandlePointerUp}
                  onPointerCancel={handleHandlePointerUp}
                  sx={{
                    position: "absolute",
                    left: h.x - w / 2,
                    top: h.y - hgt / 2,
                    width: w,
                    height: hgt,
                    boxSizing: "border-box",
                    bgcolor: "common.white",
                    border: "1.5px solid",
                    borderColor: "primary.main",
                    borderRadius: "4px",
                    boxShadow: 1,
                    cursor: h.flat ? "ns-resize" : "ew-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                  }}
                />
              );
            })}
          </>
        )}
      </Box>

      <DialogImageViewer
        open={Boolean(fullscreenImage)}
        onClose={() => setFullscreenImageId(null)}
        src={
          fullscreenImage?.image?.imageUrlClient ??
          fullscreenImage?.image?.thumbnail
        }
        title={fullscreenImage?.label || fullscreenImage?.image?.fileName || ""}
      />
    </>
  );
}
