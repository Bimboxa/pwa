import { useRef, useLayoutEffect, useState, useEffect } from "react";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
import {
  getFreeTextFontStack,
  getFreeTextPageScale,
} from "Features/annotations/constants/freeTextConstants";

import db from "App/db/db";

// --- CONSTANTES ---
const DOT_RADIUS = 2;
const LINE_WIDTH = 1.5;
const LEADER_COLOR = "#000000";
const LEADER_OPACITY = 0.7;
const PADDING_X = 8;
const PADDING_Y = 4;
const SELECTION_COLOR = "#2196f3";
// Page-pt bounds (the box lives in "page points": PDF pt as if the base map
// filled an A4/A3 page — see getFreeTextPageScale).
const MIN_WIDTH = 20;
const MAX_WIDTH = 2000;

// FREE_TEXT — a free text box, FIXED relative to the base map (it zooms with
// the plan, like a CAD text). Sizes (fontSize / width / padding) are PDF
// POINTS "as if the base map filled an A4/A3 page" (`pageFormat` prop): the
// whole box is drawn in page-pt space and scaled by
// k = imageLongSide / pageLongSide, so a 14pt text prints as 14pt on the
// exported page whatever the image resolution. The
// optional connector (leader line + draggable target dot) reuses the LABEL
// partTypes (LABEL_BOX / TARGET / LINK) so the whole LABEL interaction
// pipeline applies unchanged. Unlike NodeLabelStatic this component carries
// none of the "label::" sub-label logic.
//
// Text content lives in `annotation.textContent` (own prop) — NOT in `label`
// (which stays the annotation/entity label like any other type).
//
// "The text must not move on screen at validation": a single always-mounted
// sizing span drives the box size (visible text when unselected, transparent
// under the textarea when selected) with STRICTLY identical font styles, and
// the border-box never changes on selection (selection feedback = outline).
export default function NodeFreeTextStatic({
  annotation,
  annotationOverride,
  hovered,
  selected,
  dragged,
  onSizeChange,
  containerK = 1,
}) {
  // data

  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const data = { ...annotation, ...annotationOverride };
  const {
    id,
    targetPoint = { x: 0, y: 0 },
    labelPoint = { x: 0, y: 0 },
    width: fixedWidth,
    textContent,
    placeholder = "Texte",
    fillColor = "#ffffff",
    hasBackground = true,
    textColor = "#000000",
    borderColor = "#000000",
    fontFamily = "Roboto",
    fontSize = 14,
    fontWeight = "normal",
    fontItalic = false,
    fontUnderline = false,
    textAlign = "LEFT",
    hasBorder = false,
    hasPadding = true,
    hasConnector = false,
    pageFormat = "A4",
    imageLongSidePx,
    hidden,
  } = data;

  // --- 1. SCALES ---
  // pageScale: page-pt → image-px (the box group is scaled by it, so all the
  // CSS inside — fontSize, padding, width — is authored in page points).
  // imageLongSidePx is stamped by useAnnotationsV2 (the only place imageSize
  // is known); missing (foreign host) → scale 1 = plain image px.
  const pageScale = getFreeTextPageScale(pageFormat, imageLongSidePx);

  // UI handles (target dot, width handle, selection outline) keep a constant
  // SCREEN size, with the NodeLabelStatic formula (--map-zoom from
  // MapEditorViewport, containerK from pose-transform hosts like portfolio /
  // EditedObjectLayer). Inside the page-scaled box, pageScale is folded in.
  const uiScaleExpr = `calc(1 / (var(--map-zoom, 1) * ${containerK || 1}))`;
  const uiScaleInBoxExpr = `calc(1 / (var(--map-zoom, 1) * ${(containerK || 1) * pageScale}))`;

  // --- 2. COORDONNÉES ---
  // targetPoint / labelPoint are already in pixels (useAnnotationsV2).
  const targetPx = { x: targetPoint.x, y: targetPoint.y };
  const labelPx = {
    x: labelPoint.x ?? targetPoint.x,
    y: labelPoint.y ?? targetPoint.y,
  };

  // --- 3. GESTION TEXTE ---
  // The box shows and edits `textContent` — the annotation's own text prop,
  // decoupled from `label` (which upstream enrichment may overwrite with the
  // entity name).
  const text = textContent ?? "";

  const [localValue, setLocalValue] = useState(text);

  useEffect(() => {
    setLocalValue(text);
  }, [text]);

  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  const textRef = useRef(text);
  textRef.current = text;

  const saveText = async (value) => {
    try {
      await db.annotations.update(id, { textContent: value });
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlur = () => {
    if (localValue !== text) {
      saveText(localValue);
    }
  };

  // Save pending changes when deselected (textarea unmount skips onBlur)
  useEffect(() => {
    if (!selected) return;
    return () => {
      if (localValueRef.current !== textRef.current) {
        saveText(localValueRef.current);
      }
    };
  }, [selected]);

  // Fresh (or still empty) annotation: focus the field as soon as it is
  // selected so the user can type right after the placement click. Existing
  // annotations with text are NOT auto-focused — keystrokes captured by the
  // textarea would swallow app hotkeys (e.g. Suppr) on simple selection.
  const textareaRef = useRef(null);
  useEffect(() => {
    if (selected && !textRef.current && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selected]);

  const handleFocus = (e) => {
    const val = e.target.value;
    // Place le curseur à la fin
    e.target.setSelectionRange(val.length, val.length);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation(); // Empêche les raccourcis globaux de l'app (ex: suppr)

    // Enter SANS Shift -> valide (blur). Shift+Enter -> saut de ligne
    // (comportement par défaut du textarea).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.target.blur();
    }
  };

  // --- 4. LARGEUR RÉGLABLE (poignée droite) ---
  // The box is map-fixed: the screen drag delta is converted to local page
  // pt through the box's real on-screen scale (bounding rect / layout width),
  // which absorbs the map zoom, containerK, pageScale and browser zoom at
  // once. `width` is therefore stored in page points.
  const [liveWidth, setLiveWidth] = useState(null);
  const effectiveFixedWidth = liveWidth ?? fixedWidth;

  const saveWidth = async (value) => {
    try {
      await updateAnnotation({ id, width: value });
    } catch (err) {
      console.error(err);
      setLiveWidth(null);
    }
  };

  // Keep the live override until the persisted width has caught up (DB
  // write → liveQuery → new prop): clearing it on pointerup would flash the
  // old width for one roundtrip.
  useEffect(() => {
    if (liveWidth != null && fixedWidth === liveWidth) {
      setLiveWidth(null);
    }
  }, [fixedWidth, liveWidth]);

  const handleResizePointerDown = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startW = boxRef.current?.offsetWidth || fixedWidth || MIN_WIDTH;
    // screen px per local (image) px, measured on the box itself.
    const rect = boxRef.current?.getBoundingClientRect();
    const screenScale =
      rect?.width && boxRef.current?.offsetWidth
        ? rect.width / boxRef.current.offsetWidth
        : 1;
    let lastW = null;

    const computeWidth = (clientX) =>
      Math.round(
        Math.min(
          MAX_WIDTH,
          // The box is centered on labelPoint: the edge follows the
          // cursor when the width grows by twice the pointer delta.
          Math.max(MIN_WIDTH, startW + (2 * (clientX - startX)) / screenScale)
        )
      );

    const onMove = (ev) => {
      lastW = computeWidth(ev.clientX);
      setLiveWidth(lastW);
    };
    const onUp = (ev) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const finalW = lastW ?? computeWidth(ev.clientX);
      if (finalW !== fixedWidth) {
        setLiveWidth(finalW);
        saveWidth(finalW);
      } else {
        setLiveWidth(null);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleResizeReset = (e) => {
    e.stopPropagation();
    // Back to auto width (content-driven).
    saveWidth(null);
  };

  // --- 5. STYLES ---
  const fontStyles = {
    fontFamily: getFreeTextFontStack(fontFamily),
    fontSize: `${fontSize}px`,
    fontWeight: fontWeight === "bold" ? "bold" : "normal",
    fontStyle: fontItalic ? "italic" : "normal",
    textDecoration: fontUnderline ? "underline" : "none",
    lineHeight: 1.2,
    textAlign:
      { LEFT: "left", CENTER: "center", RIGHT: "right" }[textAlign] ?? "left",
    // fixedWidth -> 'pre-wrap': auto AND manual line breaks.
    // auto width -> 'pre': single line except manual \n.
    whiteSpace: effectiveFixedWidth ? "pre-wrap" : "pre",
    wordBreak: "break-word",
    maxWidth: "100%",
  };

  // Constant border-box (never changes on hover / selection so the text
  // cannot shift by a border-width delta); feedback rides on `outline`,
  // counter-scaled so the selection stroke stays readable at every zoom.
  const border = `1px solid ${hasBorder ? borderColor : "transparent"}`;
  const outlineStyles = selected
    ? {
        outlineWidth: `calc(2px * ${uiScaleInBoxExpr})`,
        outlineStyle: hidden ? "dashed" : "solid",
        outlineColor: SELECTION_COLOR,
      }
    : hovered
      ? {
          outlineWidth: `calc(1px * ${uiScaleInBoxExpr})`,
          outlineStyle: "solid",
          outlineColor: SELECTION_COLOR,
        }
      : {};

  // --- 6. MESURE DOM ---
  const [boxSize, setBoxSize] = useState({ w: 60, h: 30 });
  const boxRef = useRef(null);
  const lastNotifiedSize = useRef({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!boxRef.current) return;
    const el = boxRef.current;
    const updateSize = () => {
      const realWidth = el.offsetWidth;
      const realHeight = el.offsetHeight;
      setBoxSize({ w: realWidth, h: realHeight });

      if (
        onSizeChange &&
        (Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
          Math.abs(lastNotifiedSize.current.height - realHeight) > 1)
      ) {
        lastNotifiedSize.current = { width: realWidth, height: realHeight };
        onSizeChange({ width: realWidth, height: realHeight });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [
    localValue,
    fixedWidth,
    onSizeChange,
    fontSize,
    fontFamily,
    fontWeight,
    fontItalic,
    textAlign,
    hasPadding,
  ]);

  // --- 7. RENDU ---
  const dataProps = {
    "data-node-id": id,
    "data-node-entity-id": data.entityId,
    "data-node-listing-id": data.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "FREE_TEXT",
    "data-part-type": "LABEL_BOX",
    "data-interaction": "draggable",
  };

  const leaderPoints = `${targetPx.x},${targetPx.y} ${labelPx.x},${labelPx.y}`;

  return (
    <g
      {...dataProps}
      style={{
        cursor: dragged ? "grabbing" : "pointer",
      }}
    >
      {/* A. TRAIT DE CONNEXION (optionnel) : cible → boîte de texte */}
      {hasConnector && (
        <>
          <polyline
            points={leaderPoints}
            fill="none"
            stroke={LEADER_COLOR}
            strokeOpacity={LEADER_OPACITY}
            strokeWidth={LINE_WIDTH}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
            strokeDasharray={hidden ? "4 4" : "none"}
          />

          {/* Ligne fantôme pour faciliter le clic */}
          <polyline
            points={leaderPoints}
            fill="none"
            stroke="transparent"
            strokeWidth={15}
            style={{
              cursor: selected ? "move" : "pointer",
              pointerEvents: "stroke",
            }}
            data-part-type="LINK"
          />

          {/* B. CIBLE (poignée UI : taille écran constante) */}
          <g transform={`translate(${targetPx.x}, ${targetPx.y})`}>
            <g
              style={{
                transform: `scale(${uiScaleExpr})`,
                transformBox: "fill-box",
                transformOrigin: "center",
              }}
            >
              <circle
                r={DOT_RADIUS}
                fill={LEADER_COLOR}
                stroke="white"
                strokeWidth={1}
                pointerEvents="visible"
                data-part-type="TARGET"
              />
              <circle
                r={10}
                fill="transparent"
                stroke="transparent"
                data-part-type="TARGET"
              />
            </g>
          </g>
        </>
      )}

      {/* C. BOÎTE DE TEXTE (map-fixed : aucun contre-zoom). The inner group
          scales page pt → image px, so everything inside the foreignObject
          is authored in page points (fontSize, padding, width). */}
      <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
        <g transform={`scale(${pageScale})`}>
          <foreignObject
            x={-boxSize.w / 2}
            y={-boxSize.h / 2}
            width={boxSize.w}
            height={boxSize.h}
            style={{ overflow: "visible" }}
          >
            <div
              data-part-type="LABEL_BOX"
              ref={boxRef}
              style={{
                width: effectiveFixedWidth
                  ? `${effectiveFixedWidth}px`
                  : "max-content",
                minWidth: `${MIN_WIDTH}px`,
                height: "auto",
                backgroundColor: hasBackground ? fillColor : "transparent",
                border,
                ...outlineStyles,
                borderRadius: "2px",
                boxSizing: "border-box",
                padding: hasPadding ? `${PADDING_Y}px ${PADDING_X}px` : 0,
                position: "relative",
                pointerEvents: "auto",
                userSelect: "none",
                // Drag-n-drop affordance: the box (its edges when the textarea
                // covers the interior) shows the move arrows.
                cursor: dragged ? "grabbing" : "move",
              }}
              onMouseDown={(e) => selected && e.stopPropagation()}
            >
              <div
                style={{
                  position: "relative",
                  maxWidth: "100%",
                  width: effectiveFixedWidth ? "100%" : undefined,
                }}
              >
                {/* Élément de dimensionnement : TOUJOURS monté, styles
                  STRICTEMENT identiques au textarea — le texte ne
                  bouge pas d'un pixel à la validation. */}
                <span
                  style={{
                    ...fontStyles,
                    color: selected
                      ? "transparent"
                      : text
                        ? textColor
                        : "rgba(0,0,0,0.4)",
                    height: "auto",
                    display: "block",
                    minHeight: "1.2em",
                    minWidth: `${MIN_WIDTH}px`,
                  }}
                >
                  {(selected
                    ? localValue + (localValue?.endsWith("\n") ? " " : "")
                    : text) || placeholder}
                </span>
                {selected && (
                  <textarea
                    ref={textareaRef}
                    value={localValue}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onBlur={handleBlur}
                    onFocus={handleFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    style={{
                      ...fontStyles,
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      color: textColor,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      resize: "none",
                      padding: 0,
                      margin: 0,
                      overflow: "hidden",
                      cursor: "text",
                      minWidth: `${MIN_WIDTH}px`,
                    }}
                  />
                )}
              </div>

              {/* --- POIGNÉE DE LARGEUR (sélection uniquement, taille écran
                constante) --- */}
              {selected && (
                <div
                  onPointerDown={handleResizePointerDown}
                  onDoubleClick={handleResizeReset}
                  title="Largeur du texte (double-clic : auto)"
                  style={{
                    position: "absolute",
                    right: -6,
                    top: "50%",
                    transform: `translateY(-50%) scale(${uiScaleInBoxExpr})`,
                    transformOrigin: "center",
                    width: 8,
                    height: 22,
                    borderRadius: 4,
                    backgroundColor: "#ffffff",
                    border: `1px solid ${SELECTION_COLOR}`,
                    cursor: "ew-resize",
                    pointerEvents: "auto",
                    touchAction: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}
            </div>
          </foreignObject>
        </g>
      </g>
    </g>
  );
}
