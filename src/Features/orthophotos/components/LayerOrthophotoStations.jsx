import { useEffect, useRef } from "react";

import { useDispatch, useSelector, useStore } from "react-redux";

import { setSelectedOrthophotoId } from "../orthophotosSlice";

import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import OpenWithIcon from "@mui/icons-material/OpenWith";

import db from "App/db/db";

import OrthophotoStationPill from "./OrthophotoStationPill";

import {
  baseMapNormalizedToClient,
  clientToBaseMapNormalized,
  getEditorHostRect,
  getMapHostSelector,
} from "Features/comments/utils/commentPinProjection";
import { get2dEditorKeyForModule } from "Features/viewers/utils/effectiveViewerKey";
import { isValidOrthophotoCorners } from "../utils/getOrthophotoPlacement";
import {
  getOrthophotoHoverColor,
  getOrthophotoHoverLineStyle,
} from "../utils/orthophotoHoverStyle";
import {
  getCornersCentre,
  moveCorner,
  rotateScaleCorners,
  translateCorners,
} from "../utils/transformOrthophotoCorners";

// Orthophotos under the cursor: thin outline of their rectified image and
// frame of their station label, one variation of the theme secondary colour
// per orthophoto (utils/orthophotoHoverStyle).
const HOVER_CLASS = "orthophoto-under-cursor";
const HOVER_COLOR_VAR = "--orthophoto-hover-color";
const HOVER_BORDER_STYLE_VAR = "--orthophoto-hover-border-style";

