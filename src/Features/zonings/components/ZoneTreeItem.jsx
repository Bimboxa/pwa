import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSoloZone } from "../zoningsSlice";
import { setSoloMode } from "Features/popperMapListings/popperMapListingsSlice";

import { Box, IconButton, ListItemButton, ListItemText } from "@mui/material";
import { FilterAlt, FilterAltOutlined, MoreHoriz } from "@mui/icons-material";

import useArmZoneDrawing from "../hooks/useArmZoneDrawing";

import MenuActionsZone from "./MenuActionsZone";

export default function ZoneTreeItem({ zone, depth, listing, onAddChildZone }) {
  const dispatch = useDispatch();

  // data

  const selectedZoneId = useSelector((s) => s.zonings.selectedZoneId);
  const soloZone = useSelector((s) => s.zonings.soloZone);

  const armZoneDrawing = useArmZoneDrawing();

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // helpers

  const isSelected = selectedZoneId === zone.id;
  const isSolo = soloZone?.zoneId === zone.id;

  // handlers

  function handleClick() {
    armZoneDrawing(zone);
  }

  function handleSoloClick(e) {
    e.stopPropagation();
    if (isSolo) {
      dispatch(setSoloZone(null));
    } else {
      // zone solo and template solo are mutually exclusive
      dispatch(setSoloMode(false));
      dispatch(
        setSoloZone({
          zoneId: zone.id,
          listingId: zone.listingId,
          templateId: zone.templateId,
        })
      );
    }
  }

  function handleMenuClick(e) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
  }

  // render

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={handleClick}
        sx={{
          pl: 2 + depth * 2,
          "&:hover .zone-actions": { visibility: "visible" },
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            minWidth: 12,
            borderRadius: "50%",
            bgcolor: zone.color,
            mr: 1,
          }}
        />
        <ListItemText
          primary={zone.label}
          slotProps={{ primary: { variant: "body2", noWrap: true } }}
        />
        <Box
          className="zone-actions"
          sx={{
            visibility: isSolo ? "visible" : "hidden",
            display: "flex",
            alignItems: "center",
          }}
        >
          <IconButton
            size="small"
            onClick={handleSoloClick}
            title={isSolo ? "Tout afficher" : "Afficher uniquement cette zone"}
            color={isSolo ? "primary" : "default"}
          >
            {isSolo ? (
              <FilterAlt sx={{ fontSize: 16 }} />
            ) : (
              <FilterAltOutlined sx={{ fontSize: 16 }} />
            )}
          </IconButton>
          <IconButton size="small" onClick={handleMenuClick}>
            <MoreHoriz sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </ListItemButton>

      {menuAnchor && (
        <MenuActionsZone
          anchorEl={menuAnchor}
          zone={zone}
          listing={listing}
          onAddChildZone={onAddChildZone}
          onClose={() => setMenuAnchor(null)}
        />
      )}
    </>
  );
}
