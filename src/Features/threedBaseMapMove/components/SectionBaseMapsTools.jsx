import { useSelector } from "react-redux";

import { Box, List, Typography } from "@mui/material";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import RotateRightIcon from "@mui/icons-material/RotateRight";

import RowThreedTool from "Features/threedDrawing/components/RowThreedTool";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// The 3D placement tools of the base maps. "Déplacer": grab a snapped point
// of a base map's content, the whole base map (image + annotations) follows
// the mouse. "Tourner": pick a pivot, the base map rotates around the
// world-vertical axis through it.
//
// ListBaseMapsCommands — the two rows alone (no title band): the body of the
// "Commandes" popper (PopperDrawingTools) in the BaseMaps module, where the
// module's commands are these two tools. `variant`: "popper" | "panel" (row
// look, see RowThreedTool).
//
// SectionBaseMapsTools — titled section of the « Fonds de plan » side
// (PopperMapListings, PopperBaseMapsList, docked PanelDrawing), under the
// base maps list. 3D editor only (self-hiding in 2D) — not in the read-only
// Viewer / Scope modules.
// - BaseMaps module: it is the ATTACHED form of the module's "Commandes"
//   (popperMapListings.toolsDetached, detached by default — the section then
//   leaves the list for PopperDrawingTools, same mechanism as the Dessin
//   module's drawing tools);
// - other modules (Dessin…): plain "Outils" section, always attached.
// ---------------------------------------------------------------------------

export function ListBaseMapsCommands({ variant = "popper" }) {
  // strings

  const moveS = "Déplacer";
  const rotateS = "Tourner";

  // render

  return (
    <List dense disablePadding>
      <RowThreedTool
        threedTool="MOVE_BASE_MAP"
        label={moveS}
        Icon={OpenWithIcon}
        variant={variant}
      />
      <RowThreedTool
        threedTool="ROTATE_BASE_MAP"
        label={rotateS}
        Icon={RotateRightIcon}
        variant={variant}
      />
    </List>
  );
}

export default function SectionBaseMapsTools({ variant = "popper" }) {
  // strings

  const toolsS = "Outils";
  const commandsS = "Commandes";

  // data

  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const toolsDetached = useSelector((s) => s.popperMapListings.toolsDetached);

  // helpers

  // Read-only modules (Viewer, Scope): no placement tools.
  const isReadOnlyModule = viewerKey === "THREED" || viewerKey === "SCOPE";
  const isBaseMapsModule = viewerKey === "BASE_MAPS";
  const titleS = isBaseMapsModule ? commandsS : toolsS;

  // render

  if (!isThreedEditor || isReadOnlyModule) return null;
  // BaseMaps module: the commands live in PopperDrawingTools while detached.
  if (isBaseMapsModule && toolsDetached) return null;

  return (
    <Box>
      <Box
        sx={{
          mt: 2,
          px: 1,
          py: 0.5,
          bgcolor: "panel.sectionBg",
          borderTop: "1px solid",
          borderColor: "panel.border",
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: "panel.textMuted",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "11px",
          }}
        >
          {titleS}
        </Typography>
      </Box>
      <ListBaseMapsCommands variant={variant} />
    </Box>
  );
}
