import { useLayoutEffect, useRef, useState, useMemo } from "react";
import { Box } from "@mui/material";

// Quick estimate helper (same as original)
function estimateWidthPx(str, fontSizePx) {
    const avgChar = 0.6 * fontSizePx;
    return Math.max(1, Math.ceil((str.length + 1) * avgChar));
}

export default function NodeTextStatic({
    text,
    imageSize,
}) {

    // --- PROPERTIES ---
    const fontFamily = text.fontFamily ?? "inherit";
    const fontWeight = text.fontWeight ?? "normal";
    const placeholder = text.placeholder ?? "Texte";
    const fontSizePx = text.fontSize ?? 16;
    const paddingPx = 8;
    const minWidthPx = 28;
    const minHeightPx = fontSizePx * 1.25;
    const fillColor = text.fillColor;
    const fillOpacity = text.fillOpacity ?? 1;

    // --- DIMENSIONS ---
    const storedWidth = text.width;
    const storedHeight = text.height;

    // Text content
    const displayValue = text.textValue ?? "";
    const textOrPh = displayValue?.length ? displayValue : placeholder;

    // Auto-size calculation
    const initialW = storedWidth
        ? storedWidth
        : Math.max(minWidthPx, estimateWidthPx(textOrPh, fontSizePx)) + paddingPx * 2;

    const initialH = storedHeight
        ? storedHeight
        : Math.max(minHeightPx, 1) + paddingPx;

    // --- MEASURE HEIGHT (for ForeignObject) ---
    const contentRef = useRef(null);
    const [measuredCssH, setMeasuredCssH] = useState(initialH);

    useLayoutEffect(() => {
        if (!contentRef.current || storedHeight) return;
        const el = contentRef.current;
        // Mesure immédiate
        setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx));

        // Observer pour les changements de police/layout
        const ro = new ResizeObserver(() => {
            setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx));
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, [text.textValue, storedHeight, minHeightPx, fontSizePx]);

    const boxW = storedWidth || initialW;
    const boxH = storedHeight || measuredCssH;

    // --- POSITION ---
    // Calcul de la position absolue dans l'image
    const pixelX = (text.x ?? 0) * (imageSize?.width ?? 0);
    const pixelY = (text.y ?? 0) * (imageSize?.height ?? 0);

    // --- SCALE COMPENSATION ---
    // Si on veut que le texte reste lisible (taille fixe écran), on applique l'inverse du zoom
    // Si on veut qu'il zoome avec la carte, on laisse scale(1).
    // Ici, je reprends la logique "Static" vue précédemment :
    // On annule le zoom caméra et le zoom container.

    const scaleStyle = {
        // transformBox: "fill-box",
        // transformOrigin: "center", 
        // transform: `translate(${pixelX}px, ${pixelY}px) scale(calc(1 / (var(--map-zoom, 1) * ${containerK})))`

        // ATTENTION : Pour un foreignObject, le transform CSS peut être délicat.
        // Souvent, on laisse le foreignObject subir le zoom SVG (pour qu'il reste accroché au point)
        // mais on scale son CONTENU HTML inversement si on veut une taille fixe.
        // OU BIEN : On suppose que ce texte DOIT zoomer (c'est une annotation sur le plan).
        // Dans votre code original, 'scaleFactor' était utilisé pour le Drag, pas le rendu.
        // Le rendu utilisait fontSizePx brut. Donc il semble que le texte DOIT zoomer avec la carte.
    };

    // Helper Background Color
    const getBackgroundColor = () => {
        if (fillColor) {
            const hex = fillColor.replace("#", "");
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
        }
        return "transparent";
    };

    return (
        <foreignObject
            x={pixelX}
            y={pixelY - boxH / 2} // Centré verticalement sur le point d'ancrage Y
            width={boxW}
            height={boxH}
            style={{ overflow: "visible", pointerEvents: "none" }} // Static
            data-node-id={text.id}
            data-node-type="ANNOTATION"
            data-annotation-type="TEXT"
        >
            <Box
                ref={contentRef}
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    boxSizing: "border-box",
                    bgcolor: getBackgroundColor(),
                    // Pas de bordure ni curseur spécifique en mode static
                }}
            >
                <span
                    style={{
                        display: "block",
                        whiteSpace: "pre-wrap", // Support des sauts de ligne
                        wordWrap: "break-word",
                        fontSize: fontSizePx,
                        fontWeight,
                        fontFamily,
                        lineHeight: 1.25,
                        padding: `${paddingPx / 2}px ${paddingPx}px`,
                        margin: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "hidden", // On coupe ce qui dépasse en mode static
                        color: "black", // Couleur par défaut si non spécifiée
                        letterSpacing: "inherit",
                    }}
                >
                    {textOrPh}
                </span>
            </Box>
        </foreignObject>
    );
}