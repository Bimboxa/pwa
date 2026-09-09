import { useState } from "react";

import { Menu, MenuItem } from "@mui/material";

import DialogWorkPackageForm from "./DialogWorkPackageForm";
import DialogDeleteWorkPackage from "./DialogDeleteWorkPackage";

export default function MenuActionsWorkPackage({
  anchorEl,
  workPackage,
  listing,
  onClose,
}) {
  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  return (
    <>
      <Menu
        open={Boolean(anchorEl) && !openEdit && !openDelete}
        anchorEl={anchorEl}
        onClose={onClose}
      >
        <MenuItem onClick={() => setOpenEdit(true)}>Modifier</MenuItem>
        <MenuItem
          onClick={() => setOpenDelete(true)}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>
      {openEdit && (
        <DialogWorkPackageForm
          open
          listing={listing}
          workPackage={workPackage}
          onClose={() => {
            setOpenEdit(false);
            onClose();
          }}
        />
      )}
      {openDelete && (
        <DialogDeleteWorkPackage
          open
          workPackage={workPackage}
          onClose={() => {
            setOpenDelete(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
