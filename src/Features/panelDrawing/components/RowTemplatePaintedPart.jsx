import { useState } from "react";

import { Box, Chip, IconButton, Tooltip, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import Brush from "@mui/icons-material/Brush";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import { formatQtyValue } from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";
import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";

// ---------------------------------------------------------------------------
// RowTemplatePaintedPart — one painted part (« Pinceau » 3D) of the template
// detail view: template color swatch with a brush, host label, "Face · Côté ↗
// · 12.40 m²" / "Arête · 3.20 ml", status chips (Orpheline / Doublon / À
// vérifier, quantity struck through when not counted) and a hover delete.
// Clicking highlights + frames the part in 3D (disabled in 2D).
// ---------------------------------------------------------------------------

// 8-sector arrow of a horizontal direction in the base map plane (x right,
// y up = image top).
const SIDE_ARROWS = ["→", "↗", "↑", "↖", "←", "↙", "↓", "↘"];
// Horizontal sides of an elevation (VERTICAL base map): local x = right,
// local z = toward the elevation's viewer.
const ELEVATION_SIDES = ["droit", "avant", "gauche", "arrière"];

// `normal` is base-map-local: on a HORIZONTAL base map local z is up, on a
// VERTICAL one (elevation) local y is up.
function getSideLabel(normal, orientation) {
  if (!normal) return null;
  if (orientation === "VERTICAL") {
    if (normal.y > 0.7) return "Dessus";
    if (normal.y < -0.7) return "Dessous";
    const step = Math.round(Math.atan2(normal.z, normal.x) / (Math.PI / 2));
    return `Côté ${ELEVATION_SIDES[((step % 4) + 4) % 4]}`;
  }
  if (normal.z > 0.7) return "Dessus";
  if (normal.z < -0.7) return "Dessous";
  const step = Math.round(Math.atan2(normal.y, normal.x) / (Math.PI / 4));
  return `Côté ${SIDE_ARROWS[((step % 8) + 8) % 8]}`;
}

export default function RowTemplatePaintedPart({
  part,
  label,
  color,
  isHighlighted,
  canFocus,
  canDelete,
  showBaseMapName,
  onClick,
  onDelete,
}) {
  // strings

  const faceS = "Face";
  const edgeS = "Arête";
  const orphanS = "Orpheline";
  const orphanTooltipS =
    part.partType === MESH_PAINT_PART_TYPES.EDGE
      ? "L'arête peinte n'existe plus sur l'objet : partie non comptée"
      : "La face peinte n'existe plus sur l'objet : partie non comptée";
  const conflictS = "Doublon";
  const conflictTooltipS =
    "Partie aussi peinte par un modèle plus récent : non comptée";
  const staleS = "À vérifier";
  const staleTooltipS = "Quantité à vérifier (ouvrir en 3D)";
  const only3dS = "Disponible en 3D";
  const deleteS = "Supprimer la peinture";

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const isEdge = part.partType === MESH_PAINT_PART_TYPES.EDGE;
  const prefix = [
    showBaseMapName ? part.baseMapName : null,
    isEdge ? edgeS : faceS,
    isEdge ? null : getSideLabel(part.normal, part.baseMapOrientation),
  ]
    .filter(Boolean)
    .join(" · ");
  const qtyS = !part.qtiesEnabled
    ? `– ${isEdge ? "ml" : "m²"}`
    : isEdge
      ? `${formatQtyValue(part.length)} ml`
      : `${formatQtyValue(part.surface)} m²`;

  const chipSx = {
    flexShrink: 0,
    height: 16,
    "& .MuiChip-label": { px: 0.5, fontSize: "9px", fontWeight: "bold" },
  };

  // handlers

  const handleClick = () => {
    if (canFocus) onClick?.(part);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete?.(part);
  };

  // render

  return (
    <Tooltip title={canFocus ? "" : only3dS} placement="top" disableInteractive>
      <Box
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 1.5,
          py: 1.25,
          cursor: canFocus ? "pointer" : "default",
          bgcolor: isHighlighted ? "action.selected" : "background.paper",
          "&:hover": {
            bgcolor: isHighlighted ? "action.selected" : "action.hover",
          },
          "&:not(:last-child)": {
            borderBottom: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {/* Color swatch + brush */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            borderRadius: 2,
            flexShrink: 0,
            bgcolor: alpha(color, 0.2),
            opacity: part.isCounted ? 1 : 0.5,
          }}
        >
          <Brush sx={{ fontSize: 20, color }} />
        </Box>

        {/* Host label + part line */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography
              variant="body2"
              noWrap
              sx={{ fontWeight: 700, userSelect: "none", minWidth: 0 }}
            >
              {label}
            </Typography>
            {part.isOrphan && (
              <Tooltip title={orphanTooltipS} arrow>
                <Chip
                  label={orphanS}
                  size="small"
                  color="warning"
                  sx={chipSx}
                />
              </Tooltip>
            )}
            {part.isConflict && (
              <Tooltip title={conflictTooltipS} arrow>
                <Chip
                  label={conflictS}
                  size="small"
                  color="warning"
                  sx={chipSx}
                />
              </Tooltip>
            )}
            {part.isStale && !part.isConflict && (
              <Tooltip title={staleTooltipS} arrow>
                <Chip label={staleS} size="small" color="info" sx={chipSx} />
              </Tooltip>
            )}
          </Box>
          <Typography
            variant="caption"
            noWrap
            sx={{
              display: "block",
              fontFamily: "monospace",
              fontWeight: 500,
              color: "text.secondary",
            }}
          >
            {`${prefix} · `}
            <Box
              component="span"
              sx={{
                textDecoration: part.isCounted ? "none" : "line-through",
              }}
            >
              {qtyS}
            </Box>
          </Typography>
        </Box>

        {/* Delete (hover) */}
        {canDelete && isHovered && (
          <Tooltip title={deleteS} arrow>
            <IconButton
              size="small"
              onClick={handleDelete}
              sx={{
                p: 0.5,
                flexShrink: 0,
                color: "panel.textMuted",
                bgcolor: "action.hover",
                borderRadius: 1,
                "&:hover": { bgcolor: "error.main", color: "white" },
              }}
            >
              <DeleteOutline sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    </Tooltip>
  );
}
