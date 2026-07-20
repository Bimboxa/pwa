import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSoloZone, setSelectedZoneId } from "../zoningsSlice";
import {
  setSoloVisibleTemplateIds,
  setSoloListingId,
} from "Features/popperMapListings/popperMapListingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, IconButton, ListItemButton, ListItemText } from "@mui/material";
import {
  FilterAlt,
  FilterAltOutlined,
  MoreHoriz,
  DragIndicator,
} from "@mui/icons-material";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import MenuActionsZone from "./MenuActionsZone";

export default function ZoneTreeItem({ zone, depth, listing, onAddChildZone }) {
  const dispatch = useDispatch();

  // data

  const selectedZoneId = useSelector((s) => s.zonings.selectedZoneId);
  const soloZone = useSelector((s) => s.zonings.soloZone);

  // state

  const [menuAnchor, setMenuAnchor] = useState(null);

  // dnd — the whole row is draggable (5px activation keeps clicks working),
  // with a grab handle revealed on hover, like the baseMaps drawer rows.
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: zone.id,
      data: { type: "zone", listingId: zone.listingId },
    });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // helpers

  const isSelected = selectedZoneId === zone.id;
  const isSolo = soloZone?.zoneId === zone.id;

  // handlers

  // Clicking a zone only selects it: the popper's "Nouvelle zone" section
  // switches to this zone's template, and the right panel shows the zone's
  // properties (legend of the linked annotations). The SOLO filter is toggled
  // exclusively by the filter icon button.
  function handleClick() {
    dispatch(setSelectedZoneId(zone.id));
    dispatch(
      setSelectedItem({ id: zone.id, type: "ZONE", listingId: zone.listingId })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  function handleSoloClick(e) {
    e.stopPropagation();
    if (isSolo) {
      dispatch(setSoloZone(null));
    } else {
      // zone solo and template solo are mutually exclusive — clear the
      // template solo selection without touching soloMode (owned by the
      // popper's SELECT/3D/ZONES effect).
      dispatch(setSoloVisibleTemplateIds(null));
      dispatch(setSoloListingId(null));
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
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        component="div"
        selected={isSelected}
        onClick={handleClick}
        sx={{
          pl: 2 + depth * 2,
          ...sortableStyle,
          "&:hover .zone-actions": { visibility: "visible" },
          "&:hover .row-drag-handle": { opacity: 1 },
        }}
      >
        <DragIndicator
          className="row-drag-handle"
          sx={{
            fontSize: 14,
            color: "text.disabled",
            cursor: "grab",
            opacity: 0,
            transition: "0.2s",
            ml: -1.5,
            mr: 0.5,
          }}
        />
        <Box
          sx={{
            width: 12,
            height: 12,
            minWidth: 12,
            borderRadius: "2px",
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
