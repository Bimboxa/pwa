import { useState } from "react";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import DialogDeleteEntity from "./DialogDeleteEntity";

export default function MenuActionsEntity({ anchorEl, onClose, entity }) {
  // state

  const [openDelete, setOpenDelete] = useState(false);

  // data

  const actions = [
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

      {openDelete && (
        <DialogDeleteEntity
          entity={entity}
          open={openDelete}
          onClose={() => setOpenDelete(false)}
        />
      )}
    </>
  );
}
