import {
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
} from "@mui/material";
import {NearMe as Focus} from "@mui/icons-material";

import getEntityMainImage from "../utils/getEntityMainImage";

export default function ListItemEntityVariantDefault({
  entity,
  onClick,
  selection,
}) {
  // helpers

  const label = entity.label;
  const subLabel = entity.subLabel;
  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);
  const hasMarker = entity.marker;

  // handlers

  function handleClick() {
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
      <ListItemButton onClick={handleClick} selected={isSelected}>
        {mainImage && (
          <ListItemAvatar>
            <Avatar src={mainImage.url} />
          </ListItemAvatar>
        )}
        <ListItemText primary={label} secondary={subLabel} />
      </ListItemButton>
    </ListItem>
  );
}
