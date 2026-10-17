import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";

import {
  setCommandsToolbarDock,
  setCommandsToolbarPosition,
} from "../commandsToolbarSlice";

// Distance (px) from an edge of the editors area under which the released
// toolbar docks on that edge.
export const DOCK_SNAP_PX = 24;
// Pointer travel before a docked toolbar is torn off.
const TEAR_OFF_PX = 4;

function clampPosition(pos, containerRect, toolbarRect) {
  if (!containerRect) return pos;
  const maxX = Math.max(0, containerRect.width - (toolbarRect?.width ?? 0));
  const maxY = Math.max(0, containerRect.height - (toolbarRect?.height ?? 0));
  return {
    x: Math.round(Math.min(Math.max(pos.x, 0), maxX)),
    y: Math.round(Math.min(Math.max(pos.y, 0), maxY)),
  };
}

// Dock to snap to for a toolbar box inside the editors area, or null.
export function getSnapDock(toolbarRect, containerRect) {
  if (!toolbarRect || !containerRect) return null;
  if (toolbarRect.top - containerRect.top < DOCK_SNAP_PX) return "TOP";
  if (containerRect.bottom - toolbarRect.bottom < DOCK_SNAP_PX) return "BOTTOM";
  if (toolbarRect.left - containerRect.left < DOCK_SNAP_PX) return "LEFT";
  return null;
}

// ---------------------------------------------------------------------------
// useToolbarDockDrag — drag of the unified commands toolbar by its grip
// (document mousemove / mouseup, like layout/hooks/usePanelDrag.js) with the
// SketchUp-like docking:
// - a docked toolbar tears off into FLOATING under the cursor on the first
//   real movement;
// - while floating it follows the cursor, clamped inside the editors area
//   (`containerRef`), and `snapDock` previews the edge it would dock on;
// - on release: within DOCK_SNAP_PX of the top / bottom / left edge it docks
//   there (the strip then reserves its space), else the floating position is
//   stored. Dock + position persist through the slice (localStorage).
// Returns the live floating position while dragging (the stored one
// otherwise is the caller's), so the toolbar moves without a dispatch per
// mousemove.
// ---------------------------------------------------------------------------
export default function useToolbarDockDrag({
  dock,
  position,
  containerRef,
  toolbarRef,
}) {
  const dispatch = useDispatch();

  // state

  const [dragPosition, setDragPosition] = useState(null);
  const [snapDock, setSnapDock] = useState(null);
  const dragRef = useRef(null);

  // handlers

  const handleGripMouseDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const containerRect = containerRef.current?.getBoundingClientRect();
      const toolbarRect = toolbarRef.current?.getBoundingClientRect();
      if (!containerRect) return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        // Grip offset inside the toolbar, kept under the cursor.
        grabDx: toolbarRect ? e.clientX - toolbarRect.left : 16,
        grabDy: toolbarRect ? e.clientY - toolbarRect.top : 16,
        tornOff: dock === "FLOATING",
        toolbarSize: toolbarRect
          ? { width: toolbarRect.width, height: toolbarRect.height }
          : null,
        lastPosition: position,
      };

      const handleMouseMove = (ev) => {
        const drag = dragRef.current;
        if (!drag) return;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (!drag.tornOff) {
          if (
            Math.abs(ev.clientX - drag.startX) < TEAR_OFF_PX &&
            Math.abs(ev.clientY - drag.startY) < TEAR_OFF_PX
          )
            return;
          drag.tornOff = true;
          // A docked strip is as wide as the area: once floating the toolbar
          // wraps to its max width, keep the grip under the cursor.
          drag.grabDx = Math.min(drag.grabDx, 16);
          drag.grabDy = Math.min(drag.grabDy, 16);
          dispatch(setCommandsToolbarDock("FLOATING"));
        }
        const raw = {
          x: ev.clientX - rect.left - drag.grabDx,
          y: ev.clientY - rect.top - drag.grabDy,
        };
        const tbRect = toolbarRef.current?.getBoundingClientRect();
        const next = clampPosition(raw, rect, tbRect);
        drag.lastPosition = next;
        setDragPosition(next);
        if (tbRect) {
          const previewRect = {
            top: rect.top + next.y,
            bottom: rect.top + next.y + tbRect.height,
            left: rect.left + next.x,
          };
          setSnapDock(getSnapDock(previewRect, rect));
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const drag = dragRef.current;
        dragRef.current = null;
        setDragPosition(null);
        setSnapDock(null);
        if (!drag?.tornOff) return;
        const rect = containerRef.current?.getBoundingClientRect();
        const tbRect = toolbarRef.current?.getBoundingClientRect();
        const target = getSnapDock(tbRect, rect);
        if (target) {
          dispatch(setCommandsToolbarDock(target));
        } else if (drag.lastPosition) {
          dispatch(setCommandsToolbarPosition(drag.lastPosition));
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dock, position, containerRef, toolbarRef, dispatch]
  );

  // effects — keep a floating toolbar inside the area when it resizes

  useEffect(() => {
    if (dock !== "FLOATING") return undefined;
    const containerEl = containerRef.current;
    if (!containerEl || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (dragRef.current) return;
      const rect = containerEl.getBoundingClientRect();
      const tbRect = toolbarRef.current?.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const next = clampPosition(position, rect, tbRect);
      if (next.x !== position.x || next.y !== position.y) {
        dispatch(setCommandsToolbarPosition(next));
      }
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  }, [dock, position, containerRef, toolbarRef, dispatch]);

  return {
    handleGripMouseDown,
    livePosition: dragPosition ?? position,
    isDragging: dragPosition != null,
    snapDock,
  };
}
