import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  Straighten as StraightenIcon,
} from "@mui/icons-material";
import IconSegmentDrag from "Features/icons/IconSegmentDrag";

import {
  setAnglesLocked,
  setSegmentDragEnabled,
  setShowSegmentCotes,
} from "Features/mapEditor/mapEditorSlice";

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
// STRIP in EDIT (Modification) mode — cotes always on, single angle padlock —
// and in "no mode" (interactionMode null), where the overlay above the
// annotation grows to 3 toggles: show/hide cotes (default hidden), enable
// segment drag, angle padlock. Shared by NodePolylineStatic and
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
//
// `simple` + `onCommitLength` (OPENING annotations, NodeOpeningStatic): a
// single editable cote with no padlocks and no drag / angle toggles — the
// value is committed through the given callback ({ seg, targetMeters,
// dispatch }) → { ok, reason } instead of the contour solver. The no-mode
// show/hide cotes toggle is kept so the cote can be revealed from the
// opening itself.
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
  simple = false,
  onCommitLength,
}) {
  // data

  const dispatch = useDispatch();
  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );

  // Global angle lock (mapEditorSlice, default unlocked): vertex / segment
  // drags preserve the joint angles. The padlock rendered above the
  // annotation toggles it for the whole session.
  const anglesLocked = useSelector((s) => s.mapEditor.anglesLocked);

  // "No mode" overlay toggles (mapEditorSlice, session-wide like anglesLocked).
  const showSegmentCotes = useSelector((s) => s.mapEditor.showSegmentCotes);
  const segmentDragEnabled = useSelector(
    (s) => s.mapEditor.segmentDragEnabled
  );

  // Multi-selection: the no-mode overlay targets ONE annotation — with
  // several selected, each node would grow its own toolbar. Hide it (cotes
  // included) until the selection is back to a single annotation.
  const hasMultiSelection = useSelector(
    (s) => (s.selection?.selectedItems?.length ?? 0) > 1
  );

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

  const isNoMode = interactionMode == null;
  const baseActive =
    Boolean(selected) &&
    !printMode &&
    !isTransient &&
    !disableVertexEditing &&
    Boolean(annotationId) &&
    !String(annotationId).startsWith("temp");

  // Cote labels + per-point padlocks: EDIT always shows them; no-mode only
  // when the overlay's cote toggle is on.
  const labelsActive =
    baseActive &&
    hasScale &&
    (interactionMode === "EDIT" || (isNoMode && showSegmentCotes));

  // Top overlay: EDIT keeps its single angle padlock (scale required, as
  // before); no-mode shows the 3-toggle toolbar on THE selected annotation
  // (hidden on multi-selection).
  const overlayActive =
    baseActive &&
    (interactionMode === "EDIT" ? hasScale : isNoMode && !hasMultiSelection);

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const items = useMemo(() => {
    if (!labelsActive) return [];
    return getSegmentLengthItems({
      points,
      closed,
      meterByPx: baseMapMeterByPx,
      unit,
      decimals,
    });
  }, [labelsActive, points, closed, baseMapMeterByPx, unit, decimals]);

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

      // Custom commit (opening width): no locks, no contour solver.
      if (onCommitLength) {
        const custom = await onCommitLength({
          seg,
          targetMeters: typed * factor,
          dispatch,
        });
        if (custom?.ok === false) {
          flashConflict(seg.startPointId, custom.reason);
          return;
        }
        closeEditor();
        return;
      }

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
        anglesLocked,
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
      anglesLocked,
      annotation,
      closed,
      baseMapMeterByPx,
      dispatch,
      flashConflict,
      closeEditor,
      onCommitLength,
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

  // EDIT keeps its historical all-or-nothing visual (no straight segment →
  // nothing at all); no-mode shows the overlay toolbar regardless.
  if (
    !overlayActive ||
    (interactionMode === "EDIT" && !straightItems.length)
  )
    return null;

  // Simple mode (opening): the toolbar only carries the no-mode cotes toggle
  // — nothing to show in EDIT (no angle padlock) or without a scale.
  const showToolbar =
    Boolean(angleLockAnchor) && (!simple || (isNoMode && hasScale));

  return (
    <g data-segment-lengths="1">
      {/* per-segment length labels / inline editor */}
      {labelsActive &&
        straightItems.map((seg) => {
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
                    {!simple && (
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
                    )}
                  </div>
                </foreignObject>
              ) : (
                (() => {
                  // Estimated label footprint (13px font ≈ 7.2px/char) — good
                  // enough to size the readability background and place the
                  // inline padlock; SVG has no cheap text measurement.
                  const textW = seg.text.length * 7.2;
                  const lockW = simple ? 0 : 14;
                  const totalW = simple ? textW : lockW + 2 + textW;
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
                      {!simple && (
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
                      )}
                      <text
                        x={simple ? left : left + lockW + 2}
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

      {/* Overlay above the annotation (session-wide toggles, mapEditorSlice).
          EDIT: single ANGLE padlock — preserves the joint angles during
          vertex / segment drags and typed length edits (default: unlocked).
          No-mode: 3 toggles — show/hide cotes, enable segment drag, angle
          padlock. Rendered as HTML buttons in a foreignObject so they get
          real MUI Tooltips. */}
      {showToolbar && (
        <g
          transform={`translate(${angleLockAnchor.x}, ${angleLockAnchor.y})`}
        >
          <g style={{ transform: counterScaleTransform }}>
            <foreignObject
              x={isNoMode ? -58 : -20}
              y={-50}
              width={isNoMode ? 116 : 40}
              height={40}
              style={{ overflow: "visible" }}
            >
              <div
                data-interaction="ui-overlay"
                {...overlayGuards}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                {isNoMode && hasScale && (
                  <Tooltip
                    placement="top"
                    arrow
                    title="Afficher / Masquer les cotes"
                  >
                    <IconButton
                      size="small"
                      onClick={() =>
                        dispatch(setShowSegmentCotes(!showSegmentCotes))
                      }
                      sx={{
                        bgcolor: "rgba(255,255,255,0.9)",
                        border: `1px solid ${ACCENT_COLOR}`,
                        color: showSegmentCotes
                          ? ACCENT_COLOR
                          : "text.disabled",
                        "&:hover": { bgcolor: "white" },
                        p: 0.5,
                      }}
                    >
                      <StraightenIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {isNoMode && !simple && (
                  <Tooltip
                    placement="top"
                    arrow
                    title={
                      segmentDragEnabled
                        ? "Déplacement de segment activé : glisser un segment le déplace. Cliquer pour désactiver."
                        : "Déplacement de segment désactivé : survoler un segment permet d'y ajouter un point. Cliquer pour activer."
                    }
                  >
                    <IconButton
                      size="small"
                      onClick={() =>
                        dispatch(setSegmentDragEnabled(!segmentDragEnabled))
                      }
                      sx={{
                        bgcolor: "rgba(255,255,255,0.9)",
                        border: `1px solid ${ACCENT_COLOR}`,
                        color: segmentDragEnabled
                          ? ACCENT_COLOR
                          : "text.disabled",
                        "&:hover": { bgcolor: "white" },
                        p: 0.5,
                      }}
                    >
                      <IconSegmentDrag sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                )}
                {!simple && (
                <Tooltip
                  placement="top"
                  arrow
                  title={
                    anglesLocked
                      ? "Angles verrouillés : déplacer un point ou un segment, ou modifier une cote, conserve tous les angles (un rectangle reste un rectangle). Cliquer pour libérer les angles."
                      : "Angles libres : déplacer un point ou un segment, ou modifier une cote, peut déformer les angles. Cliquer pour verrouiller les angles."
                  }
                >
                  <IconButton
                    size="small"
                    onClick={() => dispatch(setAnglesLocked(!anglesLocked))}
                    sx={{
                      bgcolor: "rgba(255,255,255,0.9)",
                      border: `1px solid ${ACCENT_COLOR}`,
                      color: anglesLocked ? ACCENT_COLOR : "text.disabled",
                      "&:hover": { bgcolor: "white" },
                      p: 0.5,
                    }}
                  >
                    {anglesLocked ? (
                      <LockIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <LockOpenIcon sx={{ fontSize: 18 }} />
                    )}
                  </IconButton>
                </Tooltip>
                )}
              </div>
            </foreignObject>
          </g>
        </g>
      )}

      {/* per-point padlocks (arc control points excluded: locking a control
          point is meaningless in v1) */}
      {labelsActive &&
        !simple &&
        points.map((pt, i) => {
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
