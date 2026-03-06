import {
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from "@mui/material";
import { lighten } from "@mui/material/styles";
import { Image } from "@mui/icons-material";

import theme from "Styles/theme";

import getEntityMainImage from "Features/entities/utils/getEntityMainImage";

export default function ListItemEntitySimple({
  entity,
  onClick,
  selected,
  listingColor = theme.palette.primary.main,
}) {
  // helpers

  const label = entity.label ?? "—";
  const subLabel = entity.subLabel ?? null;
  const mainImage = getEntityMainImage(entity);

  // handlers

  function handleClick() {
    if (onClick) onClick(entity);
  }

  // render

  return (
    <ListItemButton
      divider
      selected={selected}
      onClick={handleClick}
      sx={{
        px: 1,
        py: 0.5,
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
      <ListItemAvatar sx={{ minWidth: 40 }}>
        {mainImage ? (
          <Avatar
            src={mainImage.url}
            variant="rounded"
            sx={{ width: 32, height: 32 }}
          />
        ) : (
          <Avatar variant="rounded" sx={{ width: 32, height: 32 }}>
            <Image fontSize="small" />
          </Avatar>
        )}
      </ListItemAvatar>
      <ListItemText
        primary={label}
        secondary={subLabel}
        primaryTypographyProps={{ variant: "body2", noWrap: true }}
        secondaryTypographyProps={{
          variant: "caption",
          noWrap: true,
          sx: selected ? { color: "inherit", opacity: 0.7 } : {},
        }}
      />
    </ListItemButton>
  );
}
