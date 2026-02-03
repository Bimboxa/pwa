import {
  useState,
  useRef,
  useLayoutEffect,
  useMemo,
} from "react";
import { useSelector } from "react-redux";
import { grey } from "@mui/material/colors";
import { darken } from "@mui/material/styles";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import NodeLabelStatic from "./NodeLabelStatic";

import getAnnotationLabelPropsFromAnnotation from "Features/annotations/utils/getAnnotationLabelPropsFromAnnotation";

export default function NodeMarkerStatic({
  marker,
  annotationOverride,
  spriteImage,
  selected,
  hovered,
  dragged,

  // NOUVELLES PROPS
  sizeVariant = "FIXED_IN_SCREEN", // "FIXED_IN_SCREEN" | "FIXED_IN_CONTAINER_PARENT" | "SCALED"
  containerK = 1, // Nécessaire pour le calcul inverse
}) {

  // on force FIXED_IN_SCREEN pour les marqueurs statiques
  sizeVariant = "FIXED_IN_CONTAINER_PARENT";

  const dataProps = {
    "data-node-id": marker.id,
    "data-node-listing-id": marker.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "MARKER",
    "data-interaction": "draggable"
  };

  marker = { ...marker, ...annotationOverride };

  // helper

  const hasImages = Boolean(marker?.entity?.images?.length);

  // --- CALCUL DE L'ÉCHELLE (SCALE) ---
  const scaleTransform = useMemo(() => {
    const k = containerK || 1;

    switch (sizeVariant) {
      case "FIXED_IN_SCREEN":
        // On annule le Zoom Caméra (variable CSS) ET l'échelle du Conteneur (k)
        // Résultat : Taille fixe en pixels écran (ex: 32px)
        return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;

      case "FIXED_IN_CONTAINER_PARENT":
        // On annule uniquement l'échelle du Conteneur
        // Résultat : Le marqueur zoome avec la carte, mais sa taille de base est relative à l'écran, pas à l'image géante
        return `scale(${1 / k})`;

      case "SCALED":
      default:
        // On subit toutes les échelles (Le marqueur est comme peint sur la carte)
        return "scale(1)";
    }
  }, [sizeVariant, containerK]);


  // --- CONSTANTES DE TAILLE (Base en pixels) ---
  const isMobile = useIsMobile();
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);
  const fixSize = isMobile || !showBgImage;

  const SIZE = 32;
  const R_PX = SIZE / 2;
  const ICON_SIZE_PX = SIZE * 0.9;
  const STROKE_WIDTH_PX = 2;
  const hitStrokePx = 10;

  // --- COULEURS ---
  let fillColor = marker?.fillColor ?? "#f44336";
  const hoverFillColor = useMemo(() => {
    try { return darken(fillColor, 0.2); } catch { return fillColor; }
  }, [fillColor]);
  fillColor = hovered ? hoverFillColor : fillColor;

  // --- POSITION ---
  const currentX = marker.point?.x || 0;
  const currentY = marker.point?.y || 0;

  // --- SPRITE ---
  const { iconKeys, columns, tile, url: spriteSheetUrl } = spriteImage ?? {};
  const resolvedIndex = Math.max(0, iconKeys?.indexOf(marker?.iconKey) ?? 0);
  const row = Math.floor(resolvedIndex / (columns || 1));
  const col = columns ? resolvedIndex % columns : 0;
  const sheetW = (columns || 1) * (tile || 0);

  // --- LABEL LAYOUT ---
  const labelText = (marker?.entity?.num ?? "").toString();
  const showLabel = Boolean(labelText);
  const textRef = useRef(null);
  const [labelSize, setLabelSize] = useState({ w: 0, h: 0 });
  const labelFontPx = 11;
  const labelPad = 4;
  const gap = -2;

  useLayoutEffect(() => {
    if (!showLabel || !textRef.current) return;
    try {
      const bb = textRef.current.getBBox();
      setLabelSize({ w: Math.ceil(bb.width), h: Math.ceil(bb.height) });
    } catch { }
  }, [showLabel, labelText]);

  const rectW = labelSize.w + labelPad * 2;
  const rectH = Math.max(labelSize.h, Math.ceil(labelFontPx * 1.2));
  const rectX = R_PX * 0.5 + gap;
  const rectY = R_PX * 0.5 + gap;


  // --- LABEL ---

  const labelAnnotation = getAnnotationLabelPropsFromAnnotation(marker);
  const showNodeLabel = Boolean(marker.showLabel);



  // --- RENDU ---
  return (
    <g {...dataProps}>
      <g
        transform={`translate(${currentX}, ${currentY})`}
        style={{
          cursor: dragged ? "grabbing" : "pointer",
          filter: selected ? "drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
          transformBox: "fill-box",
          transformOrigin: "center"
        }}

      >
        {/* GROUPE DE MISE À L'ÉCHELLE DYNAMIQUE */}
        <g style={{ transform: scaleTransform }}>

          {/* Circle */}
          <circle
            cx={0} cy={0}
            r={selected ? R_PX * 1.2 : R_PX}
            fill={fillColor}
            stroke="#fff"
            strokeWidth={STROKE_WIDTH_PX}
            opacity={dragged ? 0.5 : 0.9}
          />

          {/* Sprite icon */}
          {spriteSheetUrl && (
            <svg
              x={-ICON_SIZE_PX / 2}
              y={-ICON_SIZE_PX / 2}
              width={ICON_SIZE_PX}
              height={ICON_SIZE_PX}
              viewBox={`${col * tile} ${row * tile} ${tile} ${tile}`}
              style={{ pointerEvents: "none" }}
            >
              <image
                href={spriteSheetUrl}
                width={sheetW}
                preserveAspectRatio="none"
              />
            </svg>
          )}

          {/* Wide hit ring */}
          <circle
            cx={0} cy={0}
            r={R_PX}
            fill="transparent"
            stroke="transparent"
            strokeWidth={hitStrokePx}
            pointerEvents="stroke"
          />

          {/* Label */}
          {showLabel && (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={rectX} y={rectY} width={rectW} height={rectH}
                rx={4} ry={4}
                fill="#fff"
                //stroke={hasImages ? fillColor : grey[600]}
                stroke={fillColor}
                strokeWidth={1}
              />
              <text
                ref={textRef}
                x={rectX + labelPad}
                y={rectY + rectH / 2}
                dominantBaseline="middle"
                fontSize={labelFontPx}
                fontFamily="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
                fill={hasImages ? "#111" : grey[600]}
                fontWeight="600"
              >
                {labelText}
              </text>
            </g>
          )}

          {/* Crosshair */}
          {dragged && (
            <g style={{ pointerEvents: "none" }}>
              <line x1={-R_PX * 0.5} y1={0} x2={R_PX * 0.5} y2={0} stroke="#000" strokeWidth={1} strokeOpacity={0.7} strokeLinecap="round" />
              <line x1={0} y1={-R_PX * 0.5} x2={0} y2={R_PX * 0.5} stroke="#000" strokeWidth={1} strokeOpacity={0.7} strokeLinecap="round" />
            </g>
          )}
        </g>

      </g>

      {/* LABEL */}
      {showNodeLabel && <NodeLabelStatic
        annotation={labelAnnotation}
        containerK={containerK}
        hidden={!showNodeLabel} />}
    </g>
  );
}