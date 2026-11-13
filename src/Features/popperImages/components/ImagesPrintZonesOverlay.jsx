import { useCallback, useMemo, useRef, useState } from "react";
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
import usePrintZonesResize from "../hooks/usePrintZonesResize";
import { getPrintZoneTileLinkPoint } from "../utils/layoutImagePrintZones";

// ---------------------------------------------------------------------------
// ImagesPrintZonesOverlay — "print zones" display mode of the photos in an
// editor (2D and 3D): each photo is a paper tile in one of 4 bands along the
// edges of the editor box (useImagePrintZonesLayout: close to its anchor,
// bands evenly loaded, editor corner controls avoided), tied to
// its anchor in the scene by a leader ("Ligne", always drawn for the selected
// photo) and / or its display number ("Numéro"). The zones are fixed and the
// tiles centred in them: nothing follows the camera. A tile click selects the
// annotation, the selected tile offers "Fullscreen", a hovered tile 4 small
// toggles for the edge the photo snaps to (none = automatic). A hovered zone
// shows its dashed outline and 3 handles: thickness (inner edge) and the two ends
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

  const getOriginRect = useCallback(
    () => rootRef.current?.getBoundingClientRect() ?? null,
    []
  );
  // Hovered zone: dashed outline + thickness / ends handles.
  const zoneResize = usePrintZonesResize({
    active,
    zones,
    rect,
    getOriginRect,
    onPatch: (side, patch) => dispatch(setPrintZonesZone({ side, patch })),
  });

  // handlers

  function handleSnapSideChange(annotation, side) {
    dispatch(setPrintZonesImagePinnedSide({ id: annotation.id, side }));
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
                transition: zoneResize.resizing
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
                snapSide={t.pinned ? t.side : null}
                onSnapSideChange={handleSnapSideChange}
                onSelect={handleSelect}
                onFullscreen={(a) => setFullscreenImageId(a.id)}
              />
            </Box>
          );
        })}

        {/* Hovered zone: dashed outline + thickness / ends handles. */}
        {zoneResize.outline && (
          <Box
            sx={{
              position: "absolute",
              left: zoneResize.outline.x,
              top: zoneResize.outline.y,
              width: zoneResize.outline.width,
              height: zoneResize.outline.height,
              boxSizing: "border-box",
              border: "1.5px dashed",
              borderColor: "primary.main",
              borderRadius: 2,
              pointerEvents: "none",
            }}
          />
        )}
        {zoneResize.handles.map((h) => (
          <Box
            key={h.kind}
            {...zoneResize.getHandleProps(h.kind)}
            sx={{
              position: "absolute",
              left: h.x,
              top: h.y,
              width: h.width,
              height: h.height,
              boxSizing: "border-box",
              bgcolor: "common.white",
              border: "1.5px solid",
              borderColor: "primary.main",
              borderRadius: "4px",
              boxShadow: 1,
              cursor: h.cursor,
              pointerEvents: "auto",
              touchAction: "none",
            }}
          />
        ))}
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
