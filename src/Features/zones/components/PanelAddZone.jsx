import {useState, useEffect} from "react";

import {Box, Typography} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FormGeneric from "Features/form/components/FormGeneric";
import Panel from "Features/layout/components/Panel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";

import manageTree from "Features/tree/utils/manageTree";
import useCreateOrUpdateZonesTree from "../hooks/useCreateOrUpdateZonesTree";
import getNodeParentIdAndPosition from "Features/tree/utils/getNodeParentIdAndPosition";

import getNodeById from "Features/tree/utils/getNodeById";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function PanelAddZone({
  onClose,
  zonesTree,
  zonesListing,
  selectedZoneId,
  onZoneAdded,
}) {
  // strings

  const title = "Ajoutez une pièce";
  const addS = "Ajouter";

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

  // helper - description

  const selectedNode = getNodeById(selectedZoneId, zonesTree);

  const message1 =
    "La pièce sera ajoutée à la racine de l'arborescence. Sélectionnez une pièce existante pour positionner plus précisément la pièce dans l'arborescence.";

  const message2 = `La pièce sera ajoutée après "${selectedNode?.label}", au même niveau de l'arborescence. `;

  const message = selectedZoneId ? message2 : message1;

  // data

  const createOrUpdateZonesTree = useCreateOrUpdateZonesTree();

  // state

  const [item, setItem] = useState({});
  // handlers

  function handleItemChange(newItem) {
    setItem(newItem);
    //
  }

  function handleAddClick() {
    const {parentId, position} = getNodeParentIdAndPosition(
      selectedZoneId,
      zonesTree
    );
    console.log("[DialogAddZone] parentId, position", parentId, position);
    //
    const args = {
      action: "add_node",
      targetId: parentId,
      label: item.label,
      position: position + 1,
    };
    const {tree, newNode} = manageTree(zonesTree, args);

    createOrUpdateZonesTree(
      {listing: zonesListing, zonesTree: tree},
      {updateSyncFile: true}
    );
    //
    onZoneAdded({id: newNode.id, label: newNode.id});
  }

  return (
    <Panel>
      <HeaderTitleClose title={title} onClose={onClose} />
      <Box sx={{p: 2}}>
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      </Box>
      <FormGeneric
        template={template}
        item={item}
        onItemChange={handleItemChange}
        //focusOnFirstField={true}
      />
      <ButtonInPanel label={addS} onClick={handleAddClick} />
    </Panel>
  );
}
