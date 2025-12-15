import { useLayoutEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

function estimateWidthPx(str, fontSizePx) {
    const avgChar = 0.6 * fontSizePx;
    return Math.max(1, Math.ceil((str.length + 1) * avgChar));
}

export default function NodeTextStatic({
    text,
    imageSize,
    context,
    hovered,
    selected,
    onTextValueChange,
}) {
    const theme = useTheme();

    // --- CONFIGURATION ---
    const BORDER_WIDTH = 2; // Épaisseur de la bordure en pixels

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

    // --- COLOR ---
    const selectedColor = theme.palette.annotation?.selected || theme.palette.primary.main;

    // --- DATA_PROPS ---
    const dataProps = {
        "data-node-id": text.id,
        "data-node-type": "ANNOTATION",
        "data-annotation-type": "TEXT",
        "data-node-context": context,
    }

    // --- DIMENSIONS ---
    const storedWidth = text.width;
    const storedHeight = text.height;
    const displayValue = text.textValue ?? "";
    const textOrPh = displayValue?.length ? displayValue : placeholder;

    // 1. Calcul de la taille du CONTENU (texte + padding interne standard)
    const contentW = storedWidth
        ? storedWidth
        : Math.max(minWidthPx, estimateWidthPx(textOrPh, fontSizePx)) + paddingPx * 2;

    const contentH = storedHeight
        ? storedHeight
        : Math.max(minHeightPx, 1) + paddingPx;

    const contentRef = useRef(null);
    const [measuredCssH, setMeasuredCssH] = useState(contentH);

    // ResizeObserver pour ajuster la hauteur si le texte est long
    useLayoutEffect(() => {
        if (!contentRef.current || storedHeight) return;
        const el = contentRef.current;

        // On mesure la hauteur du scroll et on s'assure qu'on a le minimum
        const updateHeight = () => {
            // On utilise scrollHeight du contenu interne
            setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx + paddingPx));
        };

        updateHeight();
        const ro = new ResizeObserver(updateHeight);
        ro.observe(el);
        return () => ro.disconnect();
    }, [text.textValue, storedHeight, minHeightPx, fontSizePx, paddingPx]);

    // 2. Calcul des dimensions FINALES de la boîte (Contenu + Bordure)
    // On ajoute 2x la bordure (gauche + droite / haut + bas) pour ne pas écraser le texte
    const finalBoxW = (storedWidth || contentW) + (BORDER_WIDTH * 2);
    // Pour la hauteur, on utilise la valeur mesurée ou stockée
    const baseH = storedHeight || measuredCssH;
    const finalBoxH = baseH + (BORDER_WIDTH * 2);

    // --- POSITION ---
    const pixelX = (text.x ?? 0) * (imageSize?.width ?? 0);
    const pixelY = (text.y ?? 0) * (imageSize?.height ?? 0);

    // 3. COMPENSATION DE LA POSITION
    // Puisqu'on a agrandi la boite de 2px de chaque côté, il faut décaler 
    // le point de départ de 2px vers la gauche/haut pour que le texte reste centré/aligné.
    const adjustedX = pixelX - BORDER_WIDTH;

    // Pour le Y, comme vous centriez déjà avec (pixelY - boxH / 2), 
    // le calcul avec la nouvelle hauteur inclut automatiquement la compensation verticale.
    // Démonstration : NouvelleHauteur = H + 4.  (H+4)/2 = H/2 + 2. 
    // Donc on remonte de 2px, ce qui compense exactement la bordure supérieure de 2px.
    const adjustedY = pixelY - (finalBoxH / 2);

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
            x={adjustedX}
            y={adjustedY}
            width={finalBoxW}
            height={finalBoxH}
            style={{ overflow: "visible", pointerEvents: "auto" }}
            {...dataProps}
        >
            <Box
                ref={contentRef}
                sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",

                    // Box Sizing Border Box : La bordure mange vers l'intérieur...
                    // MAIS comme on a agrandi le foreignObject juste avant, 
                    // l'espace restant pour le texte est intact !
                    boxSizing: "border-box",

                    bgcolor: getBackgroundColor(),

                    // BORDURE PERMANENTE
                    borderStyle: "solid",
                    borderWidth: `${BORDER_WIDTH}px`,
                    borderColor: hovered ? selectedColor : "transparent",
                    borderRadius: "4px",

                    transition: "border-color 0.2s ease-in-out",
                }}
            >
                <span
                    style={{
                        display: "block",
                        whiteSpace: "pre-wrap",
                        wordWrap: "break-word",
                        fontSize: fontSizePx,
                        fontWeight,
                        fontFamily,
                        lineHeight: 1.25,
                        // On remet le padding normal, plus besoin de le réduire
                        padding: `${paddingPx / 2}px ${paddingPx}px`,
                        margin: 0,
                        width: "100%",
                        height: "100%",
                        overflow: "hidden",
                        color: "black",
                        letterSpacing: "inherit",
                    }}
                >
                    {textOrPh}
                </span>
            </Box>
        </foreignObject>
    );
}