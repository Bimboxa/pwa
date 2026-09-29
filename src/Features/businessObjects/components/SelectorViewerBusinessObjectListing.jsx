import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSoloBusinessObjectId } from "../businessObjectsSlice";
import { setViewerBusinessObjectListingId } from "Features/panelDrawing/panelDrawingSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import selectSelectedBusinessObjectId from "../utils/selectSelectedBusinessObjectId";

import { Box, ListItemText, Menu, MenuItem, Typography } from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";

// Listing selector of the Viewer module's business objects view: read-only
// clone of FieldActiveBusinessObjectListing (no reordering, no creation, no
// rename / delete).
export default function SelectorViewerBusinessObjectListing({
  typeKey,
  listings,
  activeListing,
}) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Liste";

  // data

  const selectedBusinessObjectId = useSelector(selectSelectedBusinessObjectId);
  const soloBusinessObjectId = useSelector(
    (s) => s.businessObjects.soloBusinessObjectId
  );

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // handlers

  // The solo display and the object selection belong to the previous listing.
  function handleSelectListing(listingId) {
    setMenuAnchor(null);
    if (listingId === activeListing?.id) return;
    if (soloBusinessObjectId) dispatch(setSoloBusinessObjectId(null));
    if (selectedBusinessObjectId) dispatch(clearSelection());
    dispatch(setViewerBusinessObjectListingId({ typeKey, listingId }));
  }

  // render

  return (
    <Box sx={{ px: 1.5, pb: 1 }}>
      <Box
        component="button"
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        sx={{
          width: 1,
          display: "flex",
          alignItems: "center",
          gap: 1,
          textAlign: "left",
          px: 2,
          py: 1,
          cursor: "pointer",
          fontFamily: "inherit",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          "&:hover": { borderColor: "text.secondary" },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontSize: "0.65rem",
            }}
          >
            {labelS}
          </Typography>
          <Typography
            variant="subtitle1"
            noWrap
            sx={{ fontWeight: 700, lineHeight: 1.3 }}
          >
            {activeListing?.name ?? activeListing?.label ?? "Liste"}
          </Typography>
        </Box>
        <ExpandMore sx={{ color: "text.secondary", flexShrink: 0 }} />
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        slotProps={{
          paper: {
            sx: {
              minWidth: menuAnchor?.offsetWidth ?? 240,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        {listings?.map((listing) => {
          const selected = listing.id === activeListing?.id;
          return (
            <MenuItem
              key={listing.id}
              selected={selected}
              onClick={() => handleSelectListing(listing.id)}
              sx={{
                py: 0.75,
                borderLeft: "3px solid",
                borderLeftColor: selected ? "secondary.main" : "transparent",
              }}
            >
              <ListItemText
                primaryTypographyProps={{
                  variant: "body2",
                  noWrap: true,
                  fontWeight: selected ? 600 : 400,
                }}
              >
                {listing.name ?? listing.label ?? "Liste"}
              </ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </Box>
  );
}
