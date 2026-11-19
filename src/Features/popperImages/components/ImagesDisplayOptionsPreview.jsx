import { useSelector } from "react-redux";

import {
  selectImagesConnector,
  selectImagesDisplayMode,
  selectImagesLinkNumber,
  selectImagesPanelColumns,
} from "../popperImagesSlice";

import { Box, Typography } from "@mui/material";

import ImageIndexBadgeSvg from "./ImageIndexBadgeSvg";
import ImageLinkArrowHead from "./ImageLinkArrowHead";

import { IMAGE_LINK_STROKE_WIDTH } from "../constants/imageDisplay";
import {
  DEFAULT_IMAGE_CONNECTOR_SIZE,
  IMAGE_CONNECTOR_DASH,
} from "Features/imageAnnotations/utils/getImageConnectorConfig";

// ---------------------------------------------------------------------------
// ImagesDisplayOptionsPreview — schematic of what the current photos display
// settings give (right side of DialogImagesDisplayOptions). Not to scale: a
// plan, two photos (one moved away from its anchor, one pinned on it) and,
// off in situ, the overlay panel or the print-zone bands holding the tiles.
// ---------------------------------------------------------------------------

const W = 300;
const H = 250;
const ARROW_HEAD_PATH = "M0,0 L-13,-5.5 L-13,5.5 Z";
const PLAN_STROKE = "#b0b8bf";

// Anchors of the two photos on the plan.
const ANCHOR_A = { x: 86, y: 168 };
const ANCHOR_B = { x: 150, y: 96 };

function Photo({ x, y, width, height }) {
  return (
    <g style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.25))" }}>
      <rect
        x={x - 3}
        y={y - 3}
        width={width + 6}
        height={height + 6}
        rx={3}
        fill="#fff"
      />
      <rect x={x} y={y} width={width} height={height} rx={1.5} fill="#bcd6e3" />
      <circle
        cx={x + width * 0.74}
        cy={y + height * 0.3}
        r={Math.min(width, height) * 0.1}
        fill="#f6e3a1"
      />
      <path
        d={`M${x},${y + height} L${x + width * 0.34},${y + height * 0.42} L${
          x + width * 0.56
        },${y + height * 0.72} L${x + width * 0.7},${y + height * 0.56} L${
          x + width
        },${y + height} Z`}
        fill="#8fa9a0"
      />
    </g>
  );
}

function Badge({ x, y, number, scale = 1, fill }) {
  return (
    <g transform={`translate(${x}, ${y}) scale(${scale})`}>
      <ImageIndexBadgeSvg number={number} fill={fill} />
    </g>
  );
}

function Dot({ x, y, r = 4, fill }) {
  return (
    <circle cx={x} cy={y} r={r} fill={fill} stroke="#fff" strokeWidth={1.5} />
  );
}

