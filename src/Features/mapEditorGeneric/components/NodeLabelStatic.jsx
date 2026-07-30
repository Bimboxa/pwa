import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from "react";
import { darken } from "@mui/material/styles";
import { IconButton } from "@mui/material";
import { Refresh, Visibility, VisibilityOff } from "@mui/icons-material";

import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import db from "App/db/db";

// --- CONSTANTES ---
const DOT_RADIUS = 2;
const LINE_WIDTH = 1.5;
// Leader + target dot are black (mirrors the 3D card's leader/anchor); the
// annotation colour stays on the chip border.
const LEADER_COLOR = "#000000";
const LEADER_OPACITY = 0.7;
const PADDING_X = 8;
const PADDING_Y = 4;
const DEFAULT_FONT_SIZE = 14;

export default function NodeLabelStatic({
    annotation,
    annotationOverride,
    imageSize,
    hovered,
    selected,
    dragged,
    onSizeChange,
    containerK = 1,
    forceHideLabel = false,
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
        label,
        lines,
        placeholder = "Étiquette",
        fillColor = "#2196f3",
        textColor = "#000000",
        bgColor = "#ffffff",
        fontSize = DEFAULT_FONT_SIZE,
        shadow = false,
        hidden,
    } = data;

    // -- 0. id --
    const annotationId = id.replace("label::", "");

    // --- 0b. CONTENU MULTI-LIGNES ---
    // `lines` comes from getAnnotationLabelTextLines (Etiquette tab options).
    // Undefined for standalone LABEL annotations → legacy single-label render.
    const hasLines = Array.isArray(lines);
    const templateLine = hasLines ? lines.find((l) => l.kind === "TEMPLATE") : null;
    const labelLine = hasLines ? lines.find((l) => l.kind === "LABEL") : null;
    const descriptionLine = hasLines ? lines.find((l) => l.kind === "DESCRIPTION") : null;
    // Empty-label fallback: keep an editable line when nothing else is shown.
    const showLabelLine = Boolean(labelLine) || (selected && hasLines && lines.length === 0);
    const linesKey = hasLines
        ? lines.map((l) => `${l.kind}:${l.text}`).join("\n")
        : null;

    // --- 1. MODE DE TAILLE ---
    const sizeVariant = "FIXED_IN_CONTAINER_PARENT";

    // --- 2. SCALE ---
    // Constant screen size: counter-scale by container k AND map zoom (same
    // formula as NodeCoteStatic — --map-zoom is written by MapEditorViewport,
    // missing var falls back to 1 outside the map editor, e.g. portfolio).
    const scaleTransform = useMemo(() => {
        const k = containerK || 1;
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
    }, [containerK]);

    // --- 3. COORDONNÉES ---
    // targetPoint and labelPoint are already in pixel coordinates
    // (resolved by useAnnotationsV2 or computed from resolved points in polyline/marker sub-labels)
    const targetPx = { x: targetPoint.x, y: targetPoint.y };
    const labelPx = {
        x: labelPoint.x ?? targetPoint.x,
        y: labelPoint.y ?? targetPoint.y,
    };

    // --- 4. GESTION TEXTE ---
    const [localValue, setLocalValue] = useState(label || "");

    useEffect(() => {
        setLocalValue(label || "");
    }, [label]);

    // refs to access latest values in effects/cleanups
    const localValueRef = useRef(localValue);
    localValueRef.current = localValue;
    const labelRef = useRef(label);
    labelRef.current = label;

    const saveLabel = async (value) => {
        try {
            const _annotationId = id.startsWith("label::") ? id.replace("label::", "") : id;
            // The chip always shows and edits the annotation's OWN label —
            // labels are decoupled from entities (an entity-linked annotation
            // no longer renames its entity from here).
            await db.annotations.update(_annotationId, { label: value });
        } catch (err) { console.error(err); }
    };

    const handleBlur = () => {
        if (localValue !== label) {
            saveLabel(localValue);
        }
    };

    // --- 4b. LARGEUR RÉGLABLE (drag de la poignée droite, 2D uniquement) ---
    // The chip is constant screen size, so 1 dragged CSS px = 1 width px.
    // Live width during the drag, then persisted: `labelWidth` on the
    // annotation for sub-labels, `width` for standalone LABEL annotations.
    const [liveWidth, setLiveWidth] = useState(null);
    const effectiveFixedWidth = liveWidth ?? fixedWidth;

    const MIN_WIDTH = 60;
    const MAX_WIDTH = 600;

    const saveWidth = async (value) => {
        try {
            if (id.startsWith("label::")) {
                await updateAnnotation({ id: annotationId, labelWidth: value });
            } else {
                await updateAnnotation({ id, width: value });
            }
        } catch (err) {
            console.error(err);
            // Persist failed: drop the live override so the chip falls back
            // to the stored width instead of staying stuck.
            setLiveWidth(null);
        }
    };

    // The live override is kept AFTER pointerup and only released once the
    // persisted width has caught up (DB write → liveQuery → new prop):
    // clearing it on pointerup would flash the old width for one roundtrip.
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
        let lastW = null;

        const computeWidth = (clientX) =>
            Math.round(
                Math.min(
                    MAX_WIDTH,
                    // The chip is centered on labelPoint: the edge follows the
                    // cursor when the width grows by twice the pointer delta.
                    Math.max(MIN_WIDTH, startW + 2 * (clientX - startX))
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
                // Keep the live width as override until the persisted value
                // lands (see the catch-up effect) — no old-width flash.
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

    // Save pending changes when deselected (textarea unmount skips onBlur)
    useEffect(() => {
        if (!selected) return;
        return () => {
            if (localValueRef.current !== labelRef.current) {
                saveLabel(localValueRef.current);
            }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    const handleFocus = (e) => {
        const val = e.target.value;
        // Place le curseur à la fin
        e.target.setSelectionRange(val.length, val.length);
    };

    const handleKeyDown = (e) => {
        e.stopPropagation(); // Empêche les raccourcis globaux de l'app (ex: suppr)

        // Si Enter est pressé SANS Shift -> Sauvegarder (Blur)
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.target.blur();
        }
        // Si Shift + Enter -> On ne fait rien ici, le comportement par défaut 
        // du textarea (saut de ligne) s'applique.
    };

    // --- NOUVEAUX HANDLERS ---
    const handleResetDelta = async (e) => {
        e.stopPropagation();
        const annotationId = id.replace("label::", "");
        // const annotation = await db.annotations.get(annotationId);
        console.log("Reset delta for label:", annotationId);
        await db.annotations.update(annotationId, { labelDelta: { target: { x: 0, y: 0 }, label: { x: 0, y: 0 } } });
    };

    const handleToggleHide = async (e) => {
        try {
            e.stopPropagation();
            const annotationId = id.replace("label::", "");
            const annotation = await db.annotations.get(annotationId);
            console.log("Toggle hide label:", annotationId, annotation);
            await db.annotations.update(annotationId, { showLabel: !annotation.showLabel });
        } catch (err) { console.error(err); }
    };

    // --- 5. STYLE & COULEURS ---
    const activeColor = hovered ? darken(fillColor, 0.2) : fillColor;

    // Logique de bordure (Tirets si caché et sélectionné)
    let borderStyle = `1px solid ${activeColor}`;
    if (selected) {
        if (hidden) {
            borderStyle = `2px dashed ${activeColor}`;
        } else {
            borderStyle = `2px solid ${activeColor}`;
        }
    }

    // "Ombre" option of the Etiquette tab (off by default).
    const boxShadow = !shadow
        ? "none"
        : selected
            ? "0px 2px 4px -1px rgba(0,0,0,0.2), 0px 4px 5px 0px rgba(0,0,0,0.14), 0px 1px 10px 0px rgba(0,0,0,0.12)"
            : "0px 2px 1px -1px rgba(0,0,0,0.2), 0px 1px 1px 0px rgba(0,0,0,0.14), 0px 1px 3px 0px rgba(0,0,0,0.12)";

    // --- 6. MESURE DOM ---
    // The chip box div is measured (not just the text span): with multi-line
    // content the box is the only element whose size covers every line.
    const [labelSize, setLabelSize] = useState({ w: 60, h: 30 });
    const boxRef = useRef(null);
    const lastNotifiedSize = useRef({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!boxRef.current) return;
        const el = boxRef.current;
        const updateSize = () => {
            const realWidth = el.offsetWidth + (selected ? 4 : 0); // Petit buffer si sélectionné
            const realHeight = el.offsetHeight;
            setLabelSize({ w: realWidth, h: realHeight });

            if (onSizeChange &&
                (Math.abs(lastNotifiedSize.current.width - realWidth) > 1 ||
                    Math.abs(lastNotifiedSize.current.height - realHeight) > 1)) {
                lastNotifiedSize.current = { width: realWidth, height: realHeight };
                onSizeChange({ width: realWidth, height: realHeight });
            }
        };
        updateSize();
        const ro = new ResizeObserver(updateSize);
        ro.observe(el);
        return () => ro.disconnect();
    }, [localValue, fixedWidth, onSizeChange, selected, fontSize, sizeVariant, linesKey]);

    // --- 7. RENDU ---
    const dataProps = {
        "data-node-id": id,
        "data-node-entity-id": data.entityId,
        "data-node-listing-id": data.listingId,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "LABEL",
        // fix du bug de sélection si le label est ajouté à un marker.
        "data-part-type": "LABEL_BOX",
        "data-interaction": "draggable",
    };

    const fontStyles = {
        fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
        fontSize: `${fontSize}px`,
        fontWeight: 'bold',
        lineHeight: 1.2,
        textAlign: 'center',
        // IMPORTANT POUR MULTILIGNE :
        // Si fixedWidth -> 'pre-wrap' permet les retours à la ligne auto ET manuels
        // Si auto -> 'pre' force la ligne unique sauf si retour manuel (\n)
        whiteSpace: effectiveFixedWidth ? 'pre-wrap' : 'pre',
        wordBreak: 'break-word',
        maxWidth: '100%',
    };

    if (hidden && !selected && !hovered) {
        // Optionnel : ne rien rendre du tout
    }

    // --- 6b. LIAISON ---
    // Single segment target → chip center: the chip scale now depends on the
    // CSS var --map-zoom (unavailable to JS, frozen during wheel gestures), so
    // a chip-edge attach point cannot be computed reliably. The opaque chip is
    // rendered after the line and visually clips it at its edge at every zoom.
    const leaderPoints = `${targetPx.x},${targetPx.y} ${labelPx.x},${labelPx.y}`;

    // Hide everything when the Etiquette content is fully toggled off (unless
    // selected: the placeholder chip stays editable).
    if (hasLines && lines.length === 0 && !selected) return null;

    // Standalone LABEL annotations render through NodeAnnotationStatic: honor
    // the global hide (3D → 2D switch) here — sub-labels are gated upstream.
    if (forceHideLabel) return null;

    return (
        <g {...dataProps} style={{
            cursor: dragged ? "grabbing" : "pointer",
        }}>

            {/* A. LIAISON : cible → étiquette (noire, comme en 3D) */}
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
                style={{ cursor: selected ? "move" : "pointer", pointerEvents: "stroke" }}
                data-part-type="LINK"
            />

            {/* B. CIBLE */}
            <g transform={`translate(${targetPx.x}, ${targetPx.y})`}>
                <g data-label-scale style={{ transform: scaleTransform, transformBox: "fill-box", transformOrigin: "center" }}>
                    <circle r={DOT_RADIUS} fill={LEADER_COLOR} stroke="white" strokeWidth={1} pointerEvents="visible" data-part-type="TARGET" />
                    <circle r={10} fill="transparent" stroke="transparent" data-part-type="TARGET" />
                </g>
            </g>

            {/* C. LABEL BOX */}
            <g transform={`translate(${labelPx.x}, ${labelPx.y})`}>
                <g data-label-scale style={{ transform: scaleTransform }}>
                    <foreignObject
                        x={-labelSize.w / 2}
                        y={-labelSize.h / 2}
                        width={labelSize.w}
                        height={labelSize.h}
                        style={{ overflow: 'visible' }}
                    >
                        <div
                            data-part-type="LABEL_BOX"
                            ref={boxRef}
                            style={{
                                width: effectiveFixedWidth ? `${effectiveFixedWidth}px` : 'max-content',
                                minWidth: '40px',
                                height: 'auto',
                                backgroundColor: bgColor,
                                border: borderStyle,
                                borderRadius: '4px',
                                boxShadow: boxShadow,
                                boxSizing: 'border-box',
                                padding: `${PADDING_Y}px ${PADDING_X}px`,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                position: 'relative',
                                pointerEvents: 'auto',
                                userSelect: 'none',
                            }}
                            onMouseDown={(e) => selected && e.stopPropagation()}
                        >
                            {hasLines ? (
                                <>
                                    {/* --- LIGNE MODÈLE --- */}
                                    {templateLine && (
                                        <div style={{ ...fontStyles, color: textColor }}>
                                            {templateLine.text}
                                        </div>
                                    )}

                                    {/* --- LIGNE LIBELLÉ (éditable inline) --- */}
                                    {showLabelLine && (
                                        <div style={{ position: 'relative', maxWidth: '100%', width: effectiveFixedWidth ? '100%' : undefined }}>
                                            {/* Élément fantôme : dimensionne la ligne */}
                                            <span
                                                style={{
                                                    ...fontStyles,
                                                    color: selected ? 'transparent' : textColor,
                                                    height: 'auto',
                                                    display: 'block',
                                                    minHeight: '1.2em',
                                                    minWidth: "60px"
                                                }}
                                            >
                                                {(selected
                                                    ? localValue + (localValue?.endsWith('\n') ? " " : "")
                                                    : label) || placeholder}
                                            </span>
                                            {selected && (
                                                <textarea
                                                    value={localValue}
                                                    onChange={(e) => setLocalValue(e.target.value)}
                                                    onBlur={handleBlur}
                                                    onFocus={handleFocus}
                                                    onKeyDown={handleKeyDown}
                                                    placeholder={placeholder}
                                                    style={{
                                                        ...fontStyles,
                                                        position: 'absolute',
                                                        top: 0,
                                                        left: 0,
                                                        width: '100%',
                                                        height: '100%',
                                                        color: textColor,
                                                        background: 'transparent',
                                                        border: 'none',
                                                        outline: 'none',
                                                        resize: 'none',
                                                        padding: 0,
                                                        margin: 0,
                                                        overflow: 'hidden',
                                                        cursor: 'text',
                                                        minWidth: "60px"
                                                    }}
                                                />
                                            )}
                                        </div>
                                    )}

                                    {/* --- LIGNE DESCRIPTION --- */}
                                    {descriptionLine && (
                                        <div
                                            style={{
                                                ...fontStyles,
                                                fontSize: `${Math.round(fontSize * 0.85)}px`,
                                                fontWeight: 'normal',
                                                color: textColor,
                                                whiteSpace: 'pre-wrap',
                                                maxWidth: effectiveFixedWidth ? '100%' : '180px',
                                                // Breathing room after the label / template lines.
                                                marginTop: templateLine || showLabelLine ? 6 : 0,
                                            }}
                                        >
                                            {descriptionLine.text}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* --- ÉLÉMENT FANTÔME (Dimensionnement) --- */}
                                    {/* C'est cet élément qui détermine la taille de la boite.
                                        On ajoute un espace si le texte finit par \n pour forcer la hauteur de la nouvelle ligne.
                                    */}
                                    <span
                                        style={{
                                            ...fontStyles,
                                            color: 'transparent',
                                            visibility: 'hidden', // On garde visibility:hidden pour qu'il prenne de la place
                                            height: 'auto',
                                            display: 'block',
                                            minHeight: '1.2em',
                                            minWidth: "60px"
                                        }}
                                    >
                                        {localValue + (localValue?.endsWith('\n') ? " " : "") || " "}
                                    </span>

                                    {/* --- INPUT EDITABLE (Textarea) --- */}
                                    {selected ? (
                                        <textarea
                                            value={localValue}
                                            onChange={(e) => setLocalValue(e.target.value)}
                                            onBlur={handleBlur}
                                            onFocus={handleFocus}
                                            onKeyDown={handleKeyDown}
                                            placeholder={placeholder}
                                            style={{
                                                ...fontStyles,
                                                position: 'absolute',
                                                top: `${PADDING_Y}px`,
                                                left: `${PADDING_X}px`,
                                                width: `calc(100% - ${PADDING_X * 2}px)`,
                                                height: `calc(100% - ${PADDING_Y * 2}px)`,
                                                color: textColor,
                                                background: 'transparent',
                                                border: 'none',
                                                outline: 'none',
                                                resize: 'none',
                                                padding: 0,
                                                margin: 0,
                                                overflow: 'hidden',
                                                cursor: 'text',
                                                minWidth: "60px"
                                            }}
                                        />
                                    ) : (
                                        <span style={{
                                            ...fontStyles,
                                            position: 'absolute',
                                            top: `${PADDING_Y}px`,
                                            left: `${PADDING_X}px`,
                                            width: `calc(100% - ${PADDING_X * 2}px)`,
                                            height: `calc(100% - ${PADDING_Y * 2}px)`,
                                            color: textColor,
                                            pointerEvents: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {label || placeholder}
                                        </span>
                                    )}
                                </>
                            )}

                            {/* --- POIGNÉE DE LARGEUR (2D, sélection uniquement) --- */}
                            {/* Drag = règle la largeur (persistée), double-clic =
                                retour à la largeur auto. */}
                            {selected && (
                                <div
                                    onPointerDown={handleResizePointerDown}
                                    onDoubleClick={handleResizeReset}
                                    title="Largeur de l'étiquette (double-clic : auto)"
                                    style={{
                                        position: 'absolute',
                                        right: -6,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        width: 8,
                                        height: 22,
                                        borderRadius: 4,
                                        backgroundColor: '#ffffff',
                                        border: `1px solid ${activeColor}`,
                                        cursor: 'ew-resize',
                                        pointerEvents: 'auto',
                                        touchAction: 'none',
                                        boxSizing: 'border-box',
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