import { useSelector } from "react-redux";

import { Box, List, Typography } from "@mui/material";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import RotateRightIcon from "@mui/icons-material/RotateRight";

import RowThreedTool from "Features/threedDrawing/components/RowThreedTool";

import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// "Outils" section of the « Fonds de plan » side (PopperMapListings, docked
// PanelDrawing), under the base maps list: the 3D placement tools of the
// base maps. "Déplacer": grab a snapped point of a base map's content, the
// whole base map (image + annotations) follows the mouse. "Tourner": pick a
// pivot, the base map rotates around the world-vertical axis through it.
// 3D editor only (self-hiding in 2D) — not in the read-only Viewer module.
// `variant`: "popper" | "panel" (row look, see RowThreedTool).
export default function SectionBaseMapsTools({ variant = "popper" }) {
  // strings

  const titleS = "Outils";
  const moveS = "Déplacer";
  const rotateS = "Tourner";

  // data

  const isThreedEditor = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  const isViewerModule = useSelector(
    (s) => s.viewers.selectedViewerKey === "THREED"
  );

  // render

  if (!isThreedEditor || isViewerModule) return null;

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
    </Box>
  );
}
