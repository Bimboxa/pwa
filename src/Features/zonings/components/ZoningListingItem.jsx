import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { toggleListingCollapsed } from "../zoningsSlice";

import {
  Box,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import {
  ExpandMore,
  ChevronRight,
  Folder,
  MoreHoriz,
  Add,
} from "@mui/icons-material";

import useZones from "../hooks/useZones";
import useDeleteZoningListing from "../hooks/useDeleteZoningListing";
import buildZonesTree from "../utils/buildZonesTree";

import ZoneTreeItem from "./ZoneTreeItem";
import DialogRenameZoningListing from "./DialogRenameZoningListing";

export default function ZoningListingItem({ listing, onAddZone }) {
  const dispatch = useDispatch();

  // data

  const collapsedListingIds = useSelector(
    (s) => s.zonings.collapsedListingIds
  );
  const { value: zones } = useZones({ listingId: listing.id });
  const deleteZoningListing = useDeleteZoningListing();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [openRename, setOpenRename] = useState(false);

  // helpers

  const collapsed = collapsedListingIds.includes(listing.id);
  const flatTree = useMemo(() => buildZonesTree(zones), [zones]);

  // handlers

  function handleToggleCollapsed() {
    dispatch(toggleListingCollapsed(listing.id));
  }

  function handleMenuClick(e) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }

  function handleRename() {
    setMenuAnchor(null);
    setOpenRename(true);
  }

  function handleAddRootZone() {
    setMenuAnchor(null);
    onAddZone?.(null);
  }

  async function handleDelete() {
    setMenuAnchor(null);
    await deleteZoningListing(listing);
  }

  // render

  return (
    <Box>
      <ListItemButton
        onClick={handleToggleCollapsed}
        sx={{
          pl: 0.5,
          "&:hover .zoning-listing-actions": { visibility: "visible" },
        }}
      >
        {collapsed ? (
          <ChevronRight sx={{ fontSize: 18 }} color="action" />
        ) : (
          <ExpandMore sx={{ fontSize: 18 }} color="action" />
        )}
        <Folder sx={{ fontSize: 18, mx: 0.5 }} color="action" />
        <ListItemText
          primary={listing.name}
          slotProps={{ primary: { variant: "body2", noWrap: true } }}
        />
        <Box
          className="zoning-listing-actions"
          sx={{ visibility: "hidden", display: "flex", alignItems: "center" }}
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onAddZone?.(null);
            }}
            title="Ajouter une zone"
          >
            <Add sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreHoriz sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </ListItemButton>

      <Collapse in={!collapsed}>
        <List dense disablePadding>
          {flatTree.map(({ zone, depth }) => (
            <ZoneTreeItem
              key={zone.id}
              zone={zone}
              depth={depth}
              listing={listing}
              onAddChildZone={() => onAddZone?.(zone)}
            />
          ))}
          {flatTree.length === 0 && (
            <Typography
              variant="caption"
              color="text.disabled"
              sx={{ pl: 4, py: 0.5, display: "block" }}
            >
              Aucune zone
            </Typography>
          )}
        </List>
      </Collapse>

      <Menu
        open={Boolean(menuAnchor)}
        anchorEl={menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleAddRootZone}>Ajouter une zone</MenuItem>
        <MenuItem onClick={handleRename}>Renommer</MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          Supprimer
        </MenuItem>
      </Menu>

      {openRename && (
        <DialogRenameZoningListing
          open
          listing={listing}
          onClose={() => setOpenRename(false)}
        />
      )}
    </Box>
  );
}
