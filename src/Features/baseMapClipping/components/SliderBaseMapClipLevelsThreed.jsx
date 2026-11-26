import { useEffect, useLayoutEffect, useRef } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";

import { Box, InputBase, Typography } from "@mui/material";

import db from "App/db/db";

import getBaseMapTransform from "Features/baseMaps/js/getBaseMapTransform";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";
import syncRevolutionAxesFromVerticalBaseMapService from "Features/revolutionAxes/services/syncRevolutionAxesFromVerticalBaseMapService";

import getBaseMapClipping3d from "../utils/getBaseMapClipping3d";
import getClipLevelsRange from "../utils/getClipLevelsRange";
import { getBaseMapClipBoxFaces } from "../services/baseMapClipBoxStore";
import { previewBaseMapClip } from "../services/baseMapClipPlanesStore";
import setBaseMapClipDepthService from "../services/setBaseMapClipDepthService";

const TRACK_HEIGHT_PX = 300;
const THUMB_PX = 16;
const KINDS = ["top", "z", "bottom"];

const roundMm = (v) => Math.round(v * 1e3) / 1e3;
// "1.5", "0.25", "12" — two decimals at most, no trailing zeros
const formatM = (v) => String(Math.round(v * 100) / 100);

// "12.5" / "12,5" → 12.5; "" → null; anything else → undefined.
function parseNumber(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Vertical slider of the clip levels of the selected base map, on the left
 * of the 3D editor — shown when the selected base map is HORIZONTAL and has
 * its « Plan de coupe » enabled. Three thumbs on one altitude scale:
 *   - « Z »: the altitude of the base map. Its clipping box is defined
 *     relative to it, so the two other thumbs follow in parallel;
 *   - « Haut » / « Bas »: the top / bottom faces of the box, as offsets
 *     from the base map (clipping3d.frontM / backM).
 * Each value is shown next to its thumb and can be typed (committed on
 * blur / Enter, never while typing).
 *
 * Real-time cut, no React state while dragging: a drag only touches the DOM
 * (thumb positions, input values), the base map group, the clip box faces
 * and the live clipping planes (previewBaseMapClip), then asks for one
 * render per animation frame. The db is written once, on release.
 */
export default function SliderBaseMapClipLevelsThreed({ enabled }) {
  // data

  const selectedBaseMapId = useSelector((s) => {
    const item = s.selection.selectedItems?.[0];
    return item?.type === "BASE_MAP" ? item.id : null;
  });
  const baseMapsUpdatedAt = useSelector((s) => s.baseMaps.baseMapsUpdatedAt);
  const record = useLiveQuery(
    async () =>
      selectedBaseMapId
        ? ((await db.baseMaps.get(selectedBaseMapId)) ?? null)
        : null,
    [selectedBaseMapId, baseMapsUpdatedAt]
  );

  // render

  if (
    !enabled ||
    !record ||
    record.id !== selectedBaseMapId ||
    record.deletedAt ||
    record.isPhoto ||
    !record.clipping3d?.enabled ||
    getBaseMapTransform(record).orientation !== "HORIZONTAL"
  ) {
    return null;
  }

  return <ClipLevelsSlider key={record.id} record={record} />;
}

function ClipLevelsSlider({ record }) {
  const dispatch = useDispatch();

  // strings

  const labels = { z: "Z", top: "Haut", bottom: "Bas" };
  const titles = {
    z: "Altitude du fond de plan (la boîte de coupe suit)",
    top: "Haut de la boîte de coupe, au-dessus du fond de plan",
    bottom: "Bas de la boîte de coupe, sous le fond de plan",
  };

  // data

  const baseMapId = record.id;
  const { position } = getBaseMapTransform(record);
  const { frontM, backM } = getBaseMapClipping3d(record);
  // committed levels (altitude of the base map + depths of its box)
  const levels = { z: position.y, frontM, backM };

  // The range is kept across renders while the levels stay inside it.
  const rangeRef = useRef(null);
  const sceneBox =
    getActiveThreedEditor()?.sceneManager?.clippingManager?.getSceneBox?.();
  const range = getClipLevelsRange({
    levels,
    sceneMinY: sceneBox?.min.y,
    sceneMaxY: sceneBox?.max.y,
    previous: rangeRef.current,
  });
  rangeRef.current = range;

  // refs (imperative layout)

  const rowRefs = useRef({});
  const inputRefs = useRef({});
  const barRef = useRef(null);
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const skipCommitRef = useRef(false);
  const levelsRef = useRef(levels);
  levelsRef.current = levels;

  // helpers

  const toPx = (altitude) =>
    ((range.max - altitude) / (range.max - range.min)) * TRACK_HEIGHT_PX;
  const clampAltitude = (altitude) =>
    Math.min(range.max, Math.max(range.min, altitude));

  // Thumb positions, box bar and input values for `lv` — DOM only.
  function layout(lv) {
    const altitudes = {
      z: lv.z,
      // no limit: the thumb waits at the end of the track
      top: lv.frontM === null ? range.max : lv.z + lv.frontM,
      bottom: lv.backM === null ? range.min : lv.z - lv.backM,
    };
    const px = {};
    KINDS.forEach((kind) => {
      px[kind] = toPx(clampAltitude(altitudes[kind]));
      const row = rowRefs.current[kind];
      if (row) row.style.transform = `translateY(${px[kind]}px)`;
    });
    if (barRef.current) {
      barRef.current.style.top = `${px.top}px`;
      barRef.current.style.height = `${Math.max(0, px.bottom - px.top)}px`;
    }
    const texts = {
      z: formatM(lv.z),
      top: lv.frontM === null ? "" : formatM(lv.frontM),
      bottom: lv.backM === null ? "" : formatM(lv.backM),
    };
    KINDS.forEach((kind) => {
      const input = inputRefs.current[kind];
      // never under the caret of a value being typed
      if (input && document.activeElement !== input) input.value = texts[kind];
    });
  }

  // 3D preview of `lv`: the base map group, its clip box faces and the live
  // clipping planes move in place; one render per animation frame.
  function applyLive(lv, kind) {
    const sceneManager = getActiveThreedEditor()?.sceneManager;
    if (kind === "z") {
      const group = sceneManager?.imagesManager?.getGroup(baseMapId);
      if (group) group.position.y = lv.z;
    } else {
      const side = kind === "top" ? "front" : "back";
      const depth = kind === "top" ? lv.frontM : lv.backM;
      const face = getBaseMapClipBoxFaces().find(
        (f) => f.baseMapId === baseMapId && f.side === side
      );
      if (face && depth !== null) face.setDepth(depth);
    }
    previewBaseMapClip(baseMapId, {
      positionY: lv.z,
      frontM: lv.frontM,
      backM: lv.backM,
    });
    layout(lv);
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      sceneManager?.renderScene?.();
    });
  }

  // Writes what changed between the committed levels and `lv` (one field).
  async function commit(lv, kind) {
    const committed = levelsRef.current;
    if (kind === "z") {
      if (Math.abs(lv.z - committed.z) < 1e-6) return;
      await db.baseMaps.update(baseMapId, {
        position: { x: position.x, y: lv.z, z: position.z },
      });
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      dispatch(triggerBaseMapsUpdate());
      await syncRevolutionAxesFromVerticalBaseMapService({
        baseMapId,
        dispatch,
      });
      return;
    }
    const depth = kind === "top" ? lv.frontM : lv.backM;
    if (depth === (kind === "top" ? committed.frontM : committed.backM)) return;
    await setBaseMapClipDepthService({
      baseMapId,
      side: kind === "top" ? "front" : "back",
      depthM: depth,
      dispatch,
    });
  }

  // handlers — drag

  function endDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    // the very listener added at grab time (handlers change per render)
    if (drag) window.removeEventListener("keydown", drag.onKeyDown, true);
    return drag;
  }

  function handleDragKeyDown(e) {
    if (e.key !== "Escape") return;
    const drag = endDrag();
    if (!drag) return;
    e.preventDefault();
    e.stopPropagation();
    applyLive(drag.start, drag.kind);
  }

  function handlePointerDown(kind, e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const start = { ...levelsRef.current };
    dragRef.current = {
      kind,
      onKeyDown: handleDragKeyDown,
      startY: e.clientY,
      start,
      live: start,
      // altitude the thumb starts from (a side without limit: track end)
      startAltitude:
        kind === "z"
          ? start.z
          : kind === "top"
            ? start.frontM === null
              ? range.max
              : start.z + start.frontM
            : start.backM === null
              ? range.min
              : start.z - start.backM,
    };
    window.addEventListener("keydown", handleDragKeyDown, true);
  }

  function handlePointerMove(e) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaM =
      (-(e.clientY - drag.startY) / TRACK_HEIGHT_PX) * (range.max - range.min);
    const altitude = clampAltitude(drag.startAltitude + deltaM);
    const { start } = drag;
    const live =
      drag.kind === "z"
        ? { ...start, z: roundMm(altitude) }
        : drag.kind === "top"
          ? { ...start, frontM: roundMm(Math.max(0, altitude - start.z)) }
          : { ...start, backM: roundMm(Math.max(0, start.z - altitude)) };
    drag.live = live;
    applyLive(live, drag.kind);
  }

  async function handlePointerUp() {
    const drag = endDrag();
    if (!drag) return;
    try {
      // The preview stays as is until the stored value comes back.
      await commit(drag.live, drag.kind);
    } catch (error) {
      console.error("[baseMapClipping] clip levels drag failed", error);
      applyLive(drag.start, drag.kind);
    }
  }

  function handlePointerCancel() {
    const drag = endDrag();
    if (drag) applyLive(drag.start, drag.kind);
  }

  // handlers — typed value (committed on blur)

  function handleInputKeyDown(e) {
    // the editor hotkeys never see what is typed here
    e.stopPropagation();
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      skipCommitRef.current = true;
      e.currentTarget.blur();
    }
  }

  async function handleInputBlur(kind, e) {
    const committed = levelsRef.current;
    if (skipCommitRef.current) {
      skipCommitRef.current = false;
      layout(committed);
      return;
    }
    const value = parseNumber(e.target.value);
    let next = null;
    if (kind === "z") {
      if (typeof value === "number") next = { ...committed, z: roundMm(value) };
    } else if (value === null || (typeof value === "number" && value >= 0)) {
      const depth = value === null ? null : roundMm(value);
      next =
        kind === "top"
          ? { ...committed, frontM: depth }
          : { ...committed, backM: depth };
    }
    if (!next) {
      layout(committed);
      return;
    }
    try {
      applyLive(next, kind);
      await commit(next, kind);
    } catch (error) {
      console.error("[baseMapClipping] clip level edit failed", error);
      applyLive(committed, kind);
    }
  }

  // effects

  // Committed values (or a new range) → DOM.
  useLayoutEffect(() => {
    if (!dragRef.current) layout(levels);
  }, [levels.z, levels.frontM, levels.backM, range.min, range.max]);

  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      const drag = dragRef.current;
      if (drag) window.removeEventListener("keydown", drag.onKeyDown, true);
    },
    []
  );

  // render

  return (
    <Box
      sx={{
        position: "absolute",
        left: 24,
        top: "50%",
        height: TRACK_HEIGHT_PX,
        transform: "translateY(-50%)",
        zIndex: 2,
        // only the thumbs and the value fields take the pointer
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {/* track */}
      <Box
        sx={{
          position: "absolute",
          left: THUMB_PX / 2 - 1,
          top: 0,
          bottom: 0,
          width: 2,
          borderRadius: 1,
          bgcolor: "text.disabled",
        }}
      />
      {/* clipping box, between the « Bas » and « Haut » thumbs */}
      <Box
        ref={barRef}
        sx={{
          position: "absolute",
          left: THUMB_PX / 2 - 3,
          width: 6,
          borderRadius: 1,
          bgcolor: "secondary.main",
          opacity: 0.35,
        }}
      />

      {KINDS.map((kind) => (
        <Box
          key={kind}
          ref={(el) => {
            rowRefs.current[kind] = el;
          }}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            height: 0,
            display: "flex",
            alignItems: "center",
            gap: 0.75,
            pointerEvents: "auto",
          }}
        >
          <Box
            role="slider"
            aria-label={titles[kind]}
            title={titles[kind]}
            onPointerDown={(e) => handlePointerDown(kind, e)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            sx={{
              width: THUMB_PX,
              height: THUMB_PX,
              flexShrink: 0,
              boxSizing: "border-box",
              borderRadius: "50%",
              border: "2px solid",
              borderColor: "secondary.main",
              bgcolor: kind === "z" ? "secondary.main" : "background.paper",
              boxShadow: 1,
              cursor: "ns-resize",
              touchAction: "none",
            }}
          />
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              px: 0.75,
              py: 0.25,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              boxShadow: 1,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: kind === "z" ? "bold" : "normal" }}
              noWrap
            >
              {labels[kind]}
            </Typography>
            <InputBase
              inputRef={(el) => {
                inputRefs.current[kind] = el;
              }}
              defaultValue=""
              placeholder={kind === "z" ? "" : "∞"}
              onKeyDown={handleInputKeyDown}
              onBlur={(e) => handleInputBlur(kind, e)}
              onFocus={(e) => e.target.select()}
              sx={{
                width: 44,
                "& .MuiInputBase-input": {
                  p: 0,
                  fontSize: 12,
                  textAlign: "right",
                },
              }}
            />
            <Typography variant="caption" color="text.secondary">
              m
            </Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
