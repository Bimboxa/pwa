import {createElement} from "react";
import {
  List,
  ListItemIcon,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Icon,
} from "@mui/material";
import {Square, Add} from "@mui/icons-material";

import iconsMap from "../data/iconsMap";
import SkeletonList from "Features/layout/components/SkeletonList";

export default function ListListings({
  listings,
  selection,
  onClick,
  loading,
  onAddClick,
}) {
  // string

  const addPrimary = "Nouveau";
  const addSecondary = "Ajouter un module";

  return (
    <>
      {loading && <SkeletonList />}
      {!loading && (
        <List sx={{width: 1}}>
          {listings?.map((listing) => (
            <ListItemButton
              key={listing?.id}
              selected={selection?.includes(listing?.id)}
              onClick={() => onClick(listing)}
              divider
            >
              <ListItemAvatar>
                <Avatar sx={{backgroundColor: listing?.color}}>
                  {createElement(iconsMap.get(listing?.iconKey) ?? Square, {
                    sx: {color: "inherit"},
                  })}
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={listing?.name} />
            </ListItemButton>
          ))}
          {onAddClick && (
            <ListItemButton onClick={onAddClick}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary={addPrimary} secondary={addSecondary} />
            </ListItemButton>
          )}
        </List>
      )}
    </>
  );
}
