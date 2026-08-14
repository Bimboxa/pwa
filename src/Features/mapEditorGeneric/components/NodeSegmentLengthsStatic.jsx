import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IconButton } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import { setAnglesLocked } from "Features/mapEditor/mapEditorSlice";

import getSegmentLengthItems from "Features/annotations/utils/getSegmentLengthItems";
import applySegmentLengthEditService from "Features/annotations/services/applySegmentLengthEditService";
import { typeOf } from "Features/geometry/utils/arcSampling";

// Inline length editor footprint, screen px. A <foreignObject> hit-tests only
// within its own box, so it must comfortably contain input + padlock.
const FIELD_W_PX = 116;
const FIELD_H_PX = 30;

const ACCENT_COLOR = "#2196f3";

// Below this on-screen segment length (px) the label starts fading out; fully
// gone 30px lower. A faded label is still clickable at the midpoint — accepted:
// the click only opens an editor.
const FADE_FULL_PX = 70;
const FADE_RANGE_PX = 30;

// Above this many straight segments, labels collapse to the ones adjacent to
// the selected vertex (ruler-style) — protects pathological imported contours.
const MAX_LABELED_SEGMENTS = 60;

const CONFLICT_MESSAGES = {
  BOTH_ENDPOINTS_LOCKED: "Les deux extrémités du segment sont verrouillées",
  LOCKED_CHAIN: "Impossible : tout est verrouillé, rien ne peut absorber",
  DEGENERATE_SEGMENT: "Segment de longueur nulle",
  INVALID_INPUT: "Valeur invalide",
};

