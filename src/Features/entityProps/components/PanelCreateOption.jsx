import {nanoid} from "@reduxjs/toolkit";
import {useState} from "react";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import {blue} from "@mui/material/colors";

import Panel from "Features/layout/components/Panel";
import FormGeneric from "Features/form/components/FormGeneric";
import BottomBarCancelSave from "Features/layout/components/BottomBarCancelSave";

export default function PanelCreateOption({onSaved, onCancelled}) {
  // string

  const createOptionLabel = "Créer une commande";

  // data

  const {value: listing} = useSelectedListing();
  const updateListing = useUpdateListing();

  // state

  const [option, setOption] = useState({color: blue[800]});

  // helpers

  const template = {
    fields: [
      {key: "label", label: "Nom", type: "text"},
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

  async function handleSave() {
    const options = listing.options ?? [];
    const newOption = {...option, id: nanoid()};
    const newOptions = [...options, newOption];
    await updateListing({id: listing.id, options: newOptions});
    if (onSaved) onSaved();
  }

  function handleCancel() {
    if (onCancelled) onCancelled();
  }
  return (
    <Panel>
      <FormGeneric template={template} item={option} onItemChange={setOption} />
      <BottomBarCancelSave
        sx={{mt: 1}}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </Panel>
  );
}
