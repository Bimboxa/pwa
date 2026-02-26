import { useDispatch, useSelector } from "react-redux";
import {
  setIsEditingEntity,
  setEditedEntity,
} from "Features/entities/entitiesSlice";

import useEntity from "Features/entities/hooks/useEntity";
import useEntityFormTemplate from "Features/entities/hooks/useEntityFormTemplate";
import useUpdateEntity from "Features/entities/hooks/useUpdateEntity";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import FormGenericV2 from "Features/form/components/FormGenericV2";

export default function PanelAdminEntity() {
  const dispatch = useDispatch();

  // data

  const selectedListingId = useSelector(
    (s) => s.adminEditor.selectedListingId
  );
  const selectedEntityId = useSelector(
    (s) => s.adminEditor.selectedEntityId
  );
  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  const entity = useEntity({
    fromListingId: selectedListingId,
    entityId: selectedEntityId,
  });

  const template = useEntityFormTemplate({
    listingId: selectedListingId,
  });

  const update = useUpdateEntity();

  // handlers

  function handleItemChange(newItem) {
    dispatch(setIsEditingEntity(true));
    dispatch(setEditedEntity(newItem));
  }

  async function handleSave() {
    if (!entity?.id) return;
    await update(entity.id, entity, { updateSyncFile: true });
    dispatch(setIsEditingEntity(false));
    dispatch(setEditedEntity(null));
  }

  if (!entity) return null;

  // render

  return (
    <BoxFlexVStretch>
      <FormGenericV2
        template={template}
        item={entity}
        onItemChange={handleItemChange}
      />
      <ButtonInPanelV2
        label="Save"
        onClick={handleSave}
        disabled={!isEditingEntity}
        variant="contained"
      />
    </BoxFlexVStretch>
  );
}
