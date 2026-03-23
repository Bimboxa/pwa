import { useState } from "react";

import { useSelector } from "react-redux";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";
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
  const updateAnnotation = useUpdateAnnotation();
  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);

  // data

  const layers = useLayers({ filterByBaseMapId: baseMapId, filterByScopeId: selectedScopeId });

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
    chipLabel = currentLayer?.name ?? "Sans calque";
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
    for (const id of annotationIds) {
      await updateAnnotation({ id, layerId: layerId ?? null });
    }
    handleClose();
  };

  // render

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
        {/* "Sans calque" option */}
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
            Sans calque
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
