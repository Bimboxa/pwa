import {createElement} from "react";
import {
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Icon,
} from "@mui/material";
import {Square} from "@mui/icons-material";

import iconsMap from "../data/iconsMap";
import SkeletonList from "Features/layout/components/SkeletonList";

export default function ListListings({listings, selection, onClick, loading}) {
  console.log("listings", listings, loading);
  return (
    <>
      {loading && <SkeletonList />}
      {!loading && (
        <List>
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
        </List>
      )}
    </>
  );
}
