import { useState } from "react";

import {
  Box,
  Typography,
  ListItemButton,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import FilterCenterFocus from "@mui/icons-material/FilterCenterFocus";

import ShortcutBadge from "Features/smartDetect/components/ShortcutBadge";
import useDrawTemplateless from "Features/mapEditor/hooks/useDrawTemplateless";

// ---------------------------------------------------------------------------
// RowTemplatelessDraw — "Dessin" tool row (hotkey D) of the drawing tools
// sections (PopperMapListings + Dessin left panel): click to draw an
// annotation with no template nor listing. Shows the count of templateless
// annotations; on hover: annotation type picker, solo and eye.
// In the 3D editor the same row starts the mesh drawing (lines on the faces of
// the annotation meshes): the type picker only offers lines and surfaces, and
// there is no hotkey — "D" is "Déplacer" there.
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
      px: 1.5,
      py: 0.75,
      "&:not(:last-child)": {
        borderBottom: "1px solid",
        borderColor: "divider",
      },
    },
    iconSize: 20,
    iconColor: "primary.main",
    labelColor: "text.primary",
  },
};

export default function RowTemplatelessDraw({
  label,
  Icon,
  shortcut,
  count = 0,
  variant = "popper",
}) {
  // strings

  const changeTypeS = "Changer de type";
  const soloS = "Solo";
  const exitSoloS = "Quitter le solo";
  const hideS = "Masquer";
  const showS = "Afficher";
  const menuTitleS = "Type d'annotation";

  // data

  const {
    shapes,
    activeShape,
    isThreedEditor,
    startDraw,
    selectShapeAndDraw,
    isSolo,
    isHidden,
    toggleSolo,
    toggleHidden,
  } = useDrawTemplateless();

  // state

  const [isHovered, setIsHovered] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

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

  const handleTypeBtnClick = (e) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setIsHovered(false);
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

  return (
    <Box>
      <ListItemButton
        onClick={startDraw}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          if (!menuAnchor) setIsHovered(false);
        }}
        sx={{
          alignItems: "center",
          gap: 1,
          "&:hover": { bgcolor: "action.hover" },
          ...styles.row,
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
          <Icon sx={{ fontSize: styles.iconSize, color: styles.iconColor }} />
        </Box>
        {shortcut && !isThreedEditor && (
          <Box sx={{ flexShrink: 0 }}>
            <ShortcutBadge>{shortcut}</ShortcutBadge>
          </Box>
        )}
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
          {label}
        </Typography>

        {showActions && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {isHovered && activeShape && (
              <Tooltip title={changeTypeS} arrow>
                <IconButton
                  size="small"
                  onClick={handleTypeBtnClick}
                  sx={{
                    ...buttonSx,
                    "& .MuiSvgIcon-root": { fontSize: 16 },
                    ...(menuAnchor && {
                      bgcolor: "panel.textMuted",
                      color: "white",
                    }),
                  }}
                >
                  {activeShape.icon}
                </IconButton>
              </Tooltip>
            )}
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

        {!isHovered && count > 0 && (
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

      {/* Annotation type picker menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              minWidth: 200,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: "1px solid",
            borderColor: "panel.border",
          }}
        >
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: "panel.textPrimary" }}
          >
            {menuTitleS}
          </Typography>
        </Box>
        {shapes.map((shape) => (
          <MenuItem
            key={shape.key}
            selected={shape.key === activeShape?.key}
            onClick={() => {
              selectShapeAndDraw(shape);
              handleMenuClose();
            }}
            sx={{ gap: 1, py: 0.75, fontSize: "0.8125rem" }}
          >
            <ListItemIcon
              sx={{ minWidth: 28, "& .MuiSvgIcon-root": { fontSize: 18 } }}
            >
              {shape.icon}
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: "body2" }}>
              {shape.label}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
