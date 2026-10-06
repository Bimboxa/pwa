import { memo, useMemo, useRef, useState } from "react";

import useSheetDrag from "../hooks/useSheetDrag";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";

import {
  MapZoomContext,
  createMapZoomStore,
} from "Features/mapEditorGeneric/hooks/useMapZoom";
import { sortOpeningsLast } from "Features/annotations/utils/isOpeningAnnotation";
import filterAnnotationsByViewBox from "Features/annotations/utils/filterAnnotationsByViewBox";

import theme from "Styles/theme";

import {
  FADE_DURATION_MS,
  LIFT_DURATION_MS,
  LIFT_OFFSET,
  RAISE_OFFSET,
} from "../constants/baseMapsGridConstants";

export const SHEET_SHADOW_FILTER_ID = "base-maps-grid-sheet-shadow";
export const SHEET_LIFTED_SHADOW_FILTER_ID =
  "base-maps-grid-sheet-shadow-lifted";

// The sheets are drawn like paper (same rendering as the portfolio pages):
// the annotations must not counter-scale with the grid camera, so every sheet
// resets the zoom published by the viewport (CSS variable + JS store) to 1 —
// containerK carries the whole scale.
const PAPER_ZOOM_STORE = createMapZoomStore(1);

const NAME_FONT_SIZE = 16;
const NAME_OFFSET = 26;

// annotations counter, on the name row (right-aligned under the sheet)
const COUNT_HEIGHT = 24;
const COUNT_FONT_SIZE = 14;
const COUNT_CHAR_WIDTH = 8.5;
const COUNT_PADDING_X = 9;

