import {useState} from "react";

import MenuGeneric from "Features/layout/components/MenuGeneric";

import DialogRenameZone from "./DialogRenameZone";
import DialogDeleteZone from "./DialogDeleteZone";
import DialogAddZone from "./DialogAddZone";

export default function MenuActionsZone({anchorEl, onClose, zone, zonesTree}) {
  // state

  const [openAdd, setOpenAdd] = useState(false);
  const [openRename, setOpenRename] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  // data

  const actions = [
    {
      label: "Ajouter une zone",
      handler: () => {
        setOpenAdd(true);
      },
    },
    {
      label: "Renommer",
      handler: () => {
        console.log("rename");
        setOpenRename(true);
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
      {openAdd && (
        <DialogAddZone
          zone={zone}
          zonesTree={zonesTree}
          open={openAdd}
          onClose={() => setOpenAdd(false)}
        />
      )}
      {openRename && (
        <DialogRenameZone
          zone={zone}
          zonesTree={zonesTree}
          open={openRename}
          onClose={() => setOpenRename(false)}
        />
      )}
      {openDelete && (
        <DialogDeleteZone
          zone={zone}
          zonesTree={zonesTree}
          open={openDelete}
          onClose={() => setOpenDelete(false)}
        />
      )}
    </>
  );
}
