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

import IconTemplatelessPolygon from "./IconTemplatelessPolygon";
import useListingTemplatelessAnnotations from "Features/annotations/hooks/useListingTemplatelessAnnotations";
import useListingTemplatelessRow from "Features/mapEditor/hooks/useListingTemplatelessRow";
import { TEMPLATELESS_LABEL } from "Features/annotations/utils/templatelessAnnotations";

// ---------------------------------------------------------------------------
// RowListingTemplatelessAnnotations — « Sans modèle » row of a business-objects
// listing's templates list (PopperMapListings, locate mode), above the orphan
// row and "Nouveau modèle": the annotations drawn without template on the
// listing's objects (« Dessin » command while an object is active), on the
// main base map. Rendered only when there is at least one, or while the row's
// sentinel is soloed / eye-hidden. Click selects them all on the map
// (multi-selection panel); on hover: solo and eye, like the orphan row.
// ---------------------------------------------------------------------------

const SX_BY_VARIANT = {
  popper: {
    row: { bgcolor: "white", pl: 3, pr: 1, py: 0.5 },
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
    iconColor: "panel.textLight",
    labelColor: "panel.textLight",
  },
};

export default function RowListingTemplatelessAnnotations({
  listingId,
  variant = "popper",
  sx,
}) {
  // strings

  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const hideS = "Masquer";
  const showS = "Afficher";
  const tooltipS =
    "Annotations dessinées sans modèle sur les ouvrages — cliquer pour les sélectionner";

  // data

  const annotations = useListingTemplatelessAnnotations({ listingId });
  const { isSolo, isHidden, toggleSolo, toggleHidden, selectAll } =
    useListingTemplatelessRow({ listingId });

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const count = annotations.length;
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
    selectAll(annotations);
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
            color: isHidden ? "text.disabled" : styles.iconColor,
          }}
        >
          <IconTemplatelessPolygon />
        </Box>
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            userSelect: "none",
            fontStyle: "italic",
            color: isHidden ? "text.disabled" : styles.labelColor,
          }}
        >
          {TEMPLATELESS_LABEL}
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