// One base map lying on the table: a sheet of paper sized like the page of
// its print zone, the image + annotations framed by the print zone on top.
// Read-only content. Outside the "Réorganiser" mode a click opens the sheet;
// in the "Réorganiser" mode a click selects it and a drag moves it.
// The paper lies flat on the table (no shadow) and rises under the pointer or
// when selected. The sheet can only be dragged in the "Réorganiser" mode
// (`movable`): every paper then lifts off the table (higher shadow). Otherwise a
// press on a sheet pans the table and its click is handled by the table (see
// LayerBaseMapsGrid).
export default memo(function BaseMapSheetSvg({
  baseMap,
  sheet,
  annotations,
  // annotations of the base map in the scope (same count as the chips)
  annotationsCount,
  spriteImage,
  selected,
  // false: only the content shows (the sheet handed over by / to the editor)
  chromeVisible,
  // false: the whole sheet is faded out
  visible,
  hideImage,
  imageOpacity,
  grayScale,
  disabled,
  movable,
  getZoom,
  onSelect,
  onMove,
}) {
  // state

  const [hovered, setHovered] = useState(false);

  // refs

  const groupRef = useRef(null);

  // helpers

  const { printZone } = sheet;
  const imageSize = baseMap.getImageSize?.();
  const meterByPx = baseMap.getMeterByPx?.() ?? null;
  const version = baseMap.getActiveVersion?.();
  const viewBoxStr = `${printZone.x} ${printZone.y} ${printZone.width} ${printZone.height}`;
  const containerK = sheet.scale;
  const clipId = `base-maps-grid-clip-${baseMap.id}`;

  // Openings last: their white gap must cover the host wall.
  const nonLabelAnnotations = useMemo(
    () => sortOpeningsLast(annotations?.filter((a) => a.type !== "LABEL")),
    [annotations]
  );
  const labelAnnotations = useMemo(
    () =>
      filterAnnotationsByViewBox(
        annotations?.filter((a) => a.type === "LABEL"),
        printZone
      ),
    [annotations, printZone]
  );

  const fade = `opacity ${FADE_DURATION_MS}ms ease`;

  // Elevation. Flat while the sheet is handed over by / to the editor
  // (disabled): a rise would shift it off the editor's frame.
  const lifted = !disabled && movable;
  const raised = !disabled && !movable && (hovered || selected);
  const elevationOffset = lifted ? LIFT_OFFSET : raised ? RAISE_OFFSET : 0;

  const countS = String(annotationsCount ?? 0);
  const countWidth = Math.max(
    COUNT_HEIGHT,
    countS.length * COUNT_CHAR_WIDTH + 2 * COUNT_PADDING_X
  );
  const nameMaxWidth = sheet.width - countWidth - 12;

  // handlers

  const dragHandlers = useSheetDrag({
    sheet,
    groupRef,
    getZoom,
    disabled: disabled || !movable,
    onClick: () => onSelect?.(baseMap.id),
    onCommit: (position) => onMove?.(baseMap.id, position),
  });

  // render

  return (
    <g
      ref={groupRef}
      data-sheet-id={baseMap.id}
      data-sheet-movable={movable ? "" : undefined}
      transform={`translate(${sheet.x}, ${sheet.y})`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      {...dragHandlers}
      style={{
        "--map-zoom": 1,
        cursor: disabled ? "default" : movable ? "grab" : "pointer",
        opacity: visible ? 1 : 0,
        transition: fade,
      }}
    >
      {/* Still hit area: the paper rises under the pointer, the hover must
          not depend on the moving paper (flicker along the bottom edge). */}
      <rect width={sheet.width} height={sheet.height} fill="transparent" />

      <g
        style={{
          transform: `translateY(${-elevationOffset}px)`,
          transition: `transform ${LIFT_DURATION_MS}ms ease`,
        }}
      >
      {/* paper: flat, the shadows of both elevations cross-fade over it */}
      <rect
        width={sheet.width}
        height={sheet.height}
        fill="white"
        style={{ opacity: chromeVisible ? 1 : 0, transition: fade }}
      />
      <rect
        width={sheet.width}
        height={sheet.height}
        fill="white"
        filter={`url(#${SHEET_SHADOW_FILTER_ID})`}
        style={{
          opacity: chromeVisible && raised ? 1 : 0,
          transition: `opacity ${LIFT_DURATION_MS}ms ease`,
          pointerEvents: "none",
        }}
      />
      <rect
        width={sheet.width}
        height={sheet.height}
        fill="white"
        filter={`url(#${SHEET_LIFTED_SHADOW_FILTER_ID})`}
        style={{
          opacity: chromeVisible && lifted ? 1 : 0,
          transition: `opacity ${LIFT_DURATION_MS}ms ease`,
          pointerEvents: "none",
        }}
      />

      <MapZoomContext.Provider value={PAPER_ZOOM_STORE}>
        {imageSize && (
          <svg
            width={sheet.width}
            height={sheet.height}
            viewBox={viewBoxStr}
            style={{ pointerEvents: "none" }}
          >
            <defs>
              <clipPath id={clipId}>
                <rect
                  x={printZone.x}
                  y={printZone.y}
                  width={printZone.width}
                  height={printZone.height}
                />
              </clipPath>
            </defs>

            <g clipPath={`url(#${clipId})`}>
              {!hideImage && version?.image?.imageSize && (
                <g
                  transform={`translate(${version.transform?.x ?? 0}, ${
                    version.transform?.y ?? 0
                  }) scale(${version.transform?.scale ?? 1}) rotate(${
                    version.transform?.rotation ?? 0
                  })`}
                >
                  <NodeSvgImage
                    src={
                      version.image.imageUrlClient ??
                      version.image.imageUrlRemote
                    }
                    dataNodeId={`grid-${baseMap.id}`}
                    width={version.image.imageSize.width}
                    height={version.image.imageSize.height}
                    opacity={imageOpacity}
                    grayScale={grayScale}
                  />
                </g>
              )}
              {!hideImage && !version && (
                <NodeSvgImage
                  src={baseMap.getUrl()}
                  dataNodeId={`grid-${baseMap.id}`}
                  width={imageSize.width}
                  height={imageSize.height}
                  opacity={imageOpacity}
                  grayScale={grayScale}
                />
              )}
              {nonLabelAnnotations?.map((annotation) => (
                <NodeAnnotationStatic
                  key={annotation.id}
                  annotation={annotation}
                  imageSize={imageSize}
                  baseMapMeterByPx={meterByPx}
                  containerK={containerK}
                  spriteImage={spriteImage}
                  printMode
                />
              ))}
            </g>
          </svg>
        )}

        {/* Labels in a separate overflow-visible svg so they stay on top */}
        {imageSize && labelAnnotations?.length > 0 && (
          <svg
            width={sheet.width}
            height={sheet.height}
            viewBox={viewBoxStr}
            overflow="visible"
            style={{ pointerEvents: "none" }}
          >
            {labelAnnotations.map((annotation) => (
              <NodeAnnotationStatic
                key={annotation.id}
                annotation={annotation}
                imageSize={imageSize}
                baseMapMeterByPx={meterByPx}
                containerK={containerK}
                printMode
              />
            ))}
          </svg>
        )}
      </MapZoomContext.Provider>

      {/* chrome: selection frame + name */}
      <g
        style={{
          opacity: chromeVisible ? 1 : 0,
          transition: fade,
          pointerEvents: "none",
        }}
      >
        <rect
          width={sheet.width}
          height={sheet.height}
          fill="none"
          stroke={selected ? theme.palette.primary.main : "rgba(0,0,0,0.12)"}
          strokeWidth={selected ? 2 : 1}
          vectorEffect="non-scaling-stroke"
        />
        <clipPath id={`${clipId}-name`}>
          <rect
            x={0}
            y={sheet.height}
            width={Math.max(0, nameMaxWidth)}
            height={NAME_OFFSET + NAME_FONT_SIZE}
          />
        </clipPath>
        <text
          clipPath={`url(#${clipId}-name)`}
          x={0}
          y={sheet.height + NAME_OFFSET}
          fontSize={NAME_FONT_SIZE}
          fontFamily={theme.typography.fontFamily}
          fontWeight={selected ? 600 : 400}
          fill={theme.palette.text.primary}
        >
          {baseMap.name}
        </text>
        <g
          transform={`translate(${sheet.width - countWidth}, ${
            sheet.height + NAME_OFFSET - COUNT_HEIGHT + 6
          })`}
        >
          <rect
            width={countWidth}
            height={COUNT_HEIGHT}
            rx={COUNT_HEIGHT / 2}
            fill={theme.palette.secondary.main}
          />
          <text
            x={countWidth / 2}
            y={COUNT_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={COUNT_FONT_SIZE}
            fontFamily={theme.typography.fontFamily}
            fontWeight={600}
            fill={theme.palette.secondary.contrastText}
          >
            {countS}
          </text>
        </g>
      </g>
      </g>
    </g>
  );
});
