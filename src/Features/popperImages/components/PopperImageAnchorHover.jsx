import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";

import { Box, GlobalStyles, Paper, Popper, Typography } from "@mui/material";

import ImageIndexBadge from "./ImageIndexBadge";

import { buildImageAnnotationSelectionItem } from "../utils/imageAnnotationSelection";

// ---------------------------------------------------------------------------
// PopperImageAnchorHover — off in situ (overlay panel / print zones): the
// photo is not in the scene, only its anchor (numbered badge, or a dot
// without "Numéro"). Hovering that anchor shows the photo, its label and its
// description in a small popper above it, with a pointer cursor. The anchors
// are not DOM nodes in 3D (sprites that are never raycast), so the hit test
// runs in CLIENT px on the positions given by the anchorProjector (same
// contract as ImagesLinksOverlay; works for the 2D and the 3D editors).
// Never takes the mouse, excluded from captures. `selectOnClick` (3D, where
// the anchor cannot be picked): a click on the hovered anchor selects the
// photo — the 2D editor already does it through its TARGET interaction.
// ---------------------------------------------------------------------------

// Hit zone around the anchor, in screen px: the badge centred on it.
const HIT_HALF_WIDTH = 16;
const HIT_HALF_HEIGHT = 13;
// The popper sits above the badge.
const POPPER_OFFSET = HIT_HALF_HEIGHT + 4;
// A press + release this close is a click, not a drag.
const CLICK_MOVE_PX = 4;
const IMAGE_MAX_PX = 240;
// Floating UI of the app the pointer may be over while it is, on screen,
// above an anchor of the editor underneath.
const OVER_UI_SELECTOR =
  ".MuiPaper-root, .MuiPopover-root, .MuiDialog-root, .MuiDrawer-root";

