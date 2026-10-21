import { useState } from "react";
import { useSelector } from "react-redux";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Tooltip,
  Divider,
} from "@mui/material";
import QuestionMark from "@mui/icons-material/QuestionMark";
import Tune from "@mui/icons-material/Tune";

import SoloIconToggle from "./SoloIconToggle";
import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";
import useOpenTemplatelessAnnotationsPanel from "Features/mapEditor/hooks/useOpenTemplatelessAnnotationsPanel";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";

// ---------------------------------------------------------------------------
// RowTemplatelessAnnotations — « Annotations sans modèle » row of the
// PopperMapListings templates list, right below "Nouveau modèle": the
// annotations drawn without template nor listing (« Dessin » command of the
// commands toolbar, hotkey D) in the popper's annotations set. Shows their
// count as a pill that toggles their visibility (templateless sentinel, see
// useDrawTemplateless — same pill as the listing rows: filled while visible,
// outlined while hidden); the row icon is the solo toggle (as on the
// template rows) and the properties button shows on hover; click selects
// the ones of the main base map on the map (multi-selection panel). Rendered only when there is at least one, or
// while the sentinel is soloed / eye-hidden.
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
    <>
      <Divider sx={{ my: 0.5, borderColor: "divider" }} />
      <Tooltip title={tooltipS} arrow placement="left" enterDelay={600}>
        <ListItemButton
          onClick={handleClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          sx={{
            alignItems: "center",
            gap: 1,
            bgcolor: "white",
            pl: 3,
            pr: 1,
            py: 0.5,
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          {/* Row icon = SOLO toggle, as on the template rows */}
          <SoloIconToggle
            isSolo={isSolo}
            isHidden={isHidden}
            isRowHovered={isHovered}
            onToggle={toggleSolo}
          >
            <QuestionMark sx={{ fontSize: 18, color: "panel.textMuted" }} />
          </SoloIconToggle>
          <Typography
            variant="body2"
            noWrap
            sx={{
              flex: 1,
              minWidth: 0,
              userSelect: "none",
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

          {/* Count pill = visibility toggle (same pill as the listing rows:
              filled in the accent while visible, outlined while hidden). */}
          <Tooltip title={isHidden ? showS : hideS} arrow placement="top">
            <Box
              component="button"
              onClick={handleToggleHidden}
              sx={{
                minWidth: 24,
                height: 20,
                px: 0.75,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                borderRadius: 999,
                border: "1px solid",
                borderColor: isHidden ? "panel.border" : "transparent",
                bgcolor: isHidden ? "transparent" : "secondary.main",
                color: isHidden ? "text.disabled" : "secondary.contrastText",
                cursor: "pointer",
                transition: "0.2s",
                "&:hover": {
                  filter: "brightness(1.1)",
                  borderColor: isHidden ? "text.secondary" : "transparent",
                },
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontFamily: "monospace",
                  lineHeight: 1,
                  color: "inherit",
                }}
              >
                {count}
              </Typography>
            </Box>
          </Tooltip>
        </ListItemButton>
      </Tooltip>
    </>
  );
}
