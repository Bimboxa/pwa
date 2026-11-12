import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Box } from "@mui/material";

import MapTooltip from "Features/mapEditorGeneric/components/MapTooltip";

import getOverlayAnnotationNodeAtPoint from "../utils/getOverlayAnnotationNodeAtPoint";
import { OVERLAY_WRAPPER_ATTRIBUTE } from "../constants/baseMapOverlayConstants";

const TOOLTIP_OFFSET_PX = 15;
const IMAGE_NODE_TYPES = new Set(["BASE_MAP", "BASE_MAP_VERSION", "BG_IMAGE"]);

// Hover tooltip of the annotations of the base maps overlaid on the main one
// (consultation modules). The overlays are not pointer-interactive, so the
// editor's own hover (InteractionLayer) never sees them: this component runs
// its own geometric hit test on mouse move, only where the editor found no
// node of the main base map, and shows the same MapTooltip.
//
// Mounted as a direct child of the editor's root box (position: relative):
// that parent is the listened surface and the tooltip's positioning frame.
export default function OverlayAnnotationsTooltip({ overlays }) {
  // data

  const annotations = useMemo(
    () => (overlays ?? []).flatMap((overlay) => overlay.annotations ?? []),
    [overlays]
  );

  // state

  const [hoveredNode, setHoveredNode] = useState(null);
  const anchorRef = useRef(null);
  const tooltipRef = useRef(null);
  const positionRef = useRef({ x: 0, y: 0 });

  // helpers

  const hasAnnotations = annotations.length > 0;

  const applyPosition = () => {
    if (!tooltipRef.current) return;
    const { x, y } = positionRef.current;
    tooltipRef.current.style.transform = `translate(${x}px, ${y}px)`;
  };

  // effects

  useEffect(() => {
    const container = anchorRef.current?.parentElement;
    if (!container || !hasAnnotations) return;

    let frame = null;
    let lastEvent = null;

    const setNode = (node) =>
      setHoveredNode((prev) =>
        (prev?.nodeId ?? null) === (node?.nodeId ?? null) ? prev : node
      );

    // The pointer must be at rest over the editor's own svg, on no node of
    // the main base map (the editor's tooltip wins) and on no UI overlay.
    const isOverFreeCanvas = (event) => {
      if (event.buttons !== 0) return false;
      const target = event.target;
      const svg = container.querySelector(
        `[${OVERLAY_WRAPPER_ATTRIBUTE}]`
      )?.ownerSVGElement;
      if (!svg || !target?.closest || !svg.contains(target)) return false;
      // The main base map IMAGE is a node too (BASE_MAP, BASE_MAP_VERSION,
      // BG_IMAGE) and lies under everything: only the other nodes win.
      const nodeType = target.closest("[data-node-type]")?.dataset.nodeType;
      if (nodeType && !IMAGE_NODE_TYPES.has(nodeType)) return false;
      if (target.closest('[data-interaction="ui-overlay"]')) return false;
      return true;
    };

    const run = () => {
      frame = null;
      const event = lastEvent;
      if (!event) return;
      if (!isOverFreeCanvas(event)) {
        setNode(null);
        return;
      }
      const rect = container.getBoundingClientRect();
      positionRef.current = {
        x: event.clientX - rect.left + TOOLTIP_OFFSET_PX,
        y: event.clientY - rect.top + TOOLTIP_OFFSET_PX,
      };
      applyPosition();
      setNode(
        getOverlayAnnotationNodeAtPoint(container, event.clientX, event.clientY)
      );
    };

    const handleMove = (event) => {
      lastEvent = event;
      if (frame === null) frame = requestAnimationFrame(run);
    };
    const handleLeave = () => {
      lastEvent = null;
      setNode(null);
    };

    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mousedown", handleLeave);
    container.addEventListener("mouseleave", handleLeave);
    container.addEventListener("wheel", handleLeave, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mousedown", handleLeave);
      container.removeEventListener("mouseleave", handleLeave);
      container.removeEventListener("wheel", handleLeave);
      setHoveredNode(null);
    };
  }, [hasAnnotations]);

  // Position the tooltip as soon as it mounts (no jump from 0,0).
  useLayoutEffect(applyPosition, [hoveredNode]);

  // render

  return (
    <Box
      ref={anchorRef}
      sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {hoveredNode && (
        <MapTooltip
          ref={tooltipRef}
          hoveredNode={hoveredNode}
          annotations={annotations}
        />
      )}
    </Box>
  );
}