export default function PopperImageAnchorHover({
  active,
  images,
  indexById,
  anchorProjector,
  selectOnClick = false,
}) {
  const dispatch = useDispatch();

  // state

  const [hovered, setHovered] = useState(null); // {id, x, y}
  const hoveredRef = useRef(null);
  const pointerRef = useRef(null);
  const pressRef = useRef(null); // {id, x, y}
  const imagesRef = useRef(images);
  imagesRef.current = images;
  const rafRef = useRef(null);

  // helpers

  const update = useCallback((next) => {
    const prev = hoveredRef.current;
    if (
      prev?.id === next?.id &&
      (prev?.x | 0) === (next?.x | 0) &&
      (prev?.y | 0) === (next?.y | 0)
    ) {
      return;
    }
    hoveredRef.current = next;
    setHovered(next);
  }, []);

  const compute = useCallback(() => {
    const pointer = pointerRef.current;
    if (!active || !anchorProjector || !pointer) return update(null);
    const vp = anchorProjector.getViewportRect?.();
    if (
      vp &&
      (pointer.x < vp.left ||
        pointer.x > vp.right ||
        pointer.y < vp.top ||
        pointer.y > vp.bottom)
    ) {
      return update(null);
    }
    let best = null;
    let bestD = Infinity;
    for (const a of images || []) {
      const p = anchorProjector.project(a);
      if (!p) continue;
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      if (Math.abs(dx) > HIT_HALF_WIDTH) continue;
      if (Math.abs(dy) > HIT_HALF_HEIGHT) continue;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = { id: a.id, x: p.x, y: p.y };
      }
    }
    return update(best);
  }, [active, anchorProjector, images, update]);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      compute();
    });
  }, [compute]);

  // Pointer + camera (a wheel zoom moves the anchors under a still pointer).
  useEffect(() => {
    if (!active) {
      pointerRef.current = null;
      update(null);
      return undefined;
    }
    function handlePointerMove(e) {
      // Dragging (orbit, pan, anchor drag), walk mode, or over a panel: off.
      const off =
        e.buttons !== 0 ||
        Boolean(document.pointerLockElement) ||
        Boolean(e.target?.closest?.(OVER_UI_SELECTOR));
      pointerRef.current = off ? null : { x: e.clientX, y: e.clientY };
      schedule();
    }
    function handlePointerOut() {
      pointerRef.current = null;
      schedule();
    }
    function handlePointerDown(e) {
      const hit = hoveredRef.current;
      pressRef.current =
        selectOnClick && hit && e.button === 0
          ? { id: hit.id, x: e.clientX, y: e.clientY }
          : null;
      handlePointerOut();
    }
    // Click on the hovered anchor (3D): select the photo. On `click`, after
    // the editor's own pointer handlers, so this selection wins.
    function handleClick(e) {
      const press = pressRef.current;
      pressRef.current = null;
      if (!press) return;
      if (
        Math.hypot(e.clientX - press.x, e.clientY - press.y) > CLICK_MOVE_PX
      ) {
        return;
      }
      const annotation = imagesRef.current?.find((a) => a.id === press.id);
      if (annotation) {
        dispatch(
          setSelectedItem(buildImageAnnotationSelectionItem(annotation))
        );
      }
    }
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("click", handleClick);
    const root = document.documentElement;
    root.addEventListener("pointerleave", handlePointerOut);
    const unsubscribe = anchorProjector?.subscribe?.(schedule);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("click", handleClick);
      root.removeEventListener("pointerleave", handlePointerOut);
      unsubscribe?.();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active, anchorProjector, schedule, update, selectOnClick, dispatch]);

  // data

  const annotation = useMemo(
    () => (hovered ? images?.find((a) => a.id === hovered.id) : null) ?? null,
    [images, hovered]
  );
  // Zero-size virtual anchor at the projected photo anchor.
  const virtualEl = useMemo(() => {
    if (!hovered) return null;
    const { x, y } = hovered;
    return {
      getBoundingClientRect: () => ({
        x,
        y,
        left: x,
        right: x,
        top: y,
        bottom: y,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }),
    };
  }, [hovered]);

  const src = annotation?.image?.imageUrlClient ?? annotation?.image?.thumbnail;

  // render

  if (!annotation || !virtualEl) return null;

  const description = annotation.labelDescription;

  return (
    <>
      {/* Over an anchor: pointer cursor, whatever the editor layer under. */}
      <GlobalStyles styles={{ "*": { cursor: "pointer !important" } }} />
      {src && (
        <Popper
          open
          anchorEl={virtualEl}
          placement="top"
          data-capture-hide
          modifiers={[
            { name: "offset", options: { offset: [0, POPPER_OFFSET] } },
            { name: "preventOverflow", options: { padding: 8 } },
          ]}
          sx={{ zIndex: "tooltip", pointerEvents: "none" }}
        >
          <Paper
            elevation={4}
            sx={{
              position: "relative",
              p: 0.5,
              // Same dark card as the annotation tooltip (MapTooltip).
              bgcolor: "rgba(0, 0, 0, 0.8)",
              color: "white",
              borderRadius: 1,
              overflow: "hidden",
            }}
          >
            <Box
              component="img"
              src={src}
              alt={annotation.label || ""}
              draggable={false}
              sx={{
                display: "block",
                maxWidth: IMAGE_MAX_PX,
                maxHeight: IMAGE_MAX_PX,
                borderRadius: 0.5,
                transform: annotation.imageFlipY ? "scaleY(-1)" : undefined,
              }}
            />
            <ImageIndexBadge
              number={indexById?.[annotation.id]}
              sx={{ position: "absolute", top: 10, left: 10 }}
            />
            {annotation.label && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  // The card takes the width of the photo: the caption never
                  // widens it, it wraps under the image.
                  width: 0,
                  minWidth: 1,
                  boxSizing: "border-box",
                  px: 0.5,
                  pt: 0.5,
                  fontWeight: 600,
                  lineHeight: 1.3,
                  whiteSpace: "pre-line",
                  overflowWrap: "anywhere",
                }}
              >
                {annotation.label}
              </Typography>
            )}
            {description && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  width: 0,
                  minWidth: 1,
                  boxSizing: "border-box",
                  px: 0.5,
                  pt: 0.25,
                  lineHeight: 1.3,
                  opacity: 0.75,
                  whiteSpace: "pre-line",
                  overflowWrap: "anywhere",
                }}
              >
                {description}
              </Typography>
            )}
          </Paper>
        </Popper>
      )}
    </>
  );
}
