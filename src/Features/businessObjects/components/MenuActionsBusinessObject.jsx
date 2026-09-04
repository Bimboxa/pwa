import { useState } from "react";

import { Menu, MenuItem } from "@mui/material";

import DialogBusinessObjectForm from "./DialogBusinessObjectForm";
import DialogDeleteBusinessObject from "./DialogDeleteBusinessObject";

export default function MenuActionsBusinessObject({
  anchorEl,
  businessObject,
  listing,
  onAddChildBusinessObject,
  onClose,
}) {
  // state

  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // handlers

  function handleAddChild() {
    onClose();
    onAddChildBusinessObject?.();
  }


  // render

  return (
    <>
      <Menu
        open={Boolean(anchorEl) && !openEdit && !openDelete}
        anchorEl={anchorEl}
        onClose={onClose}
      >
        <MenuItem onClick={handleAddChild}>Ajouter un sous-ouvrage</MenuItem>
        <MenuItem onClick={() => setOpenEdit(true)}>Modifier</MenuItem>
        <MenuItem
          onClick={() => setOpenDelete(true)}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {openEdit && (
        <DialogBusinessObjectForm
          open
          listing={listing}
          businessObject={businessObject}
          onClose={() => {
            setOpenEdit(false);
            onClose();
          }}
        />
      )}

      {openDelete && (
        <DialogDeleteBusinessObject
          open
          businessObject={businessObject}
          onClose={() => {
            setOpenDelete(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
