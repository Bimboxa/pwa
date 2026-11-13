import { memo, useId, useMemo } from "react";
import theme from "Styles/theme";

import NodeImageToolbarOverlay from "./NodeImageToolbarOverlay";
import ImageIndexBadgeSvg from "Features/popperImages/components/ImageIndexBadgeSvg";
import {
  getImageAnchorPoint,
  getImageConnectorGeometry,
} from "Features/imageAnnotations/utils/imageConnector";
import {
  IMAGE_VEIL_ELEMENT_OPACITY,
  IMAGE_VEIL_FILL_OPACITY,
} from "Features/popperImages/constants/imageDisplay";

// Taille des poignées de redimensionnement (en pixels écran fixes)
const HANDLE_SIZE = 10; // Un peu plus grand pour faciliter le grab
const HALF_HANDLE = HANDLE_SIZE / 2;
const ROTATION_HANDLE_OFFSET = 30; // Distance de la poignée de rotation (en pixels locaux)

export default memo(function NodeImageStatic({
  imageAnnotation,
  hovered,
  selected,
  dragged,
  grayScale = false,
  containerK = 1,
  draggedPartType,
  baseMapMeterByPx,
  printMode,
  // PopperImages display: "IN_SITU" (photo in the map, numbered) or
  // "EX_SITU" (photo listed in the panel: only the anchor stays here, with
  // its number when the "Numéro" link is on). `imageVeiled`: another image is
  // selected → white veil on the photo, faded connector / badge.
  imagesDisplayMode = "IN_SITU",
  imagesLinkNumber = false,
  imageDisplayIndex,
  imageVeiled = false,
  // PopperImages count pill off: the photo leaves the map entirely.
  imagesHidden = false,
}) {
  const { bbox, image, id, opacity } = imageAnnotation;
  const { x, y, width, height } = bbox ?? {};

  // Fallbacks
  const displayWidth = width || 100;
  const displayHeight = height || 100;
  const src = image?.imageUrlClient;

  // --- 1. CALCUL DE L'ÉCHELLE INVERSE (Même logique que NodePolyline) ---
  // Cela permet de contrer le zoom de la caméra (var(--map-zoom)) et l'échelle du conteneur (containerK)
  // One clipPath per rendered instance: the same annotation may be drawn
  // twice (static layer + transient drag preview) with different sizes.
  const clipId = useId();

  const handleScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // Top-centre of the ROTATED bbox (base-map px): the overlay toolbar sits
  // outside the rotate group so it never turns with the image.
  const overlayAnchor = useMemo(() => {
    const cx = displayWidth / 2;
    const cy = displayHeight / 2;
    const rotation = imageAnnotation.rotation || 0;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const ax = (x || 0) + cx;
    const ay = (y || 0) + cy;
    let minY = Infinity;
    for (const [dx, dy] of [
      [-cx, -cy],
      [cx, -cy],
      [cx, cy],
      [-cx, cy],
    ]) {
      const ry = ay + dx * sin + dy * cos;
      if (ry < minY) minY = ry;
    }
    return { x: ax, y: minY };
  }, [x, y, displayWidth, displayHeight, imageAnnotation.rotation]);

  if (!src || imagesHidden) return null;

  // Props pour le drag global (déplacement)
  const interactionProps = {
    "data-node-id": id,
    "data-node-entity-id": imageAnnotation.entityId,
    "data-node-listing-id": imageAnnotation.listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "IMAGE",
    "data-interaction": "draggable",
  };

  // Floating paper: a white frame around the photo (margin proportional to
  // the print, like a real photo border — an SVG rect cannot follow the
  // screen zoom) and a drop shadow of constant SCREEN size, applied on a
  // group wrapping the rotated one so the shadow offset never turns with the
  // image. No shadow in print / export nor during a drag (the transient
  // preview is translucent anyway).
  const framePad = Math.min(
    24,
    Math.max(2, Math.min(displayWidth, displayHeight) * 0.03)
  );
  const frameRadius = framePad;
  const frameRect = {
    x: -framePad,
    y: -framePad,
    width: displayWidth + 2 * framePad,
    height: displayHeight + 2 * framePad,
    rx: frameRadius,
  };
  const screenPx = (px) =>
    `calc(${px}px / (var(--map-zoom, 1) * ${containerK || 1}))`;
  const paperShadow =
    printMode || dragged
      ? "none"
      : hovered && !selected
        ? `drop-shadow(0 ${screenPx(2)} ${screenPx(3)} rgba(0,0,0,0.3)) drop-shadow(0 ${screenPx(10)} ${screenPx(20)} rgba(0,0,0,0.28))`
        : `drop-shadow(0 ${screenPx(1)} ${screenPx(2)} rgba(0,0,0,0.25)) drop-shadow(0 ${screenPx(6)} ${screenPx(14)} rgba(0,0,0,0.22))`;

  // Style de bordure
  const borderStyle = {
    fill: "none",
    strokeWidth: 2, // On peut mettre une valeur fixe si on utilise vector-effect
    vectorEffect: "non-scaling-stroke", // Garde le trait fin même au zoom
    pointerEvents: "none",
  };

  const cx = displayWidth / 2;
  const cy = displayHeight / 2;
  const rotation = imageAnnotation.rotation || 0;
  const connector = imageAnnotation.hasConnector
    ? getImageConnectorGeometry(imageAnnotation)
    : null;

  // --- 2. RENDU DES POIGNÉES AVEC SCALE FIXE ---
  const renderHandle = (type, hx, hy) => (
    <g
      transform={`translate(${hx}, ${hy})`} // 1. On se place au coin
      style={{ pointerEvents: "auto" }}
    >
      {/* 2. On applique l'échelle inverse pour que le contenu reste fixe à l'écran */}
      <g style={{ transform: handleScaleTransform }}>
        <rect
          x={-HALF_HANDLE} // Centré
          y={-HALF_HANDLE}
          width={HANDLE_SIZE}
          height={HANDLE_SIZE}
          fill="#fff"
          stroke={theme.palette.secondary.main}
          strokeWidth={1.5}
          // Attributs pour l'interaction
          data-interaction="resize-annotation"
          data-handle-type={type}
          data-node-id={id}
          data-node-type="ANNOTATION"
          style={{ cursor: `${type.toLowerCase()}-resize` }}
        />
      </g>
    </g>
  );

  // Poignée de rotation (Ronde, au dessus)
  const renderRotationHandle = () => (
    <g
      transform={`translate(${cx}, ${-ROTATION_HANDLE_OFFSET})`}
      style={{ pointerEvents: "auto" }}
    >
      {/* Ligne de liaison (ne subit pas l'échelle inverse pour rester attachée visuellement) */}
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={ROTATION_HANDLE_OFFSET}
        stroke={theme.palette.editor?.selected || "#00ff00"}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />

      {/* La poignée ronde */}
      <g style={{ transform: handleScaleTransform }}>
        <circle
          cx={0}
          cy={0}
          r={HALF_HANDLE}
          fill="#fff"
          stroke={theme.palette.editor?.selected || "#00ff00"}
          strokeWidth={1.5}
          data-interaction="rotate-annotation" // <--- Nouvelle interaction
          data-node-id={id}
          data-node-type="ANNOTATION"
          style={{ cursor: "grab" }}
        />
      </g>
    </g>
  );

  // Angle badge shown while rotating (counter-rotated to stay readable) —
  // same feedback as NodeObject3DStatic.
  const renderAngleBadge = () => {
    const displayedAngle = Math.round(((rotation % 360) + 360) % 360);
    return (
      <g
        transform={`translate(${cx}, ${cy}) rotate(${-rotation})`}
        style={{ pointerEvents: "none" }}
      >
        <g style={{ transform: handleScaleTransform }}>
          <rect
            x={-26}
            y={-12}
            width={52}
            height={24}
            rx={12}
            fill="rgba(0,0,0,0.75)"
          />
          <text
            x={0}
            y={4}
            textAnchor="middle"
            fill="#fff"
            fontSize={12}
            fontFamily={theme.typography?.fontFamily}
          >
            {displayedAngle}°
          </text>
        </g>
      </g>
    );
  };

  const exSitu = imagesDisplayMode === "EX_SITU";
  const showBadge = imageDisplayIndex != null && !printMode;
  const veilOpacity = imageVeiled ? IMAGE_VEIL_ELEMENT_OPACITY : 1;

  // --- EX SITU: anchor only (dot + optional number) ---
  // The photo lives in PopperImages; the dot keeps the TARGET interaction
  // (click = select, drag = move the anchor) exactly as the in-situ dot.
  if (exSitu) {
    const anchor = getImageAnchorPoint(imageAnnotation);
    return (
      <g style={{ opacity: (dragged ? 0.7 : (opacity ?? 1)) * veilOpacity }}>
        <g transform={`translate(${anchor.x}, ${anchor.y})`}>
          <g style={{ transform: handleScaleTransform }}>
            <circle
              r={selected ? 7 : 5}
              fill="#333"
              stroke={
                selected ? theme.palette.editor?.selected || "#ff9800" : "white"
              }
              strokeWidth={1.5}
              {...interactionProps}
              data-part-type="TARGET"
              style={{ cursor: "crosshair" }}
            />
            {imagesLinkNumber && showBadge && (
              <g transform="translate(12, -12)">
                <ImageIndexBadgeSvg number={imageDisplayIndex} />
              </g>
            )}
          </g>
        </g>
      </g>
    );
  }

  // --- RENDU ---
  return (
    <g style={{ opacity: dragged ? 0.7 : opacity }}>
      {connector && (
        <g style={{ opacity: veilOpacity }}>
          {!connector.inside && (
            <line
              x1={connector.target.x}
              y1={connector.target.y}
              x2={connector.end.x}
              y2={connector.end.y}
              stroke="#333"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
          )}
          <g
            transform={`translate(${connector.target.x}, ${connector.target.y})`}
          >
            <g style={{ transform: handleScaleTransform }}>
              <circle
                r={selected ? 6 : 4}
                fill="#333"
                stroke="white"
                strokeWidth={1.5}
                {...interactionProps}
                data-part-type="TARGET"
                style={{ cursor: "crosshair" }}
              />
            </g>
          </g>
        </g>
      )}
      <g style={{ filter: paperShadow }}>
        <g
          transform={`translate(${x || 0}, ${y || 0}) rotate(${rotation}, ${cx}, ${cy})`}
        >
          {/* Conteneur principal draggable (frame included: grabbable) */}
          <g
            {...interactionProps}
            style={{
              cursor: selected ? "move" : hovered ? "pointer" : "default",
            }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  width={displayWidth}
                  height={displayHeight}
                  rx={Math.max(0, frameRadius - framePad / 2)}
                />
              </clipPath>
            </defs>

            {/* Paper frame */}
            <rect {...frameRect} fill="#fff" />

            <g clipPath={`url("#${clipId}")`}>
              <image
                href={src}
                x={0}
                y={0}
                width={displayWidth}
                height={displayHeight}
                preserveAspectRatio="none"
                transform={
                  imageAnnotation.imageFlipY
                    ? `translate(0, ${displayHeight}) scale(1, -1)`
                    : undefined
                }
                style={{
                  imageRendering: "optimizeSpeed",
                  filter: grayScale ? "grayscale(100%)" : "none",
                }}
              />
            </g>

            {/* White veil: another photo is selected */}
            {imageVeiled && (
              <rect
                {...frameRect}
                fill="#fff"
                fillOpacity={IMAGE_VEIL_FILL_OPACITY}
                pointerEvents="none"
              />
            )}

            {/* Bordure Hover */}
            {hovered && !selected && !dragged && (
              <rect
                {...frameRect}
                {...borderStyle}
                stroke={theme.palette.baseMap.hovered || "#2196f3"}
              />
            )}

            {/* Bordure Sélection */}
            {selected && (
              <rect
                {...frameRect}
                {...borderStyle}
                stroke={theme.palette.baseMap.selected || "#ff9800"}
              />
            )}
          </g>

          {/* Poignées de redimensionnement */}
          {/* Elles sont rendues après l'image pour être au-dessus */}
          {selected && !dragged && (
            <g>
              {renderHandle("NW", 0, 0)}
              {renderHandle("NE", displayWidth, 0)}
              {renderHandle("SW", 0, displayHeight)}
              {renderHandle("SE", displayWidth, displayHeight)}
              {renderRotationHandle()}
            </g>
          )}

          {dragged && draggedPartType === "ROTATE" && renderAngleBadge()}

          {/* Display number (PopperImages tile) — top-left corner, constant
            screen size, counter-rotated to stay readable. */}
          {showBadge && (
            <g
              transform={`rotate(${-rotation})`}
              style={{ pointerEvents: "none" }}
            >
              <g style={{ transform: handleScaleTransform }}>
                <ImageIndexBadgeSvg
                  number={imageDisplayIndex}
                  dimmed={imageVeiled}
                />
              </g>
            </g>
          )}
        </g>
      </g>

      {/* Overlay toolbar (scale / change image) — outside the rotate group */}
      {connector?.inside && selected && !dragged && (
        <g
          transform={`translate(${connector.target.x}, ${connector.target.y})`}
        >
          <g style={{ transform: handleScaleTransform }}>
            <circle
              r={6}
              fill="#333"
              stroke="white"
              strokeWidth={1.5}
              {...interactionProps}
              data-part-type="TARGET"
              style={{ cursor: "crosshair" }}
            />
          </g>
        </g>
      )}
      {selected && !dragged && !printMode && (
        <NodeImageToolbarOverlay
          annotation={imageAnnotation}
          anchor={overlayAnchor}
          containerK={containerK}
          baseMapMeterByPx={baseMapMeterByPx}
        />
      )}
    </g>
  );
});
