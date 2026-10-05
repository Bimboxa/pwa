import { useState } from "react";

import { Menu, MenuItem } from "@mui/material";

import DialogBusinessObjectForm from "./DialogBusinessObjectForm";
import DialogDeleteBusinessObject from "./DialogDeleteBusinessObject";
import MenuItemAssignBusinessObjectAnnotations from "./MenuItemAssignBusinessObjectAnnotations";

import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";

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

  // helpers

  const type = getBusinessObjectTypeOfListing(listing);

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
        <MenuItem onClick={handleAddChild}>{type.strings.addChild}</MenuItem>
        <MenuItem onClick={() => setOpenEdit(true)}>Modifier</MenuItem>
        {type.features.assignByGeometry && (
          <MenuItemAssignBusinessObjectAnnotations
            businessObject={businessObject}
            onClick={onClose}
          />
        )}
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
