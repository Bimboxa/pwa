import { useState } from "react";

import { List, ListItemButton, ListItemText, Box } from "@mui/material";
import { CreateNewFolderOutlined } from "@mui/icons-material";

import useZoningListings from "../hooks/useZoningListings";
import useCreateZoningListing from "../hooks/useCreateZoningListing";

import ZoningListingItem from "./ZoningListingItem";
import DialogCreateZone from "./DialogCreateZone";

export default function ZoningsTree() {
  // data

  const listings = useZoningListings();
  const createZoningListing = useCreateZoningListing();

  // state

  // {listing, parentZone} | null — zone creation dialog target
  const [createZoneTarget, setCreateZoneTarget] = useState(null);

  // handlers

  async function handleCreateListing() {
    await createZoningListing({
      name: `Zonage ${(listings?.length || 0) + 1}`,
    });
  }

  // render

  return (
    <Box sx={{ p: 1 }}>
      <List dense disablePadding>
        {listings?.map((listing) => (
          <ZoningListingItem
            key={listing.id}
            listing={listing}
            onAddZone={(parentZone) =>
              setCreateZoneTarget({ listing, parentZone: parentZone ?? null })
            }
          />
        ))}
      </List>

      <ListItemButton
        onClick={handleCreateListing}
        sx={{ pl: 1, color: "text.disabled" }}
      >
        <CreateNewFolderOutlined sx={{ fontSize: 20, mr: 1 }} color="disabled" />
        <ListItemText
          primary="Nouveau zonage"
          slotProps={{
            primary: { variant: "body2", color: "text.disabled" },
          }}
        />
      </ListItemButton>

      {createZoneTarget && (
        <DialogCreateZone
          open
          listing={createZoneTarget.listing}
          parentZone={createZoneTarget.parentZone}
          onClose={() => setCreateZoneTarget(null)}
        />
      )}
    </Box>
  );
}