// Ray casting, in the normalized frame of the base map.
function isPointInQuad(point, quad) {
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const a = quad[i];
    const b = quad[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
}

const HANDLE_SIZE = 12;
const CENTRE_SIZE = 24;
const DRAG_THRESHOLD_PX = 3;

// Camera stations of the unit orthophotos, drawn over the displayed 2D
// editor as small framed labels ("P01"), plus — while an orthophoto is being
// adjusted from the Orthophotos tool — the outline of its rectified image
// with its handles.
// A DOM layer, not scene objects (same choice as the comment pins): crisp at
// any zoom, nothing to keep out of the annotations pipeline. Positions are
// written straight to the elements on every frame (no React render per
// camera move, nor per drag move).
// - click on a station: selects it (rectified image over the base map +
//   original photo in PopperOrthophoto), click again: deselects;
// - `editable` (Orthophotos tool opened): a station can be dragged;
// - handles of the adjusted orthophoto: centre = move, corner = rotate +
//   scale about the opposite corner, Alt + corner = that corner alone
//   (deforms the image). One db write on release;
// - hovering the base map: the outline of every rectified image holding the
//   hovered point, and the frame of its station label, are drawn with a thin
//   line — one variation of the secondary colour per orthophoto, solid /
//   tight dashes / spaced dashes as the cursor gets away from the station
//   (which photos rebuild this spot of the mosaic).
export default function LayerOrthophotoStations({
  orthophotos,
  mainBaseMap,
  editable = false,
}) {
  const dispatch = useDispatch();
  const store = useStore();
  const theme = useTheme();

  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const selectedOrthophotoId = useSelector(
    (s) => s.orthophotos.selectedOrthophotoId
  );
  const editedOrthophotoId = useSelector(
    (s) => s.orthophotos.editedOrthophotoId
  );

  // helpers

  const edited = editable
    ? orthophotos.find(
        (o) =>
          o.id === editedOrthophotoId && isValidOrthophotoCorners(o.corners)
      )
    : null;

  // state

  const rootRef = useRef(null);
  const pillElsRef = useRef(new Map());
  const cornerElsRef = useRef([]);
  const centreElRef = useRef(null);
  const outlineElRef = useRef(null);
  // live values of the gesture in progress, kept until the row re-emits
  const draftRef = useRef({ stations: {}, corners: null });
  // outlines of the orthophotos under the cursor (one polygon each)
  const hoverElsRef = useRef(new Map());
  // last pointer position, and whether it is over the editor
  const pointerRef = useRef({ x: 0, y: 0, over: false });
  const latestRef = useRef({});
  latestRef.current = { orthophotos, mainBaseMap, moduleKey, edited };

  // effects

  // the rows re-emitted: the stored values take over the drafts
  useEffect(() => {
    draftRef.current = { stations: {}, corners: null };
  }, [orthophotos]);

  // pointer tracking for the "orthophotos under the cursor" highlight: only
  // while the cursor is over the 2D editor (or one of the station labels),
  // never over a panel laid on it
  useEffect(() => {
    const handleMove = (e) => {
      const host = document.querySelector(
        getMapHostSelector(get2dEditorKeyForModule(latestRef.current.moduleKey))
      );
      const target = e.target;
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        over: Boolean(
          target instanceof Node &&
          (host?.contains(target) || rootRef.current?.contains(target))
        ),
      };
    };
    const handleLeave = () => {
      pointerRef.current = { ...pointerRef.current, over: false };
    };
    window.addEventListener("pointermove", handleMove, { passive: true });
    document.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerleave", handleLeave);
    };
  }, []);

  const active = orthophotos.length > 0;
  useEffect(() => {
    if (!active) return undefined;
    let rafId = null;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const root = rootRef.current;
      if (!root) return;
      const { orthophotos, mainBaseMap, moduleKey, edited } = latestRef.current;
      const rootRect = root.getBoundingClientRect();
      const hostRect = getEditorHostRect(
        getMapHostSelector(get2dEditorKeyForModule(moduleKey))
      );
      const basePose = store.getState().mapEditor.baseMapPoseInBg;
      const imageSize = mainBaseMap?.getImageSize?.();
      const toLocal = (point) => {
        if (!hostRect) return null;
        const client = baseMapNormalizedToClient({
          point,
          hostRect,
          basePose,
          imageSize,
        });
        return client
          ? { x: client.x - rootRect.left, y: client.y - rootRect.top, client }
          : null;
      };

      for (const orthophoto of orthophotos) {
        const el = pillElsRef.current.get(orthophoto.id);
        if (!el) continue;
        const p = toLocal(
          draftRef.current.stations[orthophoto.id] ?? orthophoto.station
        );
        const visible =
          p &&
          p.client.x >= hostRect.left &&
          p.client.x <= hostRect.right &&
          p.client.y >= hostRect.top &&
          p.client.y <= hostRect.bottom;
        if (!visible) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
      }

      // orthophotos under the cursor: every rectified image whose quad
      // holds the hovered point of the base map
      const pointer = pointerRef.current;
      const hovered =
        pointer.over && hostRect
          ? clientToBaseMapNormalized({
              clientX: pointer.x,
              clientY: pointer.y,
              hostRect,
              basePose,
              imageSize,
            })
          : null;
      for (const orthophoto of orthophotos) {
        const outlineEl = hoverElsRef.current.get(orthophoto.id);
        const pillEl = pillElsRef.current.get(orthophoto.id);
        const corners =
          draftRef.current.corners?.id === orthophoto.id
            ? draftRef.current.corners.corners
            : orthophoto.corners;
        const isUnder =
          Boolean(hovered) &&
          isValidOrthophotoCorners(corners) &&
          isPointInQuad(hovered, corners);
        const locals = isUnder ? corners.map(toLocal) : null;
        const show = Boolean(locals?.every(Boolean));
        // Line style: how close the cursor is to the camera station (the
        // centre of the rectified image when it has none), relative to the
        // reach of the image — solid near it, tight then spaced dashes.
        let lineStyle = null;
        if (show) {
          const station = toLocal(
            draftRef.current.stations[orthophoto.id] ??
              orthophoto.station ??
              getCornersCentre(corners)
          );
          const reach = station
            ? Math.max(
                ...locals.map((p) =>
                  Math.hypot(p.x - station.x, p.y - station.y)
                )
              )
            : 0;
          const distance = station
            ? Math.hypot(
                pointer.x - rootRect.left - station.x,
                pointer.y - rootRect.top - station.y
              )
            : 0;
          lineStyle = getOrthophotoHoverLineStyle(
            reach > 0 ? distance / reach : 0
          );
        }
        if (outlineEl) {
          outlineEl.style.visibility = show ? "visible" : "hidden";
          if (show) {
            outlineEl.setAttribute(
              "points",
              locals.map((p) => `${p.x},${p.y}`).join(" ")
            );
            outlineEl.setAttribute("stroke-dasharray", lineStyle.dashArray);
          }
        }
        if (pillEl) {
          pillEl.classList.toggle(HOVER_CLASS, show);
          if (show) {
            pillEl.style.setProperty(
              HOVER_BORDER_STYLE_VAR,
              lineStyle.borderStyle
            );
          }
        }
      }

      // outline + handles of the adjusted orthophoto
      if (!edited) return;
      const corners =
        draftRef.current.corners?.id === edited.id
          ? draftRef.current.corners.corners
          : edited.corners;
      const locals = corners.map(toLocal);
      const ok = locals.every(Boolean);
      const display = ok ? "visible" : "hidden";
      if (outlineElRef.current) {
        outlineElRef.current.style.visibility = display;
        if (ok) {
          outlineElRef.current.setAttribute(
            "points",
            locals.map((p) => `${p.x},${p.y}`).join(" ")
          );
        }
      }
      locals.forEach((p, i) => {
        const el = cornerElsRef.current[i];
        if (!el) return;
        el.style.visibility = display;
        if (ok) el.style.transform = `translate(${p.x}px, ${p.y}px)`;
      });
      if (centreElRef.current) {
        centreElRef.current.style.visibility = display;
        const c = ok ? toLocal(getCornersCentre(corners)) : null;
        if (c) {
          centreElRef.current.style.transform = `translate(${c.x}px, ${c.y}px)`;
        }
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active, store]);

  // handlers

  function clientToNormalized(e) {
    const { mainBaseMap, moduleKey } = latestRef.current;
    const hostRect = getEditorHostRect(
      getMapHostSelector(get2dEditorKeyForModule(moduleKey))
    );
    if (!hostRect) return null;
    return clientToBaseMapNormalized({
      clientX: e.clientX,
      clientY: e.clientY,
      hostRect,
      basePose: store.getState().mapEditor.baseMapPoseInBg,
      imageSize: mainBaseMap?.getImageSize?.(),
    });
  }

  // Pointer-captured gesture on `e.currentTarget`. `onMove(point, event)`
  // runs once the pointer left the click threshold; `onEnd(moved)` on release.
  function startGesture(e, { onMove, onEnd }) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    const start = { x: e.clientX, y: e.clientY };
    let moved = false;
    el.setPointerCapture?.(e.pointerId);

    const handleMove = (ev) => {
      if (
        !moved &&
        Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <
          DRAG_THRESHOLD_PX
      ) {
        return;
      }
      moved = true;
      const point = clientToNormalized(ev);
      if (point) onMove?.(point, ev);
    };
    const handleUp = (ev) => {
      el.releasePointerCapture?.(ev.pointerId);
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerup", handleUp);
      el.removeEventListener("pointercancel", handleUp);
      onEnd?.(moved);
    };
    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerup", handleUp);
    el.addEventListener("pointercancel", handleUp);
  }

  function handleStationPointerDown(e, orthophoto) {
    startGesture(e, {
      onMove: editable
        ? (point) => {
            draftRef.current.stations[orthophoto.id] = point;
          }
        : null,
      onEnd: (moved) => {
        const station = draftRef.current.stations[orthophoto.id];
        if (moved && editable && station) {
          db.orthophotos.update(orthophoto.id, { station });
          return;
        }
        dispatch(
          setSelectedOrthophotoId(
            orthophoto.id === selectedOrthophotoId ? null : orthophoto.id
          )
        );
      },
    });
  }

  function commitCorners() {
    const draft = draftRef.current.corners;
    if (draft) db.orthophotos.update(draft.id, { corners: draft.corners });
  }

  function handleCornerPointerDown(e, index) {
    if (!edited) return;
    const startCorners = edited.corners;
    const id = edited.id;
    startGesture(e, {
      onMove: (point, ev) => {
        draftRef.current.corners = {
          id,
          corners: ev.altKey
            ? moveCorner(startCorners, index, point)
            : rotateScaleCorners(
                startCorners,
                index,
                point,
                latestRef.current.mainBaseMap?.getImageSize?.()
              ),
        };
      },
      onEnd: (moved) => moved && commitCorners(),
    });
  }

  function handleCentrePointerDown(e) {
    if (!edited) return;
    const startCorners = edited.corners;
    const id = edited.id;
    const startPoint = clientToNormalized(e);
    if (!startPoint) return;
    startGesture(e, {
      onMove: (point) => {
        draftRef.current.corners = {
          id,
          corners: translateCorners(startCorners, {
            x: point.x - startPoint.x,
            y: point.y - startPoint.y,
          }),
        };
      },
      onEnd: (moved) => moved && commitCorners(),
    });
  }

  // render

  // one variation of the secondary colour per orthophoto
  const hoverColorById = new Map(
    orthophotos.map((orthophoto, index) => [
      orthophoto.id,
      getOrthophotoHoverColor(theme.palette.secondary.main, index),
    ])
  );

  const handleSx = {
    position: "absolute",
    left: 0,
    top: 0,
    visibility: "hidden",
    pointerEvents: "auto",
    touchAction: "none",
  };

  return (
    <Box
      ref={rootRef}
      data-capture-hide
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 9,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* outlines of the orthophotos under the cursor */}
      <Box
        component="svg"
        sx={{
          position: "absolute",
          inset: 0,
          width: 1,
          height: 1,
          pointerEvents: "none",
        }}
      >
        {orthophotos.map((orthophoto) => (
          <polygon
            key={orthophoto.id}
            ref={(el) => {
              if (el) hoverElsRef.current.set(orthophoto.id, el);
              else hoverElsRef.current.delete(orthophoto.id);
            }}
            fill="none"
            stroke={hoverColorById.get(orthophoto.id)}
            strokeWidth={1}
            strokeLinejoin="round"
            style={{ visibility: "hidden" }}
          />
        ))}
      </Box>

      {edited && (
        <>
          <Box
            component="svg"
            sx={{
              position: "absolute",
              inset: 0,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          >
            <polygon
              ref={outlineElRef}
              fill="none"
              stroke="#1565c0"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              style={{ visibility: "hidden" }}
            />
          </Box>
          {[0, 1, 2, 3].map((index) => (
            <Box
              key={index}
              ref={(el) => {
                cornerElsRef.current[index] = el;
              }}
              onPointerDown={(e) => handleCornerPointerDown(e, index)}
              sx={{
                ...handleSx,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                ml: `${-HANDLE_SIZE / 2}px`,
                mt: `${-HANDLE_SIZE / 2}px`,
                bgcolor: "common.white",
                border: "2px solid #1565c0",
                borderRadius: "2px",
                cursor: "crosshair",
              }}
            />
          ))}
          <Box
            ref={centreElRef}
            onPointerDown={handleCentrePointerDown}
            sx={{
              ...handleSx,
              width: CENTRE_SIZE,
              height: CENTRE_SIZE,
              ml: `${-CENTRE_SIZE / 2}px`,
              mt: `${-CENTRE_SIZE / 2}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#1565c0",
              color: "common.white",
              borderRadius: "50%",
              boxShadow: 2,
              cursor: "move",
            }}
          >
            <OpenWithIcon sx={{ fontSize: 16 }} />
          </Box>
        </>
      )}

      {orthophotos.map((orthophoto) => (
        <Box
          key={orthophoto.id}
          ref={(el) => {
            if (el) pillElsRef.current.set(orthophoto.id, el);
            else pillElsRef.current.delete(orthophoto.id);
          }}
          onPointerDown={(e) => handleStationPointerDown(e, orthophoto)}
          style={{ [HOVER_COLOR_VAR]: hoverColorById.get(orthophoto.id) }}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            // placed by the frame loop; hidden until its first pass
            visibility: "hidden",
            pointerEvents: "auto",
            touchAction: "none",
            // above the handles of the adjusted orthophoto
            zIndex: orthophoto.id === selectedOrthophotoId ? 2 : 1,
            // its rectified image is under the cursor: thin frame, in the
            // colour and the line style of its outline
            [`&.${HOVER_CLASS} > div::after`]: {
              content: '""',
              position: "absolute",
              inset: -3,
              borderRadius: "6px",
              border: "1px",
              borderStyle: `var(${HOVER_BORDER_STYLE_VAR}, solid)`,
              borderColor: `var(${HOVER_COLOR_VAR})`,
              pointerEvents: "none",
            },
          }}
        >
          <OrthophotoStationPill
            name={orthophoto.name}
            active={orthophoto.id === selectedOrthophotoId}
            draggable={editable}
          />
        </Box>
      ))}
    </Box>
  );
}
