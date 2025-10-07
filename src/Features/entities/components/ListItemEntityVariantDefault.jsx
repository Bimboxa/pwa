import {
  ListItem,
  ListItemIcon,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { NearMe as Focus } from "@mui/icons-material";
import theme from "Styles/theme";

import AnnotationIcon from "Features/annotations/components/AnnotationIcon";

import getEntityMainImage from "../utils/getEntityMainImage";
import getAnnotationTemplateCode from "Features/annotations/utils/getAnnotationTemplateCode";

export default function ListItemEntityVariantDefault({
  entity,
  listing,
  onClick,
  selection,
  listingColor = theme.palette.primary.main,
  annotationTemplates,
  spriteImage,
}) {
  // helper - annotation

  let annotation;
  if (entity.annotation)
    annotation = {
      ...entity.annotation,
      label: annotationTemplates?.find(
        ({ id }) => entity.annotation.annotationTemplateId === id
      )?.label,
    };

  // helpers

  //let label = entity.label ?? annotation?.label;
  let label = annotation?.label ?? entity.label;
  const fontStyle = label ? "normal" : "italic";
  if (!label) label = "Libellé à définir";
  const subLabel = entity.num ? `#${entity.num}` : entity.subLabel;
  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);
  const hasMarker = entity.marker;

  // handlers

  function handleClick() {
    console.log("[CLICK] entity", entity);
    if (onClick) onClick(entity);
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
        {mainImage && (
          <ListItemAvatar>
            <Avatar src={mainImage.url} />
          </ListItemAvatar>
        )}
        {annotation && (
          <ListItemIcon>
            <AnnotationIcon annotation={annotation} spriteImage={spriteImage} />
          </ListItemIcon>
        )}
        <ListItemText primary={label} sx={{ fontStyle }} secondary={subLabel} />
      </ListItemButton>
    </ListItem>
  );
}
