import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import {
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
} from "@mui/icons-material";

import getSegmentLengthItems from "Features/annotations/utils/getSegmentLengthItems";
import getArcDimensionItems from "Features/annotations/utils/getArcDimensionItems";
import applySegmentLengthEditService from "Features/annotations/services/applySegmentLengthEditService";
import applyArcSagittaEditService from "Features/annotations/services/applyArcSagittaEditService";
import { typeOf } from "Features/geometry/utils/arcSampling";

// Inline length editor footprint, screen px. A <foreignObject> hit-tests only
// within its own box, so it must comfortably contain input + padlock.
const FIELD_W_PX = 116;
const FIELD_H_PX = 30;

const ACCENT_COLOR = "#2196f3";

// Overlay row geometry, screen px: MUI small IconButton with p: 0.5 around an
// 18px icon ≈ 34px, plus the flex gap. The row only hosts the buttons a host
// node passes (`extraButtons` — none today): the annotation commands and the
// view toggles live in the unified commands toolbar
// (Features/commandsToolbar).
const OVERLAY_BUTTON_PX = 34;
const OVERLAY_GAP_PX = 4;
const OVERLAY_H_PX = 40;
// Distance between the bbox top edge and the overlay bottom edge. Must clear
// the wrapper's rotation handle (AnnotationEditingWrapper, 50px above the
// bbox) when the move / resize wrapper is active.
const OVERLAY_OFFSET_PX = 50;
const OVERLAY_OFFSET_WRAPPER_PX = 94;

// Below this on-screen segment length (px) the label starts fading out; fully
// gone 30px lower. A faded label is still clickable at the midpoint — accepted:
// the click only opens an editor.
const FADE_FULL_PX = 70;
const FADE_RANGE_PX = 30;

// Above this many labelled items (straight segments + arcs), labels collapse
// to the ones adjacent to the selected vertex (ruler-style) — protects
// pathological imported contours.
const MAX_LABELED_SEGMENTS = 60;

// Arc cotes: dotted construction lines (chord P0 → P2 and sagitta chord
// midpoint → arc apex) + screen-px offsets pushing each label off the dotted
// line it measures.
const ARC_GUIDE_COLOR = "#424242";
const CHORD_LABEL_OFFSET_PX = 16;
const SAGITTA_LABEL_GAP_PX = 8;
// Estimated label footprint (13px font ≈ 7.2px/char) — good enough to size
// the readability background and place the inline padlock; SVG has no cheap
// text measurement.
const CHAR_W_PX = 7.2;

// Editing keys: a straight segment is keyed by its start point id, an arc's
// two cotes by kind + the id of its first square (P0).
const arcEditKey = (arc, kind) => `${kind}:${arc.startPointId}`;

// Padlock tooltips (closed / open) of a straight cote and of an arc chord.
const SEGMENT_LOCK_TITLES = {
  locked:
    "Cote verrouillée : sa longueur est conservée lors des autres éditions",
  open: "Cote libre : cliquer pour verrouiller sa longueur",
  editorLocked:
    "Segment verrouillé : sa longueur est conservée lors des autres éditions",
  editorOpen: "Segment libre : il absorbera les autres éditions",
};
const ARC_LOCK_TITLES = {
  locked:
    "Arc verrouillé : corde et flèche sont conservées lors des autres éditions",
  open: "Arc libre : cliquer pour verrouiller sa corde et sa flèche",
  editorLocked:
    "Arc verrouillé : corde et flèche sont conservées lors des autres éditions",
  editorOpen: "Arc libre : il absorbera les autres éditions (flèche conservée)",
};

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
// Arcs (square → circle → square triplets) get no label on their two stored
// halves; instead each arc shows two cotes on dotted construction lines: the
// CHORD (P0 → P2) and the SAGITTA (« flèche », chord midpoint → arc apex).
// Editing the chord goes through the contour solver with the arc collapsed to
// one span (computeContourLengthEdit) and keeps the sagitta; editing the
// sagitta only moves the circle control point (applyArcSagittaEditService).
// The chord padlock locks the whole arc; the sagitta has none.
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
  // Extra buttons appended to the overlay row by the host node.
  // `extraButtonCount` keeps the row centred on the bbox (drives the
  // foreignObject width).
  extraButtons = null,
  extraButtonCount = 0,
}) {
  // data

  const dispatch = useDispatch();
  const interactionMode = useSelector(
    (s) => s.popperMapListings?.interactionMode
  );

  // Global angle lock (mapEditorSlice, default unlocked): vertex / segment
  // drags preserve the joint angles — toggled from the commands toolbar.
  const anglesLocked = useSelector((s) => s.mapEditor.anglesLocked);

  // "No mode" cotes toggle (mapEditorSlice, session-wide, commands toolbar).
  const showSegmentCotes = useSelector((s) => s.mapEditor.showSegmentCotes);

  // Move / resize wrapper (mapEditorSlice, commands toolbar): the transform
  // frame rendered by EditedObjectLayer pushes the overlay row further up so
  // the rotation handle stays reachable.
  const wrapperMode = useSelector((s) => s.mapEditor.wrapperMode);

  // Multi-selection: the no-mode overlay row targets ONE annotation — with
  // several selected, each node would grow its own row.
  const hasMultiSelection = useSelector(
    (s) => (s.selection?.selectedItems?.length ?? 0) > 1
  );

  const annotationId = annotation?.id;
  const unit = annotation?.unit ?? "M";
  const decimals = annotation?.decimals ?? 2;

  // state

  const [lockedSegmentsByStartId, setLockedSegmentsByStartId] = useState({});
  const [lockedPointIds, setLockedPointIds] = useState({});
  // Straight: start point id; arcs: "chord:<P0 id>" / "sagitta:<P0 id>".
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [conflict, setConflict] = useState(null); // { key, reason }
  const conflictTimerRef = useRef(null);

  // Locks survive editing several segments in one session; they only reset
  // when the edited annotation changes.
  useEffect(() => {
    setLockedSegmentsByStartId({});
    setLockedPointIds({});
    setEditingKey(null);
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
    if (!editingKey) return undefined;

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
  }, [editingKey]);

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

  // Top overlay: EDIT shows the move toggle (single selection) and its angle
  // padlock (scale + straight segment required, as before); no-mode shows the
  // 4-toggle toolbar on THE selected annotation (hidden on multi-selection).
  const overlayActive =
    baseActive &&
    (interactionMode === "EDIT" || (isNoMode && !hasMultiSelection));

  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const items = useMemo(() => {
    if (!labelsActive) return [];
    // A vertical segment drawn in 3D (two consecutive refs to the same point
    // id) has no plan length: no label, and its start id stays free for the
    // next segment (lock / editor keys).
    return getSegmentLengthItems({
      points,
      closed,
      meterByPx: baseMapMeterByPx,
      unit,
      decimals,
    }).filter((it) => !it.startPointId || it.startPointId !== it.endPointId);
  }, [labelsActive, points, closed, baseMapMeterByPx, unit, decimals]);

  // Chord / sagitta items of the exact S-C-S arcs (empty without arcs).
  const arcItems = useMemo(() => {
    if (!labelsActive) return [];
    return getArcDimensionItems({
      points,
      closed,
      meterByPx: baseMapMeterByPx,
      unit,
      decimals,
    });
  }, [labelsActive, points, closed, baseMapMeterByPx, unit, decimals]);

  const straightCandidates = useMemo(
    () => items.filter((it) => it.isStraight),
    [items]
  );
  const tooManyLabels =
    straightCandidates.length + arcItems.length > MAX_LABELED_SEGMENTS;

  const straightItems = useMemo(() => {
    if (!tooManyLabels) return straightCandidates;
    if (!selectedPointId) return [];
    return straightCandidates.filter(
      (it) =>
        it.startPointId === selectedPointId || it.endPointId === selectedPointId
    );
  }, [straightCandidates, tooManyLabels, selectedPointId]);

  const visibleArcItems = useMemo(() => {
    if (!tooManyLabels) return arcItems;
    if (!selectedPointId) return [];
    return arcItems.filter(
      (it) =>
        it.startPointId === selectedPointId ||
        it.controlPointId === selectedPointId ||
        it.endPointId === selectedPointId
    );
  }, [arcItems, tooManyLabels, selectedPointId]);

  // Anchor of the overlay row: top-center of the contour bbox, pushed up by
  // a screen-px offset so it never covers a vertex.
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

  const flashConflict = useCallback((key, reason) => {
    clearTimeout(conflictTimerRef.current);
    setConflict({ key, reason });
    conflictTimerRef.current = setTimeout(() => setConflict(null), 1800);
  }, []);

  // handlers

  const openEditor = useCallback((key, text) => {
    setEditingKey(key);
    setEditValue(stripUnit(text));
    setConflict(null);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingKey(null);
    setEditValue("");
  }, []);

  // The field reads in the display unit; the services work in meters. Null
  // when the typed value is empty / not a positive number.
  const parseTypedMeters = useCallback(() => {
    const raw = editValue;
    const typed = Number(String(raw).replace(",", "."));
    if (raw === "" || !Number.isFinite(typed) || typed <= 0) return null;
    const factor = unit === "M" ? 1 : unit === "MM" ? 0.001 : 0.01;
    return typed * factor;
  }, [editValue, unit]);

  // Locks are stored by point id; the solver works on indexes into the very
  // array the service reads (annotation.points === points). A point id can
  // sit at two consecutive indexes (vertical segment drawn in 3D): a locked
  // point locks both. A locked arc chord locks both stored halves.
  const buildLockIndexes = useCallback(() => {
    const n = points.length;
    const indexesByPointId = new Map();
    points.forEach((p, i) => {
      if (!p?.id) return;
      if (!indexesByPointId.has(p.id)) indexesByPointId.set(p.id, []);
      indexesByPointId.get(p.id).push(i);
    });
    const lockedSegmentIndexes = new Set();
    for (const it of items) {
      if (it.isStraight && lockedSegmentsByStartId[it.startPointId])
        lockedSegmentIndexes.add(it.index);
    }
    for (const arc of arcItems) {
      if (!lockedSegmentsByStartId[arc.startPointId]) continue;
      lockedSegmentIndexes.add(arc.index);
      lockedSegmentIndexes.add((arc.index + 1) % n);
    }
    const lockedPointIndexes = new Set();
    for (const id of Object.keys(lockedPointIds)) {
      if (!lockedPointIds[id]) continue;
      for (const i of indexesByPointId.get(id) ?? []) lockedPointIndexes.add(i);
    }
    return { lockedSegmentIndexes, lockedPointIndexes };
  }, [points, items, arcItems, lockedSegmentsByStartId, lockedPointIds]);

  const commitEdit = useCallback(
    async (seg) => {
      const targetMeters = parseTypedMeters();
      if (targetMeters == null) {
        closeEditor();
        return;
      }

      // Custom commit (opening width): no locks, no contour solver.
      if (onCommitLength) {
        const custom = await onCommitLength({ seg, targetMeters, dispatch });
        if (custom?.ok === false) {
          flashConflict(seg.startPointId, custom.reason);
          return;
        }
        closeEditor();
        return;
      }

      const { lockedSegmentIndexes, lockedPointIndexes } = buildLockIndexes();
      const result = await applySegmentLengthEditService({
        annotation,
        closed,
        segmentIndex: seg.index,
        targetMeters,
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
      parseTypedMeters,
      buildLockIndexes,
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

  // Arc cotes: the chord goes through the contour solver (arc = one span, its
  // first stored half as segmentIndex); the sagitta only moves the control.
  const commitArcEdit = useCallback(
    async (arc, kind) => {
      const key = arcEditKey(arc, kind);
      const targetMeters = parseTypedMeters();
      if (targetMeters == null) {
        closeEditor();
        return;
      }

      let result;
      if (kind === "sagitta") {
        result = await applyArcSagittaEditService({
          annotation,
          closed,
          arcStartIndex: arc.index,
          targetMeters,
          meterByPx: baseMapMeterByPx,
          dispatch,
        });
      } else {
        const { lockedSegmentIndexes, lockedPointIndexes } = buildLockIndexes();
        result = await applySegmentLengthEditService({
          annotation,
          closed,
          segmentIndex: arc.index,
          targetMeters,
          meterByPx: baseMapMeterByPx,
          lockedSegmentIndexes,
          lockedPointIndexes,
          anglesLocked,
          dispatch,
        });
      }

      if (result?.ok === false) {
        flashConflict(key, result.reason);
        return;
      }
      closeEditor();
    },
    [
      parseTypedMeters,
      buildLockIndexes,
      anglesLocked,
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

  const toggleSegmentLock = (startPointId) =>
    setLockedSegmentsByStartId((prev) => ({
      ...prev,
      [startPointId]: !prev[startPointId],
    }));

  // One cote: label (with optional inline padlock) or its inline editor,
  // centred on `at` (map px) then shifted by `offsetPx` in SCREEN px (inside
  // the counter-scaled group). Shared by the straight segments, the arc chords
  // and the arc sagittas. `fadeLengthPx` drives the zoom fade (the measured
  // length for a segment, the chord for both arc cotes so a flat arc's
  // sagitta stays editable).
  const renderCote = ({
    key,
    at,
    offsetPx = { x: 0, y: 0 },
    text,
    fadeLengthPx,
    lockable = false,
    isLocked = false,
    onToggleLock,
    onCommit,
    lockTitles = SEGMENT_LOCK_TITLES,
  }) => {
    const isEditing = editingKey === key;
    const hasConflict = conflict?.key === key;

    // Zoom-reactive fade without JS: the live zoom only exists as the
    // --map-zoom CSS var, so the opacity is computed in CSS from unitless
    // numbers (on-screen length = zoom * containerK * pixelDistance).
    const fadeOpacity = `clamp(0, calc((var(--map-zoom, 1) * ${
      (containerK || 1) * fadeLengthPx
    } - ${FADE_FULL_PX}) / ${FADE_RANGE_PX}), 1)`;

    const textW = text.length * CHAR_W_PX;
    const lockW = lockable ? 14 : 0;
    const totalW = lockable ? lockW + 2 + textW : textW;
    const left = -totalW / 2;

    return (
      <g
        key={`cote-${key}`}
        transform={`translate(${at.x}, ${at.y})`}
        style={isEditing ? undefined : { opacity: fadeOpacity }}
      >
        <g style={{ transform: counterScaleTransform }}>
          <g transform={`translate(${offsetPx.x}, ${offsetPx.y})`}>
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
                        ? (CONFLICT_MESSAGES[conflict.reason] ??
                          "Édition impossible")
                        : undefined
                    }
                    onChange={(e) => {
                      setEditValue(e.target.value);
                      setConflict(null);
                    }}
                    onKeyDown={handleFieldKeyDown}
                    onBlur={onCommit}
                    style={{
                      width: 68,
                      height: 24,
                      padding: "0 4px",
                      textAlign: "center",
                      fontSize: 13,
                      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
                  {lockable && (
                    <IconButton
                      size="small"
                      title={
                        isLocked
                          ? lockTitles.editorLocked
                          : lockTitles.editorOpen
                      }
                      // Keep the focus in the field: letting the button take
                      // it would blur the input and commit the length with
                      // the PREVIOUS lock state.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onClick={onToggleLock}
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
                {/* Inline padlock: locks the cote directly, without opening
                    the editor first. */}
                {lockable && (
                  <g
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock?.();
                    }}
                    style={{ cursor: "pointer" }}
                    opacity={isLocked ? 1 : 0.4}
                  >
                    <title>
                      {isLocked ? lockTitles.locked : lockTitles.open}
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
                  x={lockable ? left + lockW + 2 : left}
                  y={0}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={13}
                  fontFamily='"Roboto", "Helvetica", "Arial", sans-serif'
                  fill={ACCENT_COLOR}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(key, text);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {text}
                </text>
              </g>
            )}
          </g>
        </g>
      </g>
    );
  };

  // render

  if (!overlayActive) return null;

  // Only the host's extra buttons remain in the row — drives the
  // foreignObject width so the group stays centered on the bbox.
  const overlayButtonCount = extraButtons ? extraButtonCount : 0;
  const overlayWidth =
    overlayButtonCount * OVERLAY_BUTTON_PX +
    Math.max(0, overlayButtonCount - 1) * OVERLAY_GAP_PX;
  const overlayOffset = wrapperMode
    ? OVERLAY_OFFSET_WRAPPER_PX
    : OVERLAY_OFFSET_PX;

  const showToolbar = Boolean(angleLockAnchor) && overlayButtonCount > 0;

  return (
    <g data-segment-lengths="1">
      {/* per-segment length labels / inline editor */}
      {labelsActive &&
        straightItems.map((seg) =>
          renderCote({
            key: seg.startPointId ?? `seg:${seg.index}`,
            at: seg.mid,
            text: seg.text,
            fadeLengthPx: seg.pixelDistance,
            lockable: !simple,
            isLocked: Boolean(lockedSegmentsByStartId[seg.startPointId]),
            onToggleLock: () => toggleSegmentLock(seg.startPointId),
            onCommit: () => commitEdit(seg),
          })
        )}

      {/* arc cotes: dotted chord + dotted sagitta, one editable label each.
          The chord label sits on the side opposite to the arc, the sagitta
          label beside its dotted line (along the chord direction). */}
      {labelsActive &&
        visibleArcItems.map((arc) => {
          const isLocked = Boolean(lockedSegmentsByStartId[arc.startPointId]);
          const sagittaMid = {
            x: (arc.chordMid.x + arc.arcMid.x) / 2,
            y: (arc.chordMid.y + arc.arcMid.y) / 2,
          };
          const sagittaShift =
            (arc.sagittaText.length * CHAR_W_PX) / 2 + SAGITTA_LABEL_GAP_PX;
          return (
            <g key={`arc-cotes-${arc.startPointId ?? arc.index}`}>
              <g pointerEvents="none">
                <line
                  x1={arc.P0.x}
                  y1={arc.P0.y}
                  x2={arc.P2.x}
                  y2={arc.P2.y}
                  stroke={ARC_GUIDE_COLOR}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={arc.chordMid.x}
                  y1={arc.chordMid.y}
                  x2={arc.arcMid.x}
                  y2={arc.arcMid.y}
                  stroke={ARC_GUIDE_COLOR}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
              {renderCote({
                key: arcEditKey(arc, "chord"),
                at: arc.chordMid,
                offsetPx: {
                  x: -arc.normal.x * CHORD_LABEL_OFFSET_PX,
                  y: -arc.normal.y * CHORD_LABEL_OFFSET_PX,
                },
                text: arc.chordText,
                fadeLengthPx: arc.chordPx,
                lockable: !simple,
                isLocked,
                onToggleLock: () => toggleSegmentLock(arc.startPointId),
                onCommit: () => commitArcEdit(arc, "chord"),
                lockTitles: ARC_LOCK_TITLES,
              })}
              {renderCote({
                key: arcEditKey(arc, "sagitta"),
                at: sagittaMid,
                offsetPx: {
                  x: arc.chordDir.x * sagittaShift,
                  y: arc.chordDir.y * sagittaShift,
                },
                text: arc.sagittaText,
                fadeLengthPx: arc.chordPx,
                lockable: false,
                onCommit: () => commitArcEdit(arc, "sagitta"),
              })}
            </g>
          );
        })}

      {/* per-point padlocks (arc control points excluded: locking a control
          point is meaningless in v1). EDIT keeps its historical gating: no
          straight segment → no padlocks either. */}
      {labelsActive &&
        !simple &&
        (interactionMode !== "EDIT" ||
          straightItems.length > 0 ||
          visibleArcItems.length > 0) &&
        points.map((pt, i) => {
          if (!pt?.id || typeOf(pt) === "circle") return null;
          // One padlock per plan position (vertical segment drawn in 3D).
          if (i > 0 && points[i - 1]?.id === pt.id) return null;
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
                      ? "Point gelé : il ne bougera pas, l'autre côté de la polyligne translate d'un bloc"
                      : "Point libre : cliquer pour le geler"}
                  </title>
                  <circle r={7} fill="transparent" />
                  <LockGlyph
                    x={0}
                    y={0}
                    locked={isLocked}
                    color={ACCENT_COLOR}
                  />
                </g>
              </g>
            </g>
          );
        })}

      {/* Overlay row above the annotation: the host node's extra buttons
          only (BASE_MAP_LINK link / flip) — the commands and the view toggles
          moved to the unified commands toolbar. HTML buttons in a
          foreignObject so they get real MUI Tooltips. While the wrapper is
          active the group is pushed further up so the rotation handle stays
          reachable. Rendered LAST in this node (after the padlocks) so it
          paints above the cotes / padlocks. */}
      {showToolbar && (
        <g transform={`translate(${angleLockAnchor.x}, ${angleLockAnchor.y})`}>
          <g style={{ transform: counterScaleTransform }}>
            <foreignObject
              x={-overlayWidth / 2}
              y={-overlayOffset}
              width={overlayWidth}
              height={OVERLAY_H_PX}
              style={{ overflow: "visible" }}
            >
              <div
                data-interaction="ui-overlay"
                {...overlayGuards}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: OVERLAY_GAP_PX,
                }}
              >
                {extraButtons}
              </div>
            </foreignObject>
          </g>
        </g>
      )}
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
