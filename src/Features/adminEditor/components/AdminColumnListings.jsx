import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setAdminSelectedListingId } from "../adminEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Button, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import useListings from "Features/listings/hooks/useListings";
import DialogCreateListing from "Features/listings/components/DialogCreateListing";

export default function AdminColumnListings() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const searchQuery = useSelector((s) => s.adminEditor.searchQuery);
  const selectedEntityModelKey = useSelector(
    (s) => s.adminEditor.selectedEntityModelKey
  );
  const selectedListingId = useSelector(
    (s) => s.adminEditor.selectedListingId
  );

  const listings = useListings({ filterByProjectId: projectId });

  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  const query = searchQuery?.toLowerCase() ?? "";
  const filtered = listings
    ?.filter((l) => {
      if (!selectedEntityModelKey) return false;
      return l.entityModelKey === selectedEntityModelKey || l.entityModel?.key === selectedEntityModelKey;
    })
    ?.filter((l) => {
      if (!query) return true;
      return l.name?.toLowerCase().includes(query);
    });

  // handlers

  function handleSelect(id) {
    dispatch(setAdminSelectedListingId(id));
    dispatch(setSelectedMenuItemKey("ADMIN_LISTING"));
  }

  // render

  if (!selectedEntityModelKey) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          borderRight: (theme) => `1px solid ${theme.palette.divider}`,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Select a model
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        borderRight: (theme) => `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ p: 1, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle2">
          Listings ({filtered?.length ?? 0})
        </Typography>
      </Box>
      <Box sx={{ overflow: "auto", flexGrow: 1 }}>
        {filtered?.map((listing) => (
          <Box
            key={listing.id}
            onClick={() => handleSelect(listing.id)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              cursor: "pointer",
              bgcolor:
                selectedListingId === listing.id
                  ? "action.selected"
                  : "transparent",
              "&:hover": {
                bgcolor:
                  selectedListingId === listing.id
                    ? "action.selected"
                    : "action.hover",
              },
              borderRadius: 1,
            }}
          >
            {listing.color && (
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  bgcolor: listing.color,
                  flexShrink: 0,
                }}
              />
            )}
            <Typography variant="body2" noWrap>
              {listing.name}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={() => setOpenDialog(true)}
          fullWidth
          variant="outlined"
        >
          New
        </Button>
      </Box>
      <DialogCreateListing
        open={openDialog}
        onClose={() => setOpenDialog(false)}
      />
    </Box>
  );
}
