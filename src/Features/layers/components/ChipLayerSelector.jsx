import { useState } from "react";

import { useSelector } from "react-redux";
import useUpdateAnnotations from "Features/annotations/hooks/useUpdateAnnotations";
import useLayers from "../hooks/useLayers";

import {
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import LayersIcon from "@mui/icons-material/Layers";
import Check from "@mui/icons-material/Check";

export default function ChipLayerSelector({
  annotationIds,
  annotations,
  baseMapId,
}) {
  const updateAnnotations = useUpdateAnnotations();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // data

  const layers = useLayers({ filterByBaseMapId: baseMapId, filterByScopeId: selectedScopeId });
  // "Travailler avec des calques" (Dessin module config, auto-enabled when the
  // base map has layers).
  const showLayers = useSelector((s) => s.popperMapListings.showLayers);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const uniqueLayerIds = [
    ...new Set(annotations.map((a) => a.layerId ?? null)),
  ];
  const isMixed = uniqueLayerIds.length > 1;
  const currentLayerId = isMixed ? null : uniqueLayerIds[0];
  const currentLayer = currentLayerId
    ? layers?.find((l) => l.id === currentLayerId)
    : null;

  let chipLabel;
  if (isMixed) {
    chipLabel = `${uniqueLayerIds.length} calques`;
  } else {
    chipLabel = currentLayer?.name ?? "Calque 0";
  }

  // handlers

  const handleOpen = (e) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = async (layerId) => {
    const updates = annotationIds.map((id) => ({
      id,
      layerId: layerId ?? null,
    }));
    await updateAnnotations(updates);
    handleClose();
  };

  // render

  // No chip when layers are turned off or when there is no layer to pick.
  if (!showLayers || !layers?.length) return null;

  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        icon={<LayersIcon sx={{ fontSize: "14px !important" }} />}
        label={chipLabel}
        onClick={handleOpen}
        sx={{
          height: 24,
          fontSize: "0.75rem",
          cursor: "pointer",
          "& .MuiChip-label": { px: 0.75 },
          "& .MuiChip-icon": { ml: 0.5 },
        }}
      />

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        {/* "Calque 0" option */}
        <MenuItem
          onClick={() => handleSelect(null)}
          selected={!isMixed && currentLayerId === null}
          dense
        >
          {uniqueLayerIds.includes(null) && (
            <ListItemIcon>
              <Check fontSize="small" />
            </ListItemIcon>
          )}
          <ListItemText inset={!uniqueLayerIds.includes(null)}>
            Calque 0
          </ListItemText>
        </MenuItem>

        {/* Layer options */}
        {layers?.map((layer) => {
          const isSelected = uniqueLayerIds.includes(layer.id);
          return (
            <MenuItem
              key={layer.id}
              onClick={() => handleSelect(layer.id)}
              dense
            >
              {isSelected && (
                <ListItemIcon>
                  <Check fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={!isSelected}>{layer.name}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
