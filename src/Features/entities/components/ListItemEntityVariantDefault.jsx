import {
  ListItem,
  ListItemIcon,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
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
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";

export default function ListItemEntityVariantDefault({
  entity,
  listing,
  onClick,
  onEditClick,
  selection,
  listingColor = theme.palette.primary.main,
  annotationTemplates,
  spriteImage,
}) {
  // helper - annotation

  let annotation;
  if (entity.annotations?.length > 0)
    // annotation = {
    //   ...entity.annotations[0],
    //   label: annotationTemplates?.find(
    //     ({ id }) => entity.annotations[0].annotationTemplateId === id
    //   )?.label,
    // };
    annotation = entity.annotations[0];

  // helpers

  //let label = entity.label ?? annotation?.label;
  let label = annotation?.label ?? entity.label;
  const fontStyle = label ? "normal" : "italic";
  if (!label) label = "Libellé à définir";
  //const subLabel = entity.num ? `#${entity.num}` : entity.subLabel;
  const subLabel = entity.subLabel ?? "-";

  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);
  const hasMarker = entity.marker;

  // handlers

  function handleClick() {
    console.log("[CLICK] entity", entity);
    if (onClick) onClick(entity);
  }

  function handleEditClick(e) {
    e.stopPropagation();
    e.preventDefault();

    if (onEditClick) {
      onEditClick(entity);
    }
  }
  return (
    <ListItem
      //dense
      divider
      disablePadding
      secondaryAction={
        hasMarker && (
          <IconButton>
            <Focus />
          </IconButton>
        )
      }
    >
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          display: "flex",
          px: 1,
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
            <Typography variant="caption">{subLabel}</Typography>
          </Box>
        </Box>
        {isSelected && (
          <IconButton onClick={handleEditClick} color="inherit">
            <Edit />
          </IconButton>
        )}
      </ListItemButton>
    </ListItem>
  );
}
