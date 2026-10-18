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
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";
import QuestionMark from "@mui/icons-material/QuestionMark";

import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";
import useSelectAnnotationsOnMap from "Features/mapEditor/hooks/useSelectAnnotationsOnMap";

// ---------------------------------------------------------------------------
// RowTemplatelessAnnotations — « Annotations sans modèle » row of the
// PopperMapListings templates list, right below "Nouveau modèle": the
// annotations drawn without template nor listing (« Dessin » command of the
// commands toolbar, hotkey D) in the popper's annotations set. Shows their
// count; on hover: solo and eye (templateless sentinel, see
// useDrawTemplateless); click selects the ones of the main base map on the
// map (multi-selection panel). Rendered only when there is at least one, or
// while the sentinel is soloed / eye-hidden.
// ---------------------------------------------------------------------------

export default function RowTemplatelessAnnotations({ annotations }) {
  // strings

  const labelS = "Annotations sans modèle";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const hideS = "Masquer";
  const showS = "Afficher";
  const tooltipS =
    "Annotations dessinées sans modèle — cliquer pour les sélectionner";

  // data

  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const { isSolo, isHidden, toggleSolo, toggleHidden } = useDrawTemplateless();
  const { selectAnnotations } = useSelectAnnotationsOnMap();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const count = annotations?.length ?? 0;
  const showActions = isHovered || isSolo;
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
    selectAnnotations(selectable);
  };

  const handleToggleSolo = (e) => {
    e.stopPropagation();
    toggleSolo();
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
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 24,
              height: 24,
              flexShrink: 0,
            }}
          >
            <QuestionMark
              sx={{
                fontSize: 18,
                color: isHidden ? "text.disabled" : "panel.textMuted",
              }}
            />
          </Box>
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

          {showActions && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Tooltip title={isSolo ? exitSoloS : soloS} arrow>
                <IconButton
                  size="small"
                  onClick={handleToggleSolo}
                  sx={{
                    ...buttonSx,
                    ...(isSolo && {
                      bgcolor: "secondary.main",
                      color: "secondary.contrastText",
                    }),
                  }}
                >
                  <FilterCenterFocus sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {isHovered && (
                <Tooltip title={isHidden ? showS : hideS} arrow>
                  <IconButton
                    size="small"
                    onClick={handleToggleHidden}
                    sx={buttonSx}
                  >
                    {isHidden ? (
                      <VisibilityOff sx={{ fontSize: 16 }} />
                    ) : (
                      <Visibility sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}

          {!isHovered && (
            <Typography
              align="right"
              noWrap
              sx={{
                fontSize: "10px",
                minWidth: "24px",
                fontFamily: "monospace",
                fontWeight: 500,
              }}
              color={
                isHidden
                  ? "text.disabled"
                  : count > 0
                    ? "secondary.main"
                    : "panel.countEmpty"
              }
            >
              {count}
            </Typography>
          )}
        </ListItemButton>
      </Tooltip>
    </>
  );
}
