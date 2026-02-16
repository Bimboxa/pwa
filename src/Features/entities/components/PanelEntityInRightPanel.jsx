import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setIsEditingEntity, setEditedEntity } from "../entitiesSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";

import useEntity from "../hooks/useEntity";

import useUpdateEntity from "../hooks/useUpdateEntity";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import useEntityFormTemplate from "../hooks/useEntityFormTemplate";
import FormGenericV2 from "Features/form/components/FormGenericV2";
import ButtonInPanelV2 from "Features/layout/components/ButtonInPanelV2";
import SectionEntityAnnotationInRightPanel from "./SectionEntityAnnotationInRightPanel";
import SectionEditAnnotation from "Features/annotations/components/SectionEditAnnotation";

export default function PanelEntityInRightPanel({ selectedItem }) {
  const dispatch = useDispatch();

  // strings

  const saveS = "Enregistrer";

  // data

  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  const entity = useEntity({
    fromListingId: selectedItem?.listingId,
    entityId: selectedItem?.entityId,
    withImages: true,
    withAnnotations: true,
  });

  const template = useEntityFormTemplate({
    listingId: selectedItem?.listingId,
  });

  // state

  const [openAnnotation, setOpenAnnotation] = useState(false);

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

  function handleAnnotationEditClick(annotation) {
    dispatch(setSelectedAnnotationId(annotation.id));
    setOpenAnnotation(true);
  }

  if (openAnnotation) {
    return <SectionEditAnnotation onClose={() => setOpenAnnotation(false)} />;
  }

  return (
    <BoxFlexVStretch>
      <SectionEntityAnnotationInRightPanel
        entity={entity}
        onEditClick={handleAnnotationEditClick}
      />
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