// Per-segment length labels + inline editor for a selected POLYLINE / POLYGON /
// STRIP in EDIT (Modification) mode. Shared by NodePolylineStatic and
// NodeStripStatic; the RULER keeps its own vertex-driven editor.
//
// Constraint model: padlocks per SEGMENT (length stays fixed → rigid
// translation through it) and per POINT (must not move). UI-only session
// state, like the ruler's padlocks — an editing intent, not annotation data.
// Locks are keyed by point ID (not index) so inserting / deleting a vertex
// mid-session cannot silently shift a lock onto another segment / point.
//
// `points` must be the SAME resolved array as `annotation.points` (the id →
// index mapping done at commit time indexes into what the service reads).
export default function NodeSegmentLengthsStatic({
  annotation,
  points = [],
  closed = false,
  selected,
  selectedPointId,
  baseMapMeterByPx,
  containerK = 1,
  printMode,
  isTransient,
  disableVertexEditing = false,
}) {
  // data

  const dispatch = useDispatch();
  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );

  // Global angle lock (mapEditorSlice, default true): vertex / segment drags
  // preserve the joint angles. The padlock rendered above the annotation
  // toggles it for the whole session.
  const anglesLocked = useSelector((s) => s.mapEditor.anglesLocked);

  const annotationId = annotation?.id;
  const unit = annotation?.unit ?? "M";
  const decimals = annotation?.decimals ?? 2;

  // state

  const [lockedSegmentsByStartId, setLockedSegmentsByStartId] = useState({});
  const [lockedPointIds, setLockedPointIds] = useState({});
  const [editingSegmentId, setEditingSegmentId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [conflict, setConflict] = useState(null); // { segmentId, reason }
  const conflictTimerRef = useRef(null);

  // Locks survive editing several segments in one session; they only reset
  // when the edited annotation changes.
  useEffect(() => {
    setLockedSegmentsByStartId({});
    setLockedPointIds({});
    setEditingSegmentId(null);
    setEditValue("");
    setConflict(null);
  }, [annotationId]);

  useEffect(() => () => clearTimeout(conflictTimerRef.current), []);

  // While an editor is open, the first click OUTSIDE it must only commit the
  // value (the native focus transfer blurs the input) — NOT reach the map,
  // where it would clear the selection and hide every cote. Window-capture
  // listeners run before the React handlers attached at the app root, so
  // stopping propagation here hides the whole click sequence (down / up /
  // click) from InteractionLayer. The default action is never prevented: the
  // focus change IS what triggers the commit.
  useEffect(() => {
    if (!editingSegmentId) return undefined;

    const stop = (e) => e.stopPropagation();
    let sequenceActive = false;

    const releaseSequence = () => {
      sequenceActive = false;
      window.removeEventListener("pointerup", stop, true);
      window.removeEventListener("mouseup", onUpCapture, true);
      window.removeEventListener("click", onClickCapture, true);
    };
    const onClickCapture = (e) => {
      e.stopPropagation();
      releaseSequence();
    };
    const onUpCapture = (e) => {
      e.stopPropagation();
      // `click` fires right after mouseup and does the release; the timeout
      // only covers gestures where the browser skips the click event
      // (release over another element after a drag).
      setTimeout(releaseSequence, 0);
    };
    const onDownCapture = (e) => {
      // Clicks on any ui-overlay (this editor, another cote label, a
      // padlock) already protect the selection themselves — let them through
      // so e.g. clicking another cote commits this one AND opens the next.
      if (e.target?.closest?.('[data-interaction="ui-overlay"]')) return;
      e.stopPropagation();
      if (!sequenceActive) {
        sequenceActive = true;
        window.addEventListener("pointerup", stop, true);
        window.addEventListener("mouseup", onUpCapture, true);
        window.addEventListener("click", onClickCapture, true);
      }
    };

    window.addEventListener("pointerdown", onDownCapture, true);
    window.addEventListener("mousedown", onDownCapture, true);
    return () => {
      window.removeEventListener("pointerdown", onDownCapture, true);
      window.removeEventListener("mousedown", onDownCapture, true);
      // The up/click swallow listeners deliberately survive this cleanup:
      // the commit closes the editor (re-running this effect) between the
      // dismissing mousedown and its mouseup/click — removing them here
      // would let the tail of the gesture reach the map and deselect anyway.
    };
  }, [editingSegmentId]);

  // helpers

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;

  const active =
    Boolean(selected) &&
    !printMode &&
    !isTransient &&
    !disableVertexEditing &&
    hasScale &&
    interactionMode === "EDIT" &&
    Boolean(annotationId) &&
    !String(annotationId).startsWith("temp");

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const items = useMemo(() => {
    if (!active) return [];
    return getSegmentLengthItems({
      points,
      closed,
      meterByPx: baseMapMeterByPx,
      unit,
      decimals,
    });
  }, [active, points, closed, baseMapMeterByPx, unit, decimals]);

  const straightItems = useMemo(() => {
    const straight = items.filter((it) => it.isStraight);
    if (straight.length <= MAX_LABELED_SEGMENTS) return straight;
    if (!selectedPointId) return [];
    return straight.filter(
      (it) =>
        it.startPointId === selectedPointId || it.endPointId === selectedPointId
    );
  }, [items, selectedPointId]);

  // Anchor of the global angle padlock: top-center of the contour bbox,
  // pushed up by a screen-px offset so it never covers a vertex.
  const angleLockAnchor = useMemo(() => {
    const pts = (points || []).filter(
      (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
    );
    if (!pts.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
    }
    return { x: (minX + maxX) / 2, y: minY };
  }, [points]);

  const flashConflict = useCallback((segmentId, reason) => {
    clearTimeout(conflictTimerRef.current);
    setConflict({ segmentId, reason });
    conflictTimerRef.current = setTimeout(() => setConflict(null), 1800);
  }, []);

  // handlers

  const openEditor = useCallback((seg) => {
    setEditingSegmentId(seg.startPointId);
    setEditValue(stripUnit(seg.text));
    setConflict(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingSegmentId(null);
    setEditValue("");
  }, []);

  const commitEdit = useCallback(
    async (seg) => {
      const raw = editValue;
      const typed = Number(String(raw).replace(",", "."));
      if (raw === "" || !Number.isFinite(typed) || typed <= 0) {
        closeEditor();
        return;
      }

      // The field reads in the display unit; the service works in meters.
      const factor = unit === "M" ? 1 : unit === "MM" ? 0.001 : 0.01;

      // Locks are stored by point id; the solver works on indexes into the
      // very array the service reads (annotation.points === points).
      const indexByPointId = new Map();
      points.forEach((p, i) => {
        if (p?.id) indexByPointId.set(p.id, i);
      });
      const lockedSegmentIndexes = new Set();
      for (const it of items) {
        if (lockedSegmentsByStartId[it.startPointId])
          lockedSegmentIndexes.add(it.index);
      }
      const lockedPointIndexes = new Set();
      for (const id of Object.keys(lockedPointIds)) {
        if (lockedPointIds[id] && indexByPointId.has(id))
          lockedPointIndexes.add(indexByPointId.get(id));
      }

      const result = await applySegmentLengthEditService({
        annotation,
        closed,
        segmentIndex: seg.index,
        targetMeters: typed * factor,
        meterByPx: baseMapMeterByPx,
        lockedSegmentIndexes,
        lockedPointIndexes,
        dispatch,
      });

      if (result?.ok === false) {
        flashConflict(seg.startPointId, result.reason);
        return; // keep the editor open so the user can adjust locks
      }
      closeEditor();
    },
    [
      editValue,
      unit,
      points,
      items,
      lockedSegmentsByStartId,
      lockedPointIds,
      annotation,
      closed,
      baseMapMeterByPx,
      dispatch,
      flashConflict,
      closeEditor,
    ]
  );

  const handleFieldKeyDown = useCallback(
    (e) => {
      // Map hotkeys must not fire while typing a length.
      e.stopPropagation();
      if (e.key === "Enter") {
        // Single commit path: blur → onBlur → commitEdit.
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        // Discard: closing the editor unmounts the input, so no blur commit
        // fires (React flushes this update before any further discrete event).
        e.preventDefault();
        closeEditor();
      }
    },
    [closeEditor]
  );

  // The overlay must not read as a click on the annotation: InteractionLayer's
  // capture-phase mousedown skips anything inside a `ui-overlay`, and the
  // bubbling mouseup / click are stopped here — otherwise the mouseup would
  // clear the selection and close the editor as soon as it is touched.
  const overlayGuards = {
    onPointerDown: (e) => e.stopPropagation(),
    onPointerUp: (e) => e.stopPropagation(),
    onMouseDown: (e) => e.stopPropagation(),
    onMouseUp: (e) => e.stopPropagation(),
    onClick: (e) => e.stopPropagation(),
  };

  // render

  if (!active || !straightItems.length) return null;

  return (
    <g data-segment-lengths="1">
      {/* per-segment length labels / inline editor */}
      {straightItems.map((seg) => {
        const isEditing = editingSegmentId === seg.startPointId;
        const isLocked = Boolean(lockedSegmentsByStartId[seg.startPointId]);
        const hasConflict = conflict?.segmentId === seg.startPointId;

        // Zoom-reactive fade without JS: the live zoom only exists as the
        // --map-zoom CSS var, so the opacity is computed in CSS from unitless
        // numbers (on-screen length = zoom * containerK * pixelDistance).
        const fadeOpacity = `clamp(0, calc((var(--map-zoom, 1) * ${
          (containerK || 1) * seg.pixelDistance
        } - ${FADE_FULL_PX}) / ${FADE_RANGE_PX}), 1)`;

        return (
          <g
            key={`seg-length-${seg.startPointId ?? seg.index}`}
            transform={`translate(${seg.mid.x}, ${seg.mid.y})`}
            style={isEditing ? undefined : { opacity: fadeOpacity }}
          >
            <g style={{ transform: counterScaleTransform }}>
              {isEditing ? (
                <foreignObject
                  x={-FIELD_W_PX / 2}
                  y={-FIELD_H_PX / 2}
                  width={FIELD_W_PX}
                  height={FIELD_H_PX}
                  style={{ overflow: "visible" }}
                >
                  <div
                    data-interaction="ui-overlay"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                    }}
                    {...overlayGuards}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      autoFocus
                      value={editValue}
                      title={
                        hasConflict
                          ? CONFLICT_MESSAGES[conflict.reason] ??
                            "Édition impossible"
                          : undefined
                      }
                      onChange={(e) => {
                        setEditValue(e.target.value);
                        setConflict(null);
                      }}
                      onKeyDown={handleFieldKeyDown}
                      onBlur={() => commitEdit(seg)}
                      style={{
                        width: 68,
                        height: 24,
                        padding: "0 4px",
                        textAlign: "center",
                        fontSize: 13,
                        fontFamily:
                          '"Roboto", "Helvetica", "Arial", sans-serif',
                        border: `1px solid ${
                          hasConflict ? "#f44336" : ACCENT_COLOR
                        }`,
                        borderRadius: 4,
                        background: "#fff",
                        color: "#000",
                      }}
                    />
                    {/* Same lock affordance as the RULER cote fields: closed =
                        this segment keeps its length when ANOTHER segment is
                        edited (rigid translation through it). */}
                    <IconButton
                      size="small"
                      title={
                        isLocked
                          ? "Segment verrouillé : sa longueur est conservée lors des autres éditions"
                          : "Segment libre : il absorbera les autres éditions"
                      }
                      // Keep the focus in the field: letting the button take it
                      // would blur the input and commit the length with the
                      // PREVIOUS lock state.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={() =>
                        setLockedSegmentsByStartId((prev) => ({
                          ...prev,
                          [seg.startPointId]: !prev[seg.startPointId],
                        }))
                      }
                      sx={{
                        p: 0.25,
                        color: isLocked ? "action.active" : "text.disabled",
                      }}
                    >
                      {isLocked ? (
                        <LockIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <LockOpenIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </div>
                </foreignObject>
              ) : (
                (() => {
                  // Estimated label footprint (13px font ≈ 7.2px/char) — good
                  // enough to size the readability background and place the
                  // inline padlock; SVG has no cheap text measurement.
                  const textW = seg.text.length * 7.2;
                  const lockW = 14;
                  const totalW = lockW + 2 + textW;
                  const left = -totalW / 2;
                  return (
                    <g data-interaction="ui-overlay" {...overlayGuards}>
                      {/* Semi-transparent white backing so the value stays
                          readable on top of the segment stroke. */}
                      <rect
                        x={left - 4}
                        y={-10}
                        width={totalW + 8}
                        height={20}
                        rx={4}
                        fill="white"
                        fillOpacity={0.75}
                        pointerEvents="none"
                      />
                      {/* Inline padlock: locks the cote directly, without
                          opening the editor first. */}
                      <g
                        onClick={(e) => {
                          e.stopPropagation();
                          setLockedSegmentsByStartId((prev) => ({
                            ...prev,
                            [seg.startPointId]: !prev[seg.startPointId],
                          }));
                        }}
                        style={{ cursor: "pointer" }}
                        opacity={isLocked ? 1 : 0.4}
                      >
                        <title>
                          {isLocked
                            ? "Cote verrouillée : sa longueur est conservée lors des autres éditions"
                            : "Cote libre : cliquer pour verrouiller sa longueur"}
                        </title>
                        <rect
                          x={left - 2}
                          y={-9}
                          width={lockW + 4}
                          height={18}
                          fill="transparent"
                        />
                        <LockGlyph
                          x={left + lockW / 2}
                          y={0}
                          locked={isLocked}
                          color={ACCENT_COLOR}
                        />
                      </g>
                      <text
                        x={left + lockW + 2}
                        y={0}
                        textAnchor="start"
                        dominantBaseline="central"
                        fontSize={13}
                        fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                        fill={ACCENT_COLOR}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditor(seg);
                        }}
                        style={{ cursor: "pointer" }}
                      >
                        {seg.text}
                      </text>
                    </g>
                  );
                })()
              )}
            </g>
          </g>
        );
      })}

      {/* ANGLE padlock (session-wide) — preserves the joint angles during
          vertex / segment drags (default: locked). Lives in mapEditorSlice. */}
      {angleLockAnchor && (
        <g
          transform={`translate(${angleLockAnchor.x}, ${angleLockAnchor.y})`}
        >
          <g style={{ transform: counterScaleTransform }}>
            <g
              data-interaction="ui-overlay"
              {...overlayGuards}
              onClick={(e) => {
                e.stopPropagation();
                dispatch(setAnglesLocked(!anglesLocked));
              }}
              transform="translate(0, -30)"
              style={{ cursor: "pointer" }}
              opacity={anglesLocked ? 1 : 0.45}
            >
              <title>
                {anglesLocked
                  ? "Angles verrouillés : les déplacements de points et de segments conservent les angles"
                  : "Angles libres : les déplacements déforment les angles"}
              </title>
              <circle
                r={11}
                fill="white"
                fillOpacity={0.85}
                stroke={ACCENT_COLOR}
                strokeWidth={1}
              />
              <g transform="scale(1.4)">
                <LockGlyph
                  x={0}
                  y={0.5}
                  locked={anglesLocked}
                  color={ACCENT_COLOR}
                />
              </g>
            </g>
          </g>
        </g>
      )}

      {/* per-point padlocks (arc control points excluded: locking a control
          point is meaningless in v1) */}
      {points.map((pt, i) => {
        if (!pt?.id || typeOf(pt) === "circle") return null;
        const isLocked = Boolean(lockedPointIds[pt.id]);
        return (
          <g
            key={`pt-lock-${pt.id ?? i}`}
            transform={`translate(${pt.x}, ${pt.y})`}
          >
            <g style={{ transform: counterScaleTransform }}>
              <g
                data-interaction="ui-overlay"
                {...overlayGuards}
                onClick={(e) => {
                  e.stopPropagation();
                  setLockedPointIds((prev) => ({
                    ...prev,
                    [pt.id]: !prev[pt.id],
                  }));
                }}
                transform="translate(11, -11)"
                style={{ cursor: "pointer" }}
                opacity={isLocked ? 1 : 0.35}
              >
                <title>
                  {isLocked
                    ? "Point verrouillé : il ne bougera pas"
                    : "Point libre : cliquer pour le verrouiller"}
                </title>
                <circle r={7} fill="transparent" />
                <LockGlyph x={0} y={0} locked={isLocked} color={ACCENT_COLOR} />
              </g>
            </g>
          </g>
        );
      })}
    </g>
  );
}

// Tiny SVG padlock (≈10px), centered on (x, y). Open state lifts the shackle's
// right leg off the body.
function LockGlyph({ x = 0, y = 0, locked, color = "#2196f3" }) {
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        x={-3.5}
        y={-1}
        width={7}
        height={5.5}
        rx={1}
        fill={locked ? color : "none"}
        stroke={color}
        strokeWidth={1.2}
      />
      <path
        d={
          locked
            ? "M -2 -1 v -1.6 a 2 2 0 0 1 4 0 v 1.6"
            : "M -2 -1 v -1.6 a 2 2 0 0 1 4 0 v 0.4"
        }
        fill="none"
        stroke={color}
        strokeWidth={1.2}
        transform={locked ? undefined : "translate(0, -1.2)"}
      />
    </g>
  );
}

// The displayed value carries its unit suffix ("3.00 m"); the input edits the
// number alone.
function stripUnit(text) {
  if (typeof text !== "string") return "";
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) ? String(n) : "";
}
