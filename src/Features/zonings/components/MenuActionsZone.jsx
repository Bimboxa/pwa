import { useState } from "react";

import { Box, Menu, MenuItem } from "@mui/material";

import { CirclePicker } from "react-color";
import defaultColors from "Features/colors/data/defaultColors";

import useUpdateZone from "../hooks/useUpdateZone";

import DialogRenameZone from "./DialogRenameZone";
import DialogDeleteZone from "./DialogDeleteZone";

export default function MenuActionsZone({
  anchorEl,
  zone,
  listing,
  onAddChildZone,
  onClose,
}) {
  const updateZone = useUpdateZone();

  // state

  const [openRename, setOpenRename] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // handlers

  function handleAddChild() {
    onClose();
    onAddChildZone?.();
  }

  async function handleColorChange(color) {
    await updateZone(zone.id, { color: color.hex });
    onClose();
  }

  // render

  return (
    <>
      <Menu
        open={Boolean(anchorEl) && !openRename && !openDelete}
        anchorEl={anchorEl}
        onClose={onClose}
      >
        <MenuItem onClick={handleAddChild}>Ajouter une sous-zone</MenuItem>
        <MenuItem onClick={() => setOpenRename(true)}>Renommer</MenuItem>
        <MenuItem onClick={() => setShowColorPicker((v) => !v)}>
          Changer la couleur
        </MenuItem>
        {showColorPicker && (
          <Box sx={{ p: 2 }}>
            <CirclePicker
              onChange={handleColorChange}
              color={zone.color}
              colors={defaultColors}
              circleSize={16}
              circleSpacing={9}
            />
          </Box>
        )}
        <MenuItem
          onClick={() => setOpenDelete(true)}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {openRename && (
        <DialogRenameZone
          open
          zone={zone}
          onClose={() => {
            setOpenRename(false);
            onClose();
          }}
        />
      )}

      {openDelete && (
        <DialogDeleteZone
          open
          zone={zone}
          listing={listing}
          onClose={() => {
            setOpenDelete(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
