import { useDispatch, useSelector } from "react-redux";
import { setAdminSelectedEntityId } from "../adminEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  setNewEntity,
  setSelectedEntityId,
} from "Features/entities/entitiesSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";

import { Box, Button, Typography } from "@mui/material";
import { Add } from "@mui/icons-material";

import { useLiveQuery } from "dexie-react-hooks";
import db from "App/db/db";

export default function AdminColumnEntities() {
  const dispatch = useDispatch();

  // data

  const searchQuery = useSelector((s) => s.adminEditor.searchQuery);
  const selectedListingId = useSelector(
    (s) => s.adminEditor.selectedListingId
  );
  const selectedEntityId = useSelector(
    (s) => s.adminEditor.selectedEntityId
  );

  const listing = useLiveQuery(async () => {
    if (!selectedListingId) return null;
    return db.listings.get(selectedListingId);
  }, [selectedListingId]);

  const entities = useLiveQuery(async () => {
    if (!selectedListingId || !listing) return [];
    const table = listing.table || "entities";
    return (
      await db[table]
        .where("listingId")
        .equals(selectedListingId)
        .toArray()
    ).filter((r) => !r.deletedAt);
  }, [selectedListingId, listing]);

  // helpers

  const query = searchQuery?.toLowerCase() ?? "";
  const filtered = entities?.filter((entity) => {
    if (!query) return true;
    return (
      entity.name?.toLowerCase().includes(query) ||
      entity.num?.toLowerCase().includes(query) ||
      entity.title?.toLowerCase().includes(query) ||
      entity.text?.toLowerCase().includes(query) ||
      entity.label?.toLowerCase().includes(query)
    );
  });

  // handlers

  function handleSelect(entity) {
    dispatch(setAdminSelectedEntityId(entity.id));
    dispatch(setSelectedEntityId(entity.id));
    dispatch(setSelectedListingId(entity.listingId));
    dispatch(setSelectedMenuItemKey("ADMIN_ENTITY"));
  }

  function handleNew() {
    dispatch(setSelectedListingId(selectedListingId));
    dispatch(setNewEntity({}));
    dispatch(setSelectedMenuItemKey("ADMIN_ENTITY"));
  }

  // render

  if (!selectedListingId) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Select a listing
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
      }}
    >
      <Box sx={{ p: 1, borderBottom: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle2">
          Entities ({filtered?.length ?? 0})
        </Typography>
      </Box>
      <Box sx={{ overflow: "auto", flexGrow: 1 }}>
        {filtered?.map((entity) => (
          <Box
            key={entity.id}
            onClick={() => handleSelect(entity)}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              p: 1,
              cursor: "pointer",
              bgcolor:
                selectedEntityId === entity.id
                  ? "action.selected"
                  : "transparent",
              "&:hover": {
                bgcolor:
                  selectedEntityId === entity.id
                    ? "action.selected"
                    : "action.hover",
              },
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" noWrap>
              {entity.num || entity.name || entity.title || entity.label || entity.id}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ p: 1 }}>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleNew}
          fullWidth
          variant="outlined"
        >
          New
        </Button>
      </Box>
    </Box>
  );
}
