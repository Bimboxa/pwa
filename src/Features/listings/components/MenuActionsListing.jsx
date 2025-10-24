import { useState } from "react";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import DialogDeleteListing from "./DialogDeleteListing";
import DialogEditListing from "./DialogEditListing";

export default function MenuActionsListing({ anchorEl, onClose, listing }) {
  // state

  const [openEdit, setOpenEdit] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // data

  const actions = [
    {
      label: "Editer la liste",
      handler: () => {
        setOpenEdit(true);
      },
    },
    {
      label: "Supprimer",
      handler: () => {
        console.log("delete");
        setOpenDelete(true);
      },
    },
  ];

  // render

  return (
    <>
      <MenuGeneric
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={onClose}
        actions={actions}
      />
      {openEdit && (
        <DialogEditListing
          listing={listing}
          open={openEdit}
          onClose={() => setOpenEdit(false)}
        />
      )}

      {openDelete && (
        <DialogDeleteListing
          listing={listing}
          open={openDelete}
          onClose={() => setOpenDelete(false)}
        />
      )}
    </>
  );
}
