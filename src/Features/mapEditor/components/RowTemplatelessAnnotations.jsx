import { useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Tooltip,
} from "@mui/material";
import Tune from "@mui/icons-material/Tune";

import SoloIconToggle from "./SoloIconToggle";
import IconTemplatelessPolygon from "./IconTemplatelessPolygon";
import ButtonCountPill from "Features/popperMapListings/components/ButtonCountPill";
import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";
import useOpenTemplatelessAnnotationsPanel from "Features/mapEditor/hooks/useOpenTemplatelessAnnotationsPanel";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";

// ---------------------------------------------------------------------------
// RowTemplatelessAnnotations — « Annotations sans modèle » row of the
// PopperMapListings AND of the docked Dessin panel (PanelDrawing), pinned at
// the top of the panel above the revolution axes, in the same white rounded
// card as the axis rows (inset in the grey panel): the annotations drawn
// without template nor listing (« Dessin »
// command of the commands toolbar, hotkey D) in the popper's annotations
// set. Shows their count as a pill that toggles their visibility
// (templateless sentinel, see useDrawTemplateless — same pill as the listing
// rows: filled while visible, outlined while hidden); the row icon (light
// grey polygon, the "shape without template" mark) is the solo toggle (as on
// the template rows) and the properties button shows on hover; click selects
// the ones of the main base map on the map (multi-selection panel). Rendered
// only when there is at least one, or while the sentinel is soloed /
// eye-hidden.
// ---------------------------------------------------------------------------

export default function RowTemplatelessAnnotations({ annotations }) {
  // strings

  const labelS = "Annotations sans modèle";
  const propertiesS = "Propriétés";
  const hideS = "Masquer les annotations sans modèle";
  const showS = "Afficher les annotations sans modèle";
  const tooltipS =
    "Annotations dessinées sans modèle — cliquer pour les sélectionner";

  // data

  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const openProperties = useOpenTemplatelessAnnotationsPanel();
  const { isSolo, isHidden, toggleSolo, toggleHidden } = useDrawTemplateless();
  const { selectAnnotations } = useSelectAnnotationsOnMap();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const count = annotations?.length ?? 0;
  const buttonSx = {
    p: 0.5,
    bgcolor: "action.hover",
    color: "panel.textMuted",
    borderRadius: 1,
    "&:hover": { bgcolor: "panel.textMuted", color: "white" },
  };

  // handlers

  // Only the main base map's annotations are rendered in the editor (the
  // "ALL" scope widens the count to the whole repérage): select those.
  // Eye-hidden ones are un-hidden first: the selection panels read the
  // visible annotations only.
  const handleClick = () => {
    const selectable = (annotations ?? []).filter(
      (a) => a.baseMapId === selectedBaseMapId
    );
    if (selectable.length === 0) return;
    if (isHidden) toggleHidden();
    selectAnnotations(selectable, { openProperties: false });
  };

  const handleOpenProperties = (e) => {
    e.stopPropagation();
    openProperties();
  };

  const handleToggleHidden = (e) => {
    e.stopPropagation();
    toggleHidden();
  };

  // render

  if (count === 0 && !isSolo && !isHidden) return null;

  return (
    <Box
      sx={{
        mx: 1,
        my: 1,
        overflow: "hidden",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "panel.border",
        borderRadius: 2,
      }}
    >
      <Tooltip title={tooltipS} arrow placement="left" enterDelay={600}>
        <ListItemButton
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          sx={{
            alignItems: "center",
            gap: 1,
            // Same inset as the axis rows of the card below.
            pl: 1,
            pr: 0.5,
            py: 0.5,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {/* Row icon = SOLO toggle, as on the template rows: a light grey
              polygon, the mark of a shape drawn without template. */}
          <SoloIconToggle
            isSolo={isSolo}
            isHidden={isHidden}
            isRowHovered={isHovered}
            onToggle={toggleSolo}
          >
            <IconTemplatelessPolygon />
          </SoloIconToggle>
          <Typography
            variant="body2"
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              userSelect: "none",
              fontStyle: "italic",
              color: isHidden ? "text.disabled" : "panel.textSecondary",
            }}
          >
            {labelS}
          </Typography>

          {isHovered && (
            <Tooltip title={propertiesS} arrow>
              <IconButton
                size="small"
                onClick={handleOpenProperties}
                sx={buttonSx}
              >
                <Tune sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}

          {/* Count pill = visibility toggle (same pill as the listing rows). */}
          <ButtonCountPill
            count={count}
            hidden={isHidden}
            title={isHidden ? showS : hideS}
            onClick={handleToggleHidden}
          />
        </ListItemButton>
      </Tooltip>
    </Box>
  );
}
