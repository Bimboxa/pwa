import {useState, useEffect} from "react";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormGeneric from "Features/form/components/FormGeneric";

import manageTree from "Features/tree/utils/manageTree";
import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";
import getNodeParentIdAndPosition from "Features/tree/utils/getNodeParentIdAndPosition";

export default function DialogAddZone({open, onClose, zone, zonesTree}) {
  // helpers

  const template = {
    fields: [
      {
        key: "label",
        label: "Nom",
        type: "text",
      },
    ],
  };

  // data

  const createOrUpdateZonesTree = useCreateOrUpdateZonesTree();

  // state

  const [item, setItem] = useState({zone});
  console.log("[DialogRenameZone] item", item);

  useEffect(() => {
    if (zone?.id) setItem(zone);
  }, [zone?.id]);

  // handlers

  function handleItemChange(item) {
    setItem(item);
    //
    const {parentId, position} = getNodeParentIdAndPosition(zone.id, zonesTree);
    console.log("[DialogAddZone] parentId, position", parentId, position);
    //
    const args = {
      action: "add_node",
      targetId: parentId,
      label: item.label,
      position: position + 1,
    };
    const tree = manageTree(zonesTree, args);
    createOrUpdateZonesTree({zonesTree: tree}, {updateSyncFile: true});
    //
    onClose();
  }

  return (
    <DialogGeneric open={open} onClose={onClose}>
      <FormGeneric
        template={template}
        item={item}
        onItemChange={handleItemChange}
        focusOnFirstField={true}
      />
    </DialogGeneric>
  );
}
