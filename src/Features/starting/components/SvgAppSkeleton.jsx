import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import DiagramZone from "./DiagramZone";

import makeZoneProps from "../utils/makeZoneProps";

// Skeleton of the editor screen (section « Naviguer dans l'appli »), scaled
// from LayoutDesktop / SectionViewer in the Dessin module: top bar, module
// band, docked module panel, commands toolbar docked LEFT, 2D/3D editor with
// the floating annotations panel, properties drawer, tools band, bottom bar.
// Every block is a DiagramZone whose id is listed in APP_COMPONENTS[].zones.
export default function SvgAppSkeleton({
  highlightedZones,
  onZoneClick,
  vocabulary: v,
}) {
  const theme = useTheme();

  // helpers

  const orange = theme.palette.secondary.main;
  const grey = theme.palette.grey;
  const text = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const zoneProps = makeZoneProps(highlightedZones, theme);
  const zone = (id, children) => (
    <DiagramZone
      key={id}
      zone={id}
      zoneProps={zoneProps}
      onZoneClick={onZoneClick}
    >
      {children}
    </DiagramZone>
  );

  // render

  return (
    <Box
      component="svg"
      viewBox="0 0 1200 720"
      sx={{
        width: 1,
        height: "auto",
        display: "block",
        fontSize: 12,
        fontFamily: "inherit",
        "& text": { fill: text },
        "& g[data-highlighted='true'] [data-accent-stroke]": {
          stroke: orange,
          strokeWidth: 2.5,
        },
      }}
    >
      <rect
        x="0.5"
        y="0.5"
        width="1199"
        height="719"
        fill="white"
        stroke={grey[300]}
      />

      {/* module band (black, far left) */}
      {zone(
        "module_band",
        <>
          <rect
            x="0"
            y="48"
            width="80"
            height="636"
            fill={theme.palette.common.black}
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect
                x="20"
                y={70 + i * 64}
                width="40"
                height="32"
                rx="6"
                fill={alpha("#ffffff", i === 1 ? 0.35 : 0.14)}
              />
              <rect
                x="22"
                y={108 + i * 64}
                width="36"
                height="6"
                rx="3"
                fill={alpha("#ffffff", 0.3)}
              />
            </g>
          ))}
          <text
            x="40"
            y="676"
            textAnchor="middle"
            fontSize="10"
            fill={alpha("#ffffff", 0.7)}
          >
            Modules
          </text>
        </>
      )}

      {/* module panel (docked) */}
      {zone(
        "module_panel",
        <>
          <rect
            x="80"
            y="48"
            width="280"
            height="636"
            fill={grey[50]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text x="96" y="78" fontWeight="700">
            Dessin
          </text>
          <text x="96" y="100" fontSize="10" fill={muted}>
            Panneau du module
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect
              key={i}
              x="96"
              y={116 + i * 28}
              width={248 - (i % 3) * 40}
              height="14"
              rx="4"
              fill={grey[200]}
            />
          ))}
        </>
      )}

      {/* commands toolbar, docked left of the editor */}
      {zone(
        "commands_toolbar",
        <>
          <rect
            x="360"
            y="48"
            width="40"
            height="636"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x="368"
              y={72 + i * 40}
              width="24"
              height="24"
              rx="4"
              fill={grey[300]}
            />
          ))}
        </>
      )}

      {/* editor */}
      {zone(
        "editor",
        <>
          <rect
            x="400"
            y="48"
            width="730"
            height="636"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <path
            d="M520 220 H1000 V580 H520 Z M760 220 V580 M520 400 H760"
            fill="none"
            stroke={grey[400]}
            strokeWidth="4"
          />
          <rect
            x="560"
            y="260"
            width="120"
            height="90"
            fill={alpha(orange, 0.35)}
            stroke={orange}
          />
          <circle cx="900" cy="300" r="7" fill={theme.palette.info.main} />
          <text x="1110" y="672" textAnchor="end" fontSize="10" fill={muted}>
            Éditeur 2D / 3D
          </text>
        </>
      )}

      {/* floating annotations panel */}
      {zone(
        "annotations_panel",
        <>
          <rect
            x="450"
            y="98"
            width="240"
            height="300"
            rx="6"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text x="466" y="124" fontWeight="700">
            Annotations
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect
                x="466"
                y={142 + i * 36}
                width="12"
                height="12"
                fill={i % 2 ? theme.palette.info.main : orange}
              />
              <rect
                x="486"
                y={144 + i * 36}
                width={140 - (i % 2) * 40}
                height="8"
                rx="3"
                fill={grey[200]}
              />
            </g>
          ))}
        </>
      )}

      {/* properties drawer */}
      {zone(
        "properties_panel",
        <>
          <rect
            x="790"
            y="48"
            width="340"
            height="636"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text x="806" y="78" fontWeight="700">
            Propriétés
          </text>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect
                x="806"
                y={100 + i * 56}
                width="90"
                height="8"
                rx="3"
                fill={grey[300]}
              />
              <rect
                x="806"
                y={114 + i * 56}
                width="308"
                height="26"
                rx="4"
                fill="white"
                stroke={grey[300]}
              />
            </g>
          ))}
        </>
      )}

      {/* tools band (right) */}
      {zone(
        "tools_band",
        <>
          <rect
            x="1130"
            y="48"
            width="70"
            height="636"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          {["I", "E", "C", "X", "V", "H"].map((k, i) => (
            <g key={k}>
              <rect
                x="1149"
                y={72 + i * 72}
                width="32"
                height="32"
                rx="6"
                fill={i === 0 ? alpha(orange, 0.2) : grey[200]}
              />
              <text
                x="1165"
                y={122 + i * 72}
                textAnchor="middle"
                fontSize="10"
                fill={muted}
              >
                {k}
              </text>
            </g>
          ))}
        </>
      )}

      {/* top bar and its controls */}
      {zone(
        "top_bar",
        <rect
          x="0"
          y="0"
          width="1200"
          height="48"
          fill="white"
          stroke={grey[300]}
          data-accent-stroke=""
        />
      )}
      {zone(
        "home",
        <>
          <circle
            cx="24"
            cy="24"
            r="13"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <path
            d="M17 24 L24 18 L31 24 M19 23 V30 H29 V23"
            fill="none"
            stroke={text}
            strokeWidth="1.6"
          />
        </>
      )}
      {zone(
        "dock",
        <>
          <rect
            x="48"
            y="12"
            width="24"
            height="24"
            rx="4"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <rect
            x="53"
            y="17"
            width="14"
            height="14"
            fill="none"
            stroke={text}
            strokeWidth="1.4"
          />
          <line
            x1="58"
            y1="17"
            x2="58"
            y2="31"
            stroke={text}
            strokeWidth="1.4"
          />
        </>
      )}
      {zone(
        "project",
        <>
          <rect
            x="90"
            y="12"
            width="140"
            height="24"
            rx="6"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text
            x="160"
            y="28"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
          >
            {`Nom du ${v.projectLowerS}`}
          </text>
        </>
      )}
      {zone(
        "scope",
        <>
          <rect
            x="242"
            y="12"
            width="140"
            height="24"
            rx="6"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text
            x="306"
            y="28"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={orange}
          >
            {`${v.scopeS} ▾`}
          </text>
        </>
      )}
      {zone(
        "base_map",
        <>
          <rect
            x="500"
            y="12"
            width="200"
            height="24"
            rx="6"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text
            x="600"
            y="28"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
          >
            Fond de plan ▾
          </text>
        </>
      )}
      {zone(
        "save",
        <>
          <rect
            x="1080"
            y="12"
            width="110"
            height="24"
            rx="6"
            fill={orange}
            data-accent-stroke=""
          />
          <text
            x="1135"
            y="28"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="white"
          >
            Enregistrer
          </text>
        </>
      )}

      {/* bottom bar, never highlighted */}
      {zone(
        "neutral",
        <>
          <rect
            x="0"
            y="684"
            width="1200"
            height="36"
            fill={grey[50]}
            stroke={grey[300]}
          />
          {[16, 96, 176].map((x) => (
            <rect
              key={x}
              x={x}
              y="697"
              width="64"
              height="10"
              rx="5"
              fill={grey[300]}
            />
          ))}
        </>
      )}
    </Box>
  );
}
