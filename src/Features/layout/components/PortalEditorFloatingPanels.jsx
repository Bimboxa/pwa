import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import { EDITOR_FLOATING_PANELS_HOST_ID } from "../constants/editorFloatingPanelsHost";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";

// ---------------------------------------------------------------------------
// PortalEditorFloatingPanels — renders the floating panels of an editor
// (PopperMapListings, PopperBaseMapsList, PopperDrawingTools) in the
// layout-level host instead
// of inside the editor, so they:
// - are no longer clipped by the editors area (SectionViewer overflow) and
//   can be dragged over the top bar;
// - stack between the top bar and the panels sliding over the editors (see
//   constants/editorFloatingPanelsHost for the order).
//
// The panels keep their editor-relative layout (top / left / maxHeight in %):
// they render in a frame laid exactly over the editor box, measured from an
// in-place anchor. The measure follows the editor (resize, docked panels,
// module / 2D-3D switch — PanelShowable translates the hidden editor away,
// which no ResizeObserver reports, hence the viewer keys in the deps).
//
// `hidden` hides the panels without unmounting them (drag position, local
// state). Without a host (mobile layout) the panels render in place.
// ---------------------------------------------------------------------------

export default function PortalEditorFloatingPanels({
  hidden = false,
  children,
}) {
  // data

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);

  // state

  const anchorRef = useRef(null);
  // undefined = not looked up yet, null = no host (render in place)
  const [host, setHost] = useState(undefined);
  const [rect, setRect] = useState(null);

  // effects

  useLayoutEffect(() => {
    const hostEl = document.getElementById(EDITOR_FLOATING_PANELS_HOST_ID);
    setHost(hostEl ?? null);
    const editorEl = anchorRef.current?.parentElement;
    if (!hostEl || !editorEl) return;

    function measure() {
      const e = editorEl.getBoundingClientRect();
      const h = hostEl.getBoundingClientRect();
      const next = {
        left: Math.round(e.left - h.left),
        top: Math.round(e.top - h.top),
        width: Math.round(e.width),
        height: Math.round(e.height),
        // editor translated away by its PanelShowable (another one is shown)
        offScreen: e.left >= h.right || e.right <= h.left,
      };
      setRect((prev) =>
        prev &&
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height &&
        prev.offScreen === next.offScreen
          ? prev
          : next
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(editorEl);
    observer.observe(hostEl);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [viewerKey, effectiveViewerKey]);

  // render

  return (
    <>
      {/* In-place anchor: its parent is the editor box to lay the frame on. */}
      <Box ref={anchorRef} sx={{ display: "none" }} />
      {host === null && (
        <Box sx={{ display: hidden ? "none" : "contents" }}>{children}</Box>
      )}
      {host &&
        rect &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              display: hidden || rect.offScreen ? "none" : "block",
              // The frame covers the editor: only the panels take the mouse.
              pointerEvents: "none",
              "& > *": { pointerEvents: "auto" },
            }}
          >
            {children}
          </Box>,
          host
        )}
    </>
  );
}
