import {
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
} from "@mui/material";

import getEntityMainImage from "../utils/getEntityMainImage";

export default function ListItemEntityVariantDefault({
  entity,
  onClick,
  selection,
}) {
  // helpers

  const label = entity.label;
  const isSelected = selection?.includes(entity.id);
  const mainImage = getEntityMainImage(entity);

  // handlers

  function handleClick() {
    if (onClick) onClick(entity);
  }
  return (
    <ListItem divider disablePadding>
      <ListItemButton onClick={handleClick} selected={isSelected}>
        {mainImage && (
          <ListItemAvatar>
            <Avatar src={mainImage.url} />
          </ListItemAvatar>
        )}
        <ListItemText>{label}</ListItemText>
      </ListItemButton>
    </ListItem>
  );
}
