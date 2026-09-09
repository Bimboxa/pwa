import { createElement } from "react";
import {
  List,
  ListItem,
  ListItemIcon,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Typography,
  Avatar,
  Icon,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Square, Add, ArrowForwardIos } from "@mui/icons-material";

import iconsMap from "../data/iconsMap";
import SkeletonList from "Features/layout/components/SkeletonList";
import IconListingVariantBasic from "./IconListingVariantBasic";

// `showIcon` false drops the listing's colored icon square: panels that group
// listings by type carry the icon on the group header instead, where it says
// something the row does not repeat.
export default function ListListings({
  listings,
  selection,
  onClick,
  onSeeObjects,
  loading,
  onAddClick,
  showIcon = true,
}) {
  // strings

  const seeObjectsS = "Voir les objets";
  // string

  const addPrimary = "Nouveau";
  const addSecondary = "Ajouter un module";

  return (
    <>
      {loading && <SkeletonList />}
      {!loading && (
        <List sx={{ width: 1 }} dense>
          {listings?.map((listing) => (
            <ListItem
              key={listing?.id}
              disablePadding
              divider
              secondaryAction={
                onSeeObjects ? (
                  <Tooltip title={seeObjectsS} placement="top">
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSeeObjects(listing);
                      }}
                    >
                      <ArrowForwardIos fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                ) : undefined
              }
            >
              <ListItemButton
                sx={{ p: 0.5, px: 1 }}
                selected={selection?.includes(listing?.id)}
                onClick={() => onClick(listing)}
              >
                {showIcon && <IconListingVariantBasic listing={listing} />}
                <Typography variant="body2" sx={{ pl: showIcon ? 1 : 0 }}>
                  {listing?.name}
                </Typography>
              </ListItemButton>
            </ListItem>
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
