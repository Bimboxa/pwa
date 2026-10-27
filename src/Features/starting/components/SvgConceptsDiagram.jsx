import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import DiagramZone from "./DiagramZone";

import makeZoneProps from "../utils/makeZoneProps";

// Synthesis diagram of the key concepts (section « Concepts clés »). Left to
// right: the project line, the scope spine with its scope pills, the scope
// frame (templates listing + annotated base map + thumbnails + 3D box), the
// exports; at the bottom the project's base maps folder feeding the scope.
// Every block is a DiagramZone whose id is listed in CONCEPTS[].zones.
export default function SvgConceptsDiagram({
  highlightedZones,
  onZoneClick,
  vocabulary: v,
}) {
  const theme = useTheme();

  // helpers

  const orange = theme.palette.secondary.main;
  const dark = theme.palette.primary.main;
  const blue = theme.palette.info.main;
  const grey = theme.palette.grey;
  const text = theme.palette.text.primary;
  const muted = theme.palette.text.secondary;
  const zoneProps = makeZoneProps(highlightedZones, theme);
  const zone = (id, children, rest) => (
    <DiagramZone
      key={id}
      zone={id}
      zoneProps={zoneProps}
      onZoneClick={onZoneClick}
      {...rest}
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
      <defs>
        <marker
          id="starting-arrow-orange"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill={orange} />
        </marker>
        <marker
          id="starting-arrow-dark"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 Z" fill={dark} />
        </marker>
      </defs>

      {/* project */}
      {zone(
        "project-label",
        <text x="20" y="40" fontSize="14" fontWeight="700">
          {v.projectTypesS
            ? v.projectTypesS.replace(/ \/ /g, " | ")
            : v.projectS}
        </text>
      )}
      {zone(
        "project-line",
        <>
          <line
            x1="60"
            y1="60"
            x2="60"
            y2="690"
            stroke={dark}
            strokeWidth="3"
          />
          <circle cx="60" cy="160" r="5" fill={dark} />
          <circle cx="60" cy="640" r="5" fill={dark} />
        </>
      )}
      {zone(
        "link-project-spine",
        <line
          x1="60"
          y1="160"
          x2="200"
          y2="160"
          stroke={dark}
          strokeWidth="2"
        />
      )}
      {zone(
        "link-project-folder",
        <line
          x1="60"
          y1="640"
          x2="320"
          y2="640"
          stroke={dark}
          strokeWidth="2"
        />
      )}

      {/* scope spine + pills */}
      {zone(
        "scope-spine",
        <>
          <text
            x="200"
            y="148"
            textAnchor="middle"
            fontWeight="700"
            fill={orange}
          >
            {v.scopePluralS}
          </text>
          <line
            x1="200"
            y1="160"
            x2="200"
            y2="640"
            stroke={orange}
            strokeWidth="3"
          />
          <circle cx="200" cy="216" r="5" fill={orange} />
          <circle cx="200" cy="282" r="5" fill={orange} />
        </>
      )}
      {zone(
        "scope-pill-a",
        <>
          <rect x="125" y="196" width="150" height="40" rx="20" fill={orange} />
          <text
            x="200"
            y="213"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="white"
          >
            <tspan>Repérage</tspan>
            <tspan x="200" dy="13">
              des prestations
            </tspan>
          </text>
        </>
      )}
      {zone(
        "scope-pill-b",
        <>
          <rect
            x="125"
            y="262"
            width="150"
            height="40"
            rx="20"
            fill="white"
            stroke={orange}
            strokeWidth="2"
          />
          <text
            x="200"
            y="279"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={orange}
          >
            <tspan>Plan d&apos;installation</tspan>
            <tspan x="200" dy="13">
              de chantier
            </tspan>
          </text>
        </>
      )}
      {zone(
        "link-pill-frame",
        <line
          x1="275"
          y1="216"
          x2="318"
          y2="216"
          stroke={orange}
          strokeWidth="2"
          markerEnd="url(#starting-arrow-orange)"
        />
      )}

      {/* scope frame */}
      {zone(
        "scope-frame",
        <rect
          x="320"
          y="80"
          width="700"
          height="440"
          rx="12"
          fill="white"
          stroke={orange}
          strokeWidth="2"
          data-accent-stroke=""
        />
      )}
      {zone(
        "scope-title",
        <text x="340" y="106" fontSize="14" fontWeight="700" fill={orange}>
          {`${v.scopeS} — Repérage des prestations`}
        </text>
      )}

      {/* templates listing */}
      {zone(
        "listing-panel",
        <rect
          x="340"
          y="120"
          width="200"
          height="250"
          rx="6"
          fill={grey[50]}
          stroke={grey[300]}
        />
      )}
      {zone(
        "listing-a",
        <text x="352" y="144" fontWeight="700">
          Procédé A
        </text>
      )}
      {zone(
        "template-courante",
        <>
          <rect x="352" y="159" width="14" height="14" fill={orange} />
          <text x="374" y="171">
            Partie courante
          </text>
        </>
      )}
      {zone(
        "template-releve",
        <>
          <line
            x1="352"
            y1="192"
            x2="366"
            y2="192"
            stroke={blue}
            strokeWidth="3"
          />
          <text x="374" y="196">
            Relevé
          </text>
        </>
      )}
      {zone(
        "template-ep",
        <>
          <circle cx="359" cy="218" r="5" fill={blue} />
          <text x="374" y="222">
            EP
          </text>
        </>
      )}
      {zone(
        "listing-b",
        <>
          <text x="352" y="262" fontWeight="700">
            Procédé B
          </text>
          <rect x="352" y="277" width="14" height="14" fill={grey[400]} />
          <text x="374" y="289" fill={muted}>
            Étanchéité
          </text>
          <line
            x1="352"
            y1="310"
            x2="366"
            y2="310"
            stroke={grey[400]}
            strokeWidth="3"
          />
          <text x="374" y="314" fill={muted}>
            Relevé isolant
          </text>
        </>
      )}

      {/* annotated base map */}
      {zone(
        "plan",
        <>
          <rect
            x="560"
            y="120"
            width="300"
            height="240"
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <path
            d="M580 140 H840 V340 H580 Z M700 140 V340 M580 240 H700"
            fill="none"
            stroke={grey[500]}
            strokeWidth="3"
          />
        </>
      )}
      {zone(
        "plan-label",
        <text x="560" y="380" fontSize="11" fill={muted}>
          Fond de plan — Niveau 1
        </text>
      )}
      {zone(
        "annotation-rect",
        <rect
          x="600"
          y="160"
          width="90"
          height="70"
          fill={alpha(orange, 0.45)}
          stroke={orange}
          strokeWidth="2"
          data-accent-stroke=""
        />
      )}
      {zone(
        "annotation-line",
        <line
          x1="720"
          y1="300"
          x2="830"
          y2="300"
          stroke={blue}
          strokeWidth="3"
        />
      )}
      {zone("annotation-point", <circle cx="800" cy="180" r="7" fill={blue} />)}

      {/* other base maps of the scope */}
      {zone(
        "plan-thumbs",
        <>
          {[
            { x: 560, label: "N1", current: true },
            { x: 644, label: "N2" },
            { x: 728, label: "Coupe A" },
          ].map(({ x, label, current }) => (
            <g key={label}>
              <rect
                x={x}
                y="400"
                width="72"
                height="48"
                fill={grey[100]}
                stroke={current ? orange : grey[300]}
                strokeWidth={current ? 2 : 1}
              />
              <path
                d={`M${x + 12} ${412} H${x + 60} V${436} H${x + 12} Z`}
                fill="none"
                stroke={grey[400]}
                strokeWidth="2"
              />
              <text
                x={x + 36}
                y="466"
                textAnchor="middle"
                fontSize="10"
                fill={muted}
              >
                {label}
              </text>
            </g>
          ))}
        </>
      )}

      {/* 3D box */}
      {zone(
        "box-3d",
        <g transform="translate(880 150)">
          <path
            d="M0 120 L110 120 L150 90 L40 90 Z"
            fill={grey[200]}
            stroke={grey[400]}
          />
          <path
            d="M10 118 L10 60 M100 118 L100 60 M10 60 L100 60"
            fill="none"
            stroke={grey[500]}
            strokeWidth="2"
          />
          <text x="40" y="150" fontSize="14" fontWeight="700">
            3D
          </text>
        </g>
      )}
      {zone(
        "box-3d-annotations",
        <g transform="translate(880 150)">
          <path
            d="M30 100 L70 100 L90 85 L50 85 Z"
            fill={alpha(orange, 0.5)}
            stroke={orange}
          />
          <path
            d="M30 100 L30 70 L70 70 L70 100 Z"
            fill={alpha(orange, 0.75)}
            stroke={orange}
          />
          <path
            d="M70 100 L70 70 L90 55 L90 85 Z"
            fill={orange}
            stroke={orange}
          />
          <path
            d="M30 70 L50 55 L90 55 L70 70 Z"
            fill={alpha(orange, 0.9)}
            stroke={orange}
          />
        </g>
      )}

      {/* configuration */}
      {zone(
        "config-bracket",
        <path
          d="M440 372 V545"
          fill="none"
          stroke={grey[500]}
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      )}
      {zone(
        "config-label",
        <>
          <rect
            x="340"
            y="548"
            width="360"
            height="22"
            rx="11"
            fill={alpha(orange, 0.12)}
          />
          <text
            x="520"
            y="563"
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill={orange}
          >
            Configuration = liste de modèles d&apos;annotation paramétrée
          </text>
        </>
      )}

      {/* exports */}
      {zone(
        "export-arrow",
        <>
          <line
            x1="1022"
            y1="300"
            x2="1082"
            y2="300"
            stroke={dark}
            strokeWidth="2"
            markerEnd="url(#starting-arrow-dark)"
          />
          <text
            x="1140"
            y="236"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
          >
            Exports
          </text>
        </>
      )}
      {[
        { id: "export-metre", y: 250, label: "Métré" },
        { id: "export-plan", y: 290, label: "Plan de repérage" },
        { id: "export-carnet", y: 330, label: "Carnet de plans" },
      ].map(({ id, y, label }) =>
        zone(
          id,
          <>
            <rect
              x="1085"
              y={y}
              width="110"
              height="30"
              rx="15"
              fill="white"
              stroke={dark}
              strokeWidth="1.5"
            />
            <text x="1140" y={y + 19} textAnchor="middle" fontSize="11">
              {label}
            </text>
          </>
        )
      )}

      {/* base maps folder */}
      {zone(
        "folder-frame",
        <rect
          x="320"
          y="580"
          width="400"
          height="120"
          rx="8"
          fill="white"
          stroke={grey[500]}
          strokeWidth="1.5"
          strokeDasharray="6 4"
          data-accent-stroke=""
        />
      )}
      {zone(
        "folder-title",
        <text x="340" y="604" fontWeight="700">
          Dossier de fonds de plan
        </text>
      )}
      {zone(
        "folder-levels",
        <>
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={340 + i * 8}
              y={615 + i * 6}
              width="64"
              height="44"
              fill="white"
              stroke={grey[400]}
            />
          ))}
          <path
            d="M366 636 H400 V654 H366 Z M383 636 V654"
            fill="none"
            stroke={grey[500]}
            strokeWidth="2"
          />
          <text x="388" y="690" textAnchor="middle" fontSize="11" fill={muted}>
            Plans de niveau
          </text>
        </>
      )}
      {zone(
        "folder-sections",
        <>
          {[0, 1].map((i) => (
            <rect
              key={i}
              x={520 + i * 8}
              y={615 + i * 6}
              width="64"
              height="44"
              fill="white"
              stroke={grey[400]}
            />
          ))}
          <path
            d="M538 654 H582 M548 654 V634 H572 V654"
            fill="none"
            stroke={grey[500]}
            strokeWidth="2"
          />
          <text x="560" y="690" textAnchor="middle" fontSize="11" fill={muted}>
            Coupes
          </text>
        </>
      )}
      {zone(
        "link-folder-plan",
        <path
          d="M420 612 C470 540, 540 500, 594 454"
          fill="none"
          stroke={orange}
          strokeWidth="2"
          strokeDasharray="6 4"
          markerEnd="url(#starting-arrow-orange)"
        />
      )}
    </Box>
  );
}