export default function ImagesDisplayOptionsPreview() {
  // strings

  const captionByMode = {
    IN_SITU:
      "In situ : la photo est sur le plan. Déplacée, elle reste reliée à son point d'ancrage par le connecteur.",
    EX_SITU:
      "Overlay : les photos sont listées dans un panneau flottant, seuls les points d'ancrage restent sur le plan.",
    PRINT_ZONES:
      "Zones : les photos sont réparties autour du plan, seuls les points d'ancrage restent sur le plan.",
  };

  // data

  const displayMode = useSelector(selectImagesDisplayMode);
  const linkNumber = useSelector(selectImagesLinkNumber);
  const connector = useSelector(selectImagesConnector);
  const panelColumns = useSelector(selectImagesPanelColumns);

  // helpers

  const inSitu = displayMode === "IN_SITU";
  const zones = displayMode === "PRINT_ZONES";
  const hasLine = connector.line !== "NONE";
  const dash = connector.line === "DASHED" ? IMAGE_CONNECTOR_DASH : undefined;
  // Readable whatever the size: the schematic is not to scale.
  const markerScale = Math.min(
    2.2,
    Math.max(0.6, connector.size / DEFAULT_IMAGE_CONNECTOR_SIZE)
  );

  // Plan rectangle: full frame in situ, leaves room for the panel / bands.
  const plan = inSitu
    ? { x: 16, y: 16, width: W - 32, height: H - 32 }
    : zones
      ? { x: 16, y: 62, width: W - 104, height: H - 78 }
      : { x: 16, y: 16, width: W - 124, height: H - 32 };

  // helpers - in situ

  function renderInSitu() {
    // Photo A: moved away from its anchor (link line). Photo B: pinned, its
    // top-left corner on the anchor.
    const photoA = { x: 168, y: 150, width: 92, height: 62 };
    const photoB = { x: ANCHOR_B.x, y: ANCHOR_B.y, width: 78, height: 52 };
    const lineEnd = { x: photoA.x - 3, y: photoA.y + 24 };
    const angle =
      (Math.atan2(ANCHOR_A.y - lineEnd.y, ANCHOR_A.x - lineEnd.x) * 180) /
      Math.PI;
    const numberOnAnchor = connector.end === "NUMBER";
    return (
      <>
        {hasLine && (
          <line
            x1={ANCHOR_A.x}
            y1={ANCHOR_A.y}
            x2={lineEnd.x}
            y2={lineEnd.y}
            stroke={connector.color}
            strokeWidth={1.5}
            strokeDasharray={dash}
          />
        )}
        <Photo {...photoA} />
        <Photo {...photoB} />
        {/* End marker of the detached photo */}
        {numberOnAnchor ? (
          <Badge
            {...ANCHOR_A}
            number={1}
            scale={markerScale}
            fill={connector.color}
          />
        ) : (
          <g
            transform={`translate(${ANCHOR_A.x}, ${ANCHOR_A.y}) scale(${markerScale})`}
          >
            {connector.end === "ARROW" ? (
              <path
                d={ARROW_HEAD_PATH}
                transform={`rotate(${angle})`}
                fill={connector.color}
                stroke="#fff"
                strokeWidth={1}
                strokeLinejoin="round"
              />
            ) : (
              <circle
                r={5}
                fill={connector.color}
                stroke="#fff"
                strokeWidth={1.5}
              />
            )}
          </g>
        )}
        {/* "Numéro": number on the photo's top-left corner */}
        {linkNumber && (
          <Badge
            x={photoA.x}
            y={photoA.y}
            number={1}
            scale={markerScale}
            fill={connector.color}
          />
        )}
        {(numberOnAnchor || linkNumber) && (
          <Badge
            {...ANCHOR_B}
            number={2}
            scale={markerScale}
            fill={connector.color}
          />
        )}
      </>
    );
  }

  // helpers - off in situ (overlay panel / print zones)

  function renderOffSitu() {
    const anchors = [ANCHOR_A, ANCHOR_B].map((a) =>
      zones ? { x: a.x - 6, y: a.y + 14 } : { x: a.x - 14, y: a.y - 6 }
    );
    let frame = null;
    let tiles;
    if (zones) {
      // Tiles in the top and right bands, around the plan.
      tiles = [
        { x: 234, y: 128, width: 52, height: 36 },
        { x: 96, y: 14, width: 52, height: 36 },
      ];
    } else {
      const panel = { x: 204, y: 16, width: 84, height: H - 32 };
      frame = (
        <g style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
          <rect {...panel} rx={6} fill="#fff" />
          <rect
            x={panel.x + 8}
            y={panel.y + 8}
            width={34}
            height={5}
            rx={2.5}
            fill="#d5dadf"
          />
        </g>
      );
      tiles =
        panelColumns === 2
          ? [
              { x: 212, y: 44, width: 32, height: 24 },
              { x: 250, y: 44, width: 32, height: 24 },
            ]
          : [
              { x: 214, y: 44, width: 64, height: 44 },
              { x: 214, y: 100, width: 64, height: 44 },
            ];
    }
    return (
      <>
        {frame}
        {hasLine &&
          tiles.map((t, i) => {
            // From the tile edge facing the anchor.
            const a = anchors[i];
            const from =
              zones && i === 1
                ? { x: t.x + t.width / 2, y: t.y + t.height + 3 }
                : { x: t.x - 3, y: t.y + t.height / 2 };
            return (
              <g key={i}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={a.x}
                  y2={a.y}
                  stroke={connector.color}
                  strokeWidth={IMAGE_LINK_STROKE_WIDTH}
                  strokeDasharray={dash}
                />
                {connector.end === "ARROW" && (
                  <ImageLinkArrowHead
                    from={from}
                    to={a}
                    color={connector.color}
                  />
                )}
              </g>
            );
          })}
        {tiles.map((t, i) => (
          <g key={i}>
            <Photo {...t} />
            {linkNumber && (
              <Badge x={t.x + 4} y={t.y + 3} number={i + 1} scale={0.8} />
            )}
          </g>
        ))}
        {/* End marker on the anchor (the arrow head rides the line). */}
        {anchors.map((a, i) =>
          connector.end === "NUMBER" ? (
            <Badge key={i} {...a} number={i + 1} />
          ) : connector.end === "ARROW" && hasLine ? null : (
            <Dot key={i} {...a} fill={connector.color} />
          )
        )}
      </>
    );
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Box
        component="svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Aperçu de l'affichage des photos"
        sx={{
          width: 1,
          height: "auto",
          display: "block",
          borderRadius: 1,
          bgcolor: "grey.100",
        }}
      >
        {/* Plan: a sheet with a few walls */}
        <rect {...plan} rx={2} fill="#fff" stroke={PLAN_STROKE} />
        <path
          d={`M${plan.x + plan.width * 0.12},${plan.y + plan.height * 0.2} H${
            plan.x + plan.width * 0.7
          } V${plan.y + plan.height * 0.85} H${plan.x + plan.width * 0.12} Z M${
            plan.x + plan.width * 0.42
          },${plan.y + plan.height * 0.2} V${plan.y + plan.height * 0.55} H${
            plan.x + plan.width * 0.12
          }`}
          fill="none"
          stroke={PLAN_STROKE}
          strokeWidth={2}
        />
        {inSitu ? renderInSitu() : renderOffSitu()}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        {captionByMode[displayMode]}
      </Typography>
    </Box>
  );
}
