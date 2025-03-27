import {useState} from "react";

import {blue} from "@mui/material/colors";

import Panel from "Features/layout/components/Panel";
import FormGeneric from "Features/form/components/FormGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";

export default function PanelCreateOption({onSaved, onCancelled}) {
  // string

  const createOptionLabel = "Créer une commande";

  // state

  const [option, setOption] = useState({color: blue[800]});

  // helpers

  const template = {
    fields: [
      {key: "name", label: "Nom", type: "text"},
      {
        key: "description",
        label: "Description",
        type: "text",
      },
      {
        key: "color",
        label: "Couleur",
        type: "color",
      },
    ],
  };

  // handlers

  function handleSave() {
    if (onSaved) onSaved();
  }

  function handleCancel() {
    if (onCancelled) onCancelled();
  }
  return (
    <Panel>
      <FormGeneric template={template} item={option} onItemChange={setOption} />
      <BottomBarCancelSave sx={{mt: 1}} />
    </Panel>
  );
}
