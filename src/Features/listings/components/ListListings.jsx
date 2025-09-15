import { createElement } from "react";
import {
  List,
  ListItemIcon,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Typography,
  Avatar,
  Icon,
} from "@mui/material";
import { Square, Add } from "@mui/icons-material";

import iconsMap from "../data/iconsMap";
import SkeletonList from "Features/layout/components/SkeletonList";
import IconListingVariantBasic from "./IconListingVariantBasic";

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
        <List sx={{ width: 1 }} dense>
          {listings?.map((listing) => (
            <ListItemButton
              sx={{ p: 0.5, px: 1 }}
              key={listing?.id}
              selected={selection?.includes(listing?.id)}
              onClick={() => onClick(listing)}
              divider
            >
              <IconListingVariantBasic listing={listing} />
              <Typography variant="body2" sx={{ pl: 1 }}>
                {listing?.name}
              </Typography>
            </ListItemButton>
          ))}
          {/* {onAddClick && (
            <ListItemButton onClick={onAddClick}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary={addPrimary} secondary={addSecondary} />
            </ListItemButton>
          )} */}
        </List>
      )}
    </>
  );
}
