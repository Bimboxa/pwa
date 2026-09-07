import {
  ListItem,
  ListItemButton,
  Box,
  Typography,
  Avatar,
  IconButton,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { NearMe as Focus, Image, Edit } from "@mui/icons-material";
import theme from "Styles/theme";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

import getEntityMainImage from "../utils/getEntityMainImage";
import getEntityQties from "../utils/getEntityQties";

export default function ListItemEntityVariantDefault({
  entity,
  onClick,
  onEditClick,
  selection,
  listingColor = theme.palette.primary.main,
  spriteImage,
}) {
  // --- Helpers ---
  let annotation;
  if (entity.annotations?.length > 0) annotation = entity.annotations[0];

  let label = entity.label ?? annotation?.label;
  if (!label) label = "Libellé à définir";
  const subLabel = entity.subLabel ?? annotation?.label;

  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);
  const hasMarker = entity.marker;
  const qtiesString = getEntityQties(entity, { formatAsOneLiner: true });

  // --- Handlers Click ---
  function handleClick() {
    if (onClick) onClick(entity);
  }

  function handleEditClick(e) {
    e.stopPropagation();
    e.preventDefault();
    if (onEditClick) onEditClick(entity);
  }

  return (
    <ListItem
      divider
      disablePadding
      secondaryAction={
        hasMarker && (
          <IconButton>
            <Focus />
          </IconButton>
        )
      }
      sx={{ zIndex: 1, position: 'relative', display: "flex", flexDirection: "column", width: 1 }}
    >
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          display: "flex",
          width: 1,
          px: 1,
          position: "relative",
          zIndex: 'auto',
          "&:hover": {
            backgroundColor: lighten(listingColor, 0.9),
            // Affiche le bouton au survol du parent
            "& .edit-button": {
              visibility: "visible",
              opacity: 1,
            },
          },
          "&.Mui-selected": {
            backgroundColor: listingColor,
            color: "white",
            "&:hover": {
              backgroundColor: lighten(listingColor, 0.1),
            },
            // Toujours visible si sélectionné
            "& .edit-button": {
              visibility: "visible",
              opacity: 1,
            },
          },
        }}
      >
        {mainImage ? (
          <Avatar src={mainImage?.url} sx={{ borderRadius: "4px", mr: 1 }} />
        ) : (
          <Avatar sx={{ borderRadius: "4px", mr: 1 }}>
            <Image />
          </Avatar>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>{label}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {annotation && (
              <AnnotationIcon
                annotation={annotation}
                spriteImage={spriteImage}
                size={18}
              />
            )}
            <Typography variant="caption" color="inherit" sx={{ opacity: 0.7 }} noWrap>
              {subLabel}
            </Typography>
          </Box>
        </Box>

        {/* Le bouton est toujours dans le DOM, mais invisible par défaut */}
        {/* <IconButton
          className="edit-button"
          onClick={handleEditClick}
          color="inherit"
          size="small"
          sx={{
            ml: 1,
            transition: "opacity 0.2s",
            visibility: isSelected ? "visible" : "hidden",
            opacity: isSelected ? 1 : 0,
          }}
        >
          <Edit fontSize="small" />
        </IconButton> */}
      </ListItemButton>

      {qtiesString && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", width: 1, px: 0.5 }}>
          <Typography sx={{ fontSize: 10 }} color="text.secondary">
            {qtiesString}
          </Typography>
        </Box>
      )}
    </ListItem>
  );
}