import { useState } from "react";

import {
  Chip,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import Check from "@mui/icons-material/Check";
import ViewInArIcon from "@mui/icons-material/ViewInAr";

import useUpdateAnnotation from "../hooks/useUpdateAnnotation";
import { getShape3DOptionsForType } from "../constants/shape3DConfig";

const DEFAULT_LABEL = "Forme par défaut";

export default function Shape3DSelector({ annotation }) {
  // data

  const updateAnnotation = useUpdateAnnotation();
  const options = getShape3DOptionsForType(annotation?.type);

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  if (!annotation || options.length === 0) return null;

  const current = annotation.shape3D ?? null;
  const currentEntry = options.find((o) => o.key === current);
  const chipLabel = currentEntry?.label ?? DEFAULT_LABEL;

  // handlers

  function handleOpen(e) {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  async function handleSelect(key) {
    await updateAnnotation({ id: annotation.id, shape3D: key ?? null });
    handleClose();
  }

  // render

  return (
    <>
      <Chip
        size="small"
        variant="outlined"
        icon={<ViewInArIcon sx={{ fontSize: "14px !important" }} />}
        label={chipLabel}
        onClick={handleOpen}
        onMouseDown={(e) => e.stopPropagation()}
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
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => handleSelect(null)} dense>
          {current === null && (
            <ListItemIcon>
              <Check fontSize="small" />
            </ListItemIcon>
          )}
          <ListItemText inset={current !== null}>{DEFAULT_LABEL}</ListItemText>
        </MenuItem>
        {options.map((opt) => (
          <MenuItem key={opt.key} onClick={() => handleSelect(opt.key)} dense>
            {current === opt.key && (
              <ListItemIcon>
                <Check fontSize="small" />
              </ListItemIcon>
            )}
            <ListItemText inset={current !== opt.key}>{opt.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
