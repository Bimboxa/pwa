import {useState, useEffect} from "react";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";

import manageTree from "Features/tree/utils/manageTree";
import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";

export default function DialogDeleteZone({open, onClose, zone, zonesTree}) {
  // data

  const createOrUpdateZonesTree = useCreateOrUpdateZonesTree();

  // state

  const [item, setItem] = useState({zone});
  console.log("[DialogRenameZone] item", item);

  useEffect(() => {
    if (zone?.id) setItem(zone);
  }, [zone?.id]);

  // handlers

  function handleDelete() {
    setItem(item);
    //
    const args = {
      action: "remove_node",
      targetId: zone.id,
    };
    const tree = manageTree(zonesTree, args);
    createOrUpdateZonesTree({zonesTree: tree}, {updateSyncFile: true});
    //
    onClose();
  }

  return (
    <DialogDeleteRessource
      open={open}
      onClose={onClose}
      onConfirmAsync={handleDelete}
    />
  );
}
