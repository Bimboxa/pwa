import { useState } from "react";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Tooltip,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";
import LinkOff from "@mui/icons-material/LinkOff";

import useOrphanAnnotations from "Features/annotations/hooks/useOrphanAnnotations";
import useOrphanAnnotationsRow from "Features/mapEditor/hooks/useOrphanAnnotationsRow";
import { ORPHAN_LABEL } from "Features/annotations/utils/orphanAnnotations";

// ---------------------------------------------------------------------------
// RowOrphanAnnotations — « Annot. sans modèle » row of the templates lists
// (PopperMapListings + Dessin left panel), right above "Nouveau modèle": the
// annotations of the listing whose template no longer exists, on the main
// base map. Rendered only when there is at least one. Click selects them all
// on the map (multi-selection panel: delete, reassign a template from the
// context menu); on hover: solo and eye, like the "Dessin" row.
// ---------------------------------------------------------------------------

const SX_BY_VARIANT = {
  popper: {
    row: { bgcolor: "white", pl: 3, pr: 1, py: 0.5 },
    iconSize: 18,
    iconColor: "panel.textMuted",
    labelColor: "panel.textSecondary",
  },
  panel: {
    row: {
      bgcolor: "background.paper",
      pl: 2,
      pr: 1,
      py: 1,
      borderTop: "1px solid",
      borderColor: "divider",
    },
    iconSize: 18,
    iconColor: "panel.textLight",
    labelColor: "panel.textLight",
  },
};

export default function RowOrphanAnnotations({
  listingId,
  variant = "popper",
  // Host-specific overrides of the row (e.g. the empty-listing state of the
  // Dessin panel, where the row stands alone above the create box).
  sx,
}) {
  // strings

  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const hideS = "Masquer";
  const showS = "Afficher";
  const tooltipS =
    "Annotations dont le modèle a été supprimé — cliquer pour les sélectionner";

  // data

  const orphans = useOrphanAnnotations({ listingId });
  const { isSolo, isHidden, toggleSolo, toggleHidden, selectAll } =
    useOrphanAnnotationsRow();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const count = orphans.length;
  const styles = SX_BY_VARIANT[variant] ?? SX_BY_VARIANT.popper;
  const showActions = isHovered || isSolo;
  const buttonSx = {
    p: 0.5,
    bgcolor: "action.hover",
    color: "panel.textMuted",
    borderRadius: 1,
    "&:hover": { bgcolor: "panel.textMuted", color: "white" },
  };

  // handlers

  const handleClick = () => {
    selectAll(orphans);
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

  if (count === 0) return null;

  return (
    <Tooltip title={tooltipS} arrow placement="left" enterDelay={600}>
      <ListItemButton
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          alignItems: "center",
          gap: 1,
          "&:hover": { bgcolor: "action.hover" },
          ...styles.row,
          ...sx,
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
          <LinkOff
            sx={{
              fontSize: styles.iconSize,
              color: isHidden ? "text.disabled" : styles.iconColor,
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
            color: isHidden ? "text.disabled" : styles.labelColor,
          }}
        >
          {ORPHAN_LABEL}
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
            color={isHidden ? "text.disabled" : "secondary.main"}
          >
            {count}
          </Typography>
        )}
      </ListItemButton>
    </Tooltip>
  );
}
