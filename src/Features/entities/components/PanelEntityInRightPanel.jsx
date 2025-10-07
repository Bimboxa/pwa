import { useDispatch, useSelector } from "react-redux";

import { setIsEditingEntity, setEditedEntity } from "../entitiesSlice";

import useEntity from "../hooks/useEntity";

import useUpdateEntity from "../hooks/useUpdateEntity";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useEntityFormTemplate from "../hooks/useEntityFormTemplate";
import FormGenericV2 from "Features/form/components/FormGenericV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";

export default function PanelEntityInRightPanel({ selectedItem }) {
  const dispatch = useDispatch();

  // strings

  const saveS = "Enregistrer";

  // data

  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  const entity = useEntity({
    fromListingId: selectedItem?.listingId,
    entityId: selectedItem?.id,
    withImages: true,
  });

  const template = useEntityFormTemplate({
    listingId: selectedItem?.listingId,
  });

  // data - func
  const update = useUpdateEntity();

  // helper

  const item = { ...entity };

  // handler

  function handleItemChange(newItem) {
    dispatch(setIsEditingEntity(true));
    dispatch(setEditedEntity(newItem));
  }

  async function handleSave() {
    console.log("update entity", entity);
    await update(entity.id, entity, { updateSyncFile: true });
    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));
  }

  return (
    <BoxFlexVStretch>
      <FormGenericV2
        template={template}
        item={entity}
        onItemChange={handleItemChange}
      />
      <ButtonInPanelV2
        label={saveS}
        onClick={handleSave}
        disabled={!isEditingEntity}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
