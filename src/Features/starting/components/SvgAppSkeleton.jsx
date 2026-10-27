import { useEffect, useState } from "react";

import { Box } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import DiagramZone from "./DiagramZone";

import makeZoneProps from "../utils/makeZoneProps";
import isEditableTarget from "Features/commandsToolbar/utils/isEditableTarget";

// Skeleton of the editor screen (section « Naviguer dans l'appli »), scaled
// from LayoutDesktop / SectionViewer in the Dessin module: top bar, module
// band, docked module panel, commands toolbar docked LEFT, 2D/3D editor with
// the floating annotations panel, properties drawer, tools band, bottom bar.
// Every block is a DiagramZone whose id is listed in APP_COMPONENTS[].zones.
//
// Three controls are live, like in the app: the dock button of the top bar
// docks / undocks the module panel (the editor widens), the « Propriétés »
// tool of the tools band opens / closes the properties drawer, the 2D / 3D
// button of the editor (or the T key) switches the plan to a generic 3D view
// of the same drawing. Highlighting a hidden panel from the list shows it
// anyway.
const TOP_H = 48;
const BOTTOM_Y = 684;
const BAND_W = 80;
const MODULE_PANEL_W = 280;
const COMMANDS_W = 40;
const TOOLS_X = 1130;
const PROPERTIES_W = 340;
const WALL_H = 70;

export default function SvgAppSkeleton({
  highlightedZones,
  onZoneClick,
  vocabulary: v,
}) {
  const theme = useTheme();

  // state

  const [modulePanelDocked, setModulePanelDocked] = useState(true);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [view3d, setView3d] = useState(false);

  // T switches the editor view while the skeleton is shown (capture-phase
  // window listener, like useDialogQuitHotkey; yields while typing).
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key?.toLowerCase() !== "t") return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (isEditableTarget(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setView3d((v) => !v);
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

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

  const showModulePanel =
    modulePanelDocked || Boolean(highlightedZones?.has("module_panel"));
  const showProperties =
    propertiesOpen || Boolean(highlightedZones?.has("properties_panel"));

  // x layout, left to right, depending on the docked module panel
  const panelW = showModulePanel ? MODULE_PANEL_W : 0;
  const commandsX = BAND_W + panelW;
  const editorX = commandsX + COMMANDS_W;
  const editorW = TOOLS_X - editorX;
  const annotationsX = editorX + 50;
  const middleH = BOTTOM_Y - TOP_H;

  // strings

  const dockTitleS = modulePanelDocked
    ? "Libérer le panneau du module"
    : "Ancrer le panneau du module";
  const propertiesTitleS = propertiesOpen
    ? "Fermer le panneau de propriétés"
    : "Ouvrir le panneau de propriétés";
  const toggleViewTitleS = view3d
    ? "Revenir au plan 2D (T)"
    : "Passer en vue 3D (T)";
  const editorLabelS = view3d ? "Éditeur 3D" : "Éditeur 2D";

  // handlers

  function handleDockClick(e) {
    e.stopPropagation();
    setModulePanelDocked((docked) => !docked);
  }

  function handlePropertiesToolClick(e) {
    e.stopPropagation();
    setPropertiesOpen((open) => !open);
  }

  function handleToggleViewClick(e) {
    e.stopPropagation();
    setView3d((v) => !v);
  }

  // The drawing of the editor, in plan coordinates: the walls of a floor,
  // an orange surface annotation and a blue point. The 3D view projects the
  // same geometry (oblique projection, walls and surface extruded).
  const L = editorX + 120;
  const walls = [
    [L, 220, 1000, 220],
    [L, 400, 760, 400],
    [L, 220, L, 580],
    [760, 220, 760, 580],
    [1000, 220, 1000, 580],
    [L, 580, 1000, 580],
  ];
  const surface = { x: L + 40, y: 260, w: 120, h: 90 };
  const point = { x: 900, y: 300 };
  const blue = theme.palette.info.main;

  const ox = editorX + 70;
  const oy = 330;
  const project = (x, y, z = 0) => [
    ox + (x - L) * 0.8 + (y - 220) * 0.5,
    oy + (y - 220) * 0.35 - z,
  ];
  const poly = (pts) => pts.map(([x, y]) => `${x},${y}`).join(" ");
  const quad = (x1, y1, x2, y2, z1, z2) =>
    poly([
      project(x1, y1, z1),
      project(x2, y2, z1),
      project(x2, y2, z2),
      project(x1, y1, z2),
    ]);

  function renderPlan2d() {
    return (
      <>
        {walls.map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={grey[400]}
            strokeWidth="4"
          />
        ))}
        <rect
          x={surface.x}
          y={surface.y}
          width={surface.w}
          height={surface.h}
          fill={alpha(orange, 0.35)}
          stroke={orange}
        />
        <circle cx={point.x} cy={point.y} r="7" fill={blue} />
      </>
    );
  }

  function renderScene3d() {
    const { x, y, w, h } = surface;
    const top = (z) =>
      poly([
        project(x, y, z),
        project(x + w, y, z),
        project(x + w, y + h, z),
        project(x, y + h, z),
      ]);
    const [px, py] = project(point.x, point.y, 0);
    const [pxTop, pyTop] = project(point.x, point.y, 40);
    return (
      <>
        <polygon
          points={poly([
            project(L, 220),
            project(1000, 220),
            project(1000, 580),
            project(L, 580),
          ])}
          fill={grey[200]}
          stroke={grey[400]}
        />
        <polygon points={top(0)} fill={alpha(orange, 0.3)} stroke={orange} />
        <polygon
          points={quad(x, y + h, x + w, y + h, 0, 30)}
          fill={alpha(orange, 0.55)}
          stroke={orange}
        />
        <polygon
          points={quad(x + w, y, x + w, y + h, 0, 30)}
          fill={alpha(orange, 0.75)}
          stroke={orange}
        />
        <polygon points={top(30)} fill={alpha(orange, 0.5)} stroke={orange} />
        {walls.map(([x1, y1, x2, y2], i) => (
          <polygon
            key={i}
            points={quad(x1, y1, x2, y2, 0, WALL_H)}
            fill={alpha(grey[500], 0.3)}
            stroke={grey[500]}
            strokeWidth="1.5"
          />
        ))}
        <line
          x1={px}
          y1={py}
          x2={pxTop}
          y2={pyTop}
          stroke={blue}
          strokeWidth="2"
        />
        <circle cx={pxTop} cy={pyTop} r="6" fill={blue} />
      </>
    );
  }

  // render

  return (
    <Box
      component="svg"
      viewBox="0 0 1200 720"
      preserveAspectRatio="xMidYMid meet"
      sx={{
        width: 1,
        height: 1,
        minHeight: 0,
        display: "block",
        fontSize: 12,
        fontFamily: "inherit",
        "& text": { fill: text },
        "& g[data-highlighted='true'] [data-accent-stroke]": {
          stroke: orange,
          strokeWidth: 2.5,
        },
        "& [data-live]": { cursor: "pointer" },
        "& [data-live]:hover rect, & [data-live]:hover circle": {
          stroke: orange,
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
            y={TOP_H}
            width={BAND_W}
            height={middleH}
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
      {showModulePanel &&
        zone(
          "module_panel",
          <>
            <rect
              x={BAND_W}
              y={TOP_H}
              width={MODULE_PANEL_W}
              height={middleH}
              fill={grey[50]}
              stroke={grey[300]}
              data-accent-stroke=""
            />
            <text x={BAND_W + 16} y="78" fontWeight="700">
              Dessin
            </text>
            <text x={BAND_W + 16} y="100" fontSize="10" fill={muted}>
              Panneau du module
            </text>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <rect
                key={i}
                x={BAND_W + 16}
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
            x={commandsX}
            y={TOP_H}
            width={COMMANDS_W}
            height={middleH}
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <rect
              key={i}
              x={commandsX + 8}
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
            x={editorX}
            y={TOP_H}
            width={editorW}
            height={middleH}
            fill={grey[100]}
            stroke={grey[300]}
            data-accent-stroke=""
          />
          {view3d ? renderScene3d() : renderPlan2d()}
          <text x="1036" y="659" textAnchor="end" fontSize="10" fill={muted}>
            {editorLabelS}
          </text>
        </>
      )}
      {/* 2D / 3D toggle of the editor, bottom-right like in the app; live */}
      {zone(
        "editor_toggle",
        <g data-live="" onClick={handleToggleViewClick}>
          <title>{toggleViewTitleS}</title>
          <rect
            x="1050"
            y="642"
            width="64"
            height="26"
            rx="6"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text
            x="1070"
            y="659"
            textAnchor="middle"
            fontSize="11"
            fontWeight="700"
          >
            {view3d ? "2D" : "3D"}
          </text>
          <rect
            x="1088"
            y="647"
            width="16"
            height="16"
            rx="3"
            fill={grey[50]}
            stroke={grey[400]}
          />
          <text
            x="1096"
            y="659"
            textAnchor="middle"
            fontSize="9"
            fontWeight="700"
            fill={muted}
          >
            T
          </text>
        </g>
      )}

      {/* floating annotations panel */}
      {zone(
        "annotations_panel",
        <>
          <rect
            x={annotationsX}
            y="98"
            width="240"
            height="300"
            rx="6"
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          <text x={annotationsX + 16} y="124" fontWeight="700">
            Annotations
          </text>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect
                x={annotationsX + 16}
                y={142 + i * 36}
                width="12"
                height="12"
                fill={i % 2 ? theme.palette.info.main : orange}
              />
              <rect
                x={annotationsX + 36}
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
      {showProperties &&
        zone(
          "properties_panel",
          <>
            <rect
              x={TOOLS_X - PROPERTIES_W}
              y={TOP_H}
              width={PROPERTIES_W}
              height={middleH}
              fill="white"
              stroke={grey[300]}
              data-accent-stroke=""
            />
            <text x={TOOLS_X - PROPERTIES_W + 16} y="78" fontWeight="700">
              Propriétés
            </text>
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i}>
                <rect
                  x={TOOLS_X - PROPERTIES_W + 16}
                  y={100 + i * 56}
                  width="90"
                  height="8"
                  rx="3"
                  fill={grey[300]}
                />
                <rect
                  x={TOOLS_X - PROPERTIES_W + 16}
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

      {/* tools band (right); the first tool, « Propriétés », is live */}
      {zone(
        "tools_band",
        <>
          <rect
            x={TOOLS_X}
            y={TOP_H}
            width="70"
            height={middleH}
            fill="white"
            stroke={grey[300]}
            data-accent-stroke=""
          />
          {["I", "E", "C", "X", "V", "H"].map((k, i) => {
            const isProperties = i === 0;
            const icon = (
              <>
                <rect
                  x={TOOLS_X + 19}
                  y={72 + i * 72}
                  width="32"
                  height="32"
                  rx="6"
                  fill={
                    isProperties && propertiesOpen
                      ? alpha(orange, 0.2)
                      : grey[200]
                  }
                  stroke={isProperties && propertiesOpen ? orange : "none"}
                />
                <text
                  x={TOOLS_X + 35}
                  y={122 + i * 72}
                  textAnchor="middle"
                  fontSize="10"
                  fill={muted}
                >
                  {k}
                </text>
              </>
            );
            if (!isProperties) return <g key={k}>{icon}</g>;
            return (
              <g key={k} data-live="" onClick={handlePropertiesToolClick}>
                <title>{propertiesTitleS}</title>
                {icon}
              </g>
            );
          })}
        </>
      )}

      {/* top bar and its controls */}
      {zone(
        "top_bar",
        <rect
          x="0"
          y="0"
          width="1200"
          height={TOP_H}
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
        <g data-live="" onClick={handleDockClick}>
          <title>{dockTitleS}</title>
          <rect
            x="48"
            y="12"
            width="24"
            height="24"
            rx="4"
            fill={modulePanelDocked ? alpha(orange, 0.2) : grey[100]}
            stroke={modulePanelDocked ? orange : grey[300]}
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
        </g>
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
            y={BOTTOM_Y}
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
