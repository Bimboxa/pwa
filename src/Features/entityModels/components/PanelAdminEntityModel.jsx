import { useState } from "react";

import { useSelector } from "react-redux";

import useEntityModel from "../hooks/useEntityModel";
import useUpdateEntityModel from "../hooks/useUpdateEntityModel";
import useDeleteEntityModel from "../hooks/useDeleteEntityModel";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FormEntityModel from "./FormEntityModel";

export default function PanelAdminEntityModel() {
  // data

  const selectedKey = useSelector(
    (s) => s.adminEditor.selectedEntityModelKey
  );
  const model = useEntityModel(selectedKey);
  const updateModel = useUpdateEntityModel();
  const deleteModel = useDeleteEntityModel();

  // state

  const [editedModel, setEditedModel] = useState(null);

  // helpers

  const isEditing = editedModel !== null;
  const currentModel = isEditing ? editedModel : model;

  // handlers

  function handleChange(updated) {
    setEditedModel(updated);
  }

  async function handleSave() {
    if (!editedModel) return;
    await updateModel(editedModel);
    setEditedModel(null);
  }

  async function handleDelete() {
    if (!model?.id) return;
    await deleteModel(model.id);
    setEditedModel(null);
  }

  if (!model) return null;

  // render

  return (
    <BoxFlexVStretch>
      <FormEntityModel model={currentModel} onChange={handleChange} />
      <ButtonInPanelV2
        label="Save"
        onClick={handleSave}
        disabled={!isEditing || model?.readonly}
        variant="contained"
      />
      <ButtonInPanelV2
        label="Delete"
        onClick={handleDelete}
        disabled={model?.readonly}
        variant="outlined"
        color="error"
      />
    </BoxFlexVStretch>
  );
}
