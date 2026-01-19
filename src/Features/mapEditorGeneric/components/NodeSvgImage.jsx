// NodeSvgImage.jsx
import { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Rnd } from "react-rnd";

import theme from "Styles/theme";

/**
 * Renders an <image> normally, or a react-rnd editor when poseEditable is true.
 * - Manages a LOCAL delta pose starting at { x:0, y:0, k:1 }
 * - Emits delta via onPoseChangeEnd({ x, y, k }) in the LOCAL SVG coords
 * - Converts CSS <-> LOCAL using F = worldScale * containerK to avoid drift
 * - Prevents bubbling so the map won't pan; wheel bubbles unless interacting
 */
export default memo(function NodeSvgImage({
  src,
  dataNodeId,
  dataNodeType,
  width,
  height,
  worldScale = 1, // MapEditorGeneric.world.k
  containerK = 1, // 🔁 was bgPoseK — the immediate parent's scale (here: basePose.k)
  selected,
  hovered,
  opacity,
  grayScale = false,
  grayLevelThreshold = 255,
}) {
  const refSize = useRef();

  // dataProps

  const dataProps = {
    "data-node-id": dataNodeId,
    "data-node-type": dataNodeType,
    "data-annotation-type": "IMAGE",
  };

  // CSS <-> LOCAL factor: use the scale actually applied at this node
  const _F = useMemo(
    () => (worldScale || 1) * (containerK || 1),
    [worldScale, containerK]
  );
  const F = 1;

  // Border width for hover effect: keep 2px visual size
  const hoverBorderWidth = useMemo(() => {
    const DESIRED_VISUAL_BORDER = 2;
    return DESIRED_VISUAL_BORDER / _F;
  }, [_F]);

  // --- 2. LOGIQUE DU FILTRE SVG (THRESHOLD) ---
  // On génère un ID unique pour ce filtre pour ne pas impacter les autres images
  const filterId = `filter-threshold-${dataNodeId}`;
  const hasThreshold = grayLevelThreshold < 255 - 10;

  const matrixValues = useMemo(() => {
    if (!hasThreshold) return "";

    const slope = 50; // Netteté de la coupure
    const t = grayLevelThreshold / 255;

    // Coefficients pour le calcul de l'Alpha (Seuil)
    const r = -0.2126 * slope;
    const g = -0.7152 * slope;
    const b = -0.0722 * slope;
    const off = slope * t;

    // CORRECTION ICI : 
    // Les 3 premières lignes sont maintenant l'identité (1 0 0 0 0 ...)
    // Cela préserve les couleurs Rouge, Vert, Bleu d'origine.
    // La 4ème ligne applique le seuil sur l'Alpha.
    return `
            1 0 0 0 0 
            0 1 0 0 0 
            0 0 1 0 0 
            ${r} ${g} ${b} 1 ${off}
        `;
  }, [grayLevelThreshold, hasThreshold]);

  // --- CHOIX DU STYLE FINAL ---
  // Si on a un threshold, on utilise notre filtre SVG custom.
  // Sinon, on utilise le simple filtre grayscale CSS si demandé.
  const finalFilter = hasThreshold
    ? `url(#${filterId})`
    : (grayScale ? "grayscale(100%)" : "none");


  if (!src || !width || !height) return null;



  return (
    <g>
      {/* Définition du filtre local à cette image */}
      {hasThreshold && (
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB">
            {/* Étape 1 : On applique le seuil (conserve les couleurs, modifie l'alpha) */}
            <feColorMatrix
              in="SourceGraphic"
              result="matrixResult"
              type="matrix"
              values={matrixValues}
            />

            {/* Étape 2 (CORRECTION) : On force le respect de la transparence d'origine.
                'operator="in"' signifie : Affiche le résultat de 'matrixResult' UNIQUEMENT 
                là où 'SourceGraphic' (l'image originale) est visible. 
                Les zones transparentes redeviennent transparentes. */}
            <feComposite
              operator="in"
              in="matrixResult"
              in2="SourceGraphic"
            />
          </filter>
        </defs>
      )}

      <image
        href={src}
        x={0}
        y={0}
        width={width}
        height={height}
        preserveAspectRatio="xMidYMid meet"
        //preserveAspectRatio="none"
        style={{
          imageRendering: "optimizeSpeed",
          opacity: opacity,
          filter: finalFilter,
        }}
        {...dataProps}
      />
      {hovered && !selected && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={theme.palette.baseMap.hovered}
          strokeWidth={hoverBorderWidth}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
      {selected && (
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="none"
          stroke={theme.palette.baseMap.selected}
          strokeWidth={hoverBorderWidth}
          pointerEvents="none"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </g>
  );
});
