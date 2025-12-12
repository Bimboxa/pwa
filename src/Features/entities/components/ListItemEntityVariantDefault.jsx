import { useState, useRef } from "react";

import {
  ListItem,
  ListItemButton,
  Box,
  Typography,
  Avatar,
  IconButton,
  Popper,
  Paper,
  Fade
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { NearMe as Focus, Image, Edit } from "@mui/icons-material";
import theme from "Styles/theme";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";
import ToolbarCreateAnnotationFromListItemEntity from "Features/annotations/components/ToolbarCreateAnnotationFromListItemEntity";

import getEntityMainImage from "../utils/getEntityMainImage";

export default function ListItemEntityVariantDefault({
  entity,
  onClick,
  onEditClick,
  selection,
  listingColor = theme.palette.primary.main,
  spriteImage,
  annotationEnabled,
}) {
  // --- Gestion du Hover Robuste ---
  const [anchorEl, setAnchorEl] = useState(null);
  const hoverTimeoutRef = useRef(null);

  const isOpen = Boolean(anchorEl);

  // 1. Entrée sur le LIST ITEM : On ouvre et on définit l'ancre
  const handleListItemEnter = (event) => {
    if (!annotationEnabled) return;

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setAnchorEl(event.currentTarget);
  };

  // 2. Entrée sur le POPPER : On annule juste la fermeture (on garde l'ancre existante)
  const handlePopperEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  // 3. Sortie (Commune) : On lance le compte à rebours de fermeture
  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setAnchorEl(null);
    }, 10); // 200ms est plus confortable que 100ms
  };

  // --- Helpers ---
  let annotation;
  if (entity.annotations?.length > 0)
    annotation = entity.annotations[0];

  let label = entity.label ?? annotation?.label;
  if (!label) label = "Libellé à définir";
  const subLabel = entity.subLabel ?? annotation?.label;

  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);
  const hasMarker = entity.marker;

  // --- Handlers Click ---
  function handleClick() {
    if (onClick) onClick(entity);
  }

  function handleEditClick(e) {
    e.stopPropagation();
    e.preventDefault();
    if (onEditClick) onEditClick(entity);
  }

  const overlapAmount = "8px";

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
      sx={{ zIndex: 1, position: 'relative' }}
    >
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        // Événements sur le BOUTON
        onMouseEnter={handleListItemEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          display: "flex",
          px: 1,
          position: "relative",
          zIndex: 'auto',
          "&:hover": {
            backgroundColor: lighten(listingColor, 0.9),
          },
          "&.Mui-selected": {
            backgroundColor: listingColor,
            color: "white",
            "&:hover": {
              backgroundColor: lighten(listingColor, 0.1),
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

        <Box sx={{ flex: 1 }}>
          <Typography variant="body2">{label}</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {annotation && (
              <AnnotationIcon
                annotation={annotation}
                spriteImage={spriteImage}
                size={18}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              {subLabel}
            </Typography>
          </Box>
        </Box>

        {isSelected && (
          <IconButton onClick={handleEditClick} color="inherit">
            <Edit />
          </IconButton>
        )}
      </ListItemButton>

      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="right"
        transition
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, -8],
            },
          },
          {
            name: 'preventOverflow',
            options: { padding: 8 },
          },
        ]}
        style={{ zIndex: 1500, pointerEvents: 'auto' }} // pointerEvents auto est crucial
        // Événements sur le POPPER (Distincts !)
        onMouseEnter={handlePopperEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={10}>
            <Paper
              elevation={4}
              sx={{
                display: 'flex',
                alignItems: 'center',
                borderRadius: 1,
                bgcolor: 'background.paper'
              }}
            >
              <ToolbarCreateAnnotationFromListItemEntity entityId={entity.id} />
            </Paper>
          </Fade>
        )}
      </Popper>

    </ListItem>
  );
}