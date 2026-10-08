import { List } from "@mui/material";

import RowPopperTool from "./RowPopperTool";
import RowTemplatelessDraw from "Features/mapEditor/components/RowTemplatelessDraw";
import RowRevolutionAxisTool from "Features/revolutionAxes/components/RowRevolutionAxisTool";
import RowThreedTool from "Features/threedDrawing/components/RowThreedTool";
import { getToolItemsForEditor } from "Features/mapEditor/constants/toolItems";

// ---------------------------------------------------------------------------
// SectionPopperDrawingTools — the "Commandes" tool rows of the poppers
// (Dessin D, Ouverture O, Retirer / Couper / Isoler un segment, Couper une
// surface, Joindre, Axe de révolution A, Déplacer M, Tourner R…), shown on
// the "Commandes" side of PopperMapListings while attached, or in
// PopperDrawingTools while detached. No title band: the side title row / the
// detached popper header carry it. Whether the tools apply at all is decided
// by the caller (selectShowDrawingTools). `isThreedEditor` picks the 3D set
// (Coupe face, and the threedEditor tools Extruder / Déplacer / Tourner —
// RowThreedTool).
// ---------------------------------------------------------------------------

export default function SectionPopperDrawingTools({
  templatelessCount = 0,
  isThreedEditor = false,
  viewerKey,
}) {
  // render

  return (
    <List dense disablePadding>
      {getToolItemsForEditor({ isThreedEditor }).map((tool) =>
        tool.isTemplatelessDraw ? (
          // templateless annotations belong to a scope, not to the ZONES /
          // business-objects flows
          viewerKey === "MAP" && (
            <RowTemplatelessDraw
              key={tool.type}
              label={tool.label}
              Icon={tool.Icon}
              shortcut={tool.shortcut}
              count={templatelessCount}
            />
          )
        ) : tool.isRevolutionAxis ? (
          // revolution axes belong to a scope, like the templateless
          // annotations
          viewerKey === "MAP" && (
            <RowRevolutionAxisTool
              key={tool.type}
              label={tool.label}
              Icon={tool.Icon}
              shortcut={tool.shortcut}
              isThreedEditor={isThreedEditor}
            />
          )
        ) : isThreedEditor && tool.threedTool ? (
          <RowThreedTool
            key={tool.type}
            threedTool={tool.threedTool}
            label={tool.label}
            Icon={tool.Icon}
            shortcut={tool.shortcut}
          />
        ) : (
          <RowPopperTool
            key={tool.type}
            type={tool.type}
            label={tool.label}
            Icon={tool.Icon}
            shortcut={tool.shortcut}
          />
        )
      )}
    </List>
  );
}
