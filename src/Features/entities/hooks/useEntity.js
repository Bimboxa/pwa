import { useSelector } from "react-redux";

import useEntityModel from "./useEntityModel";
import useSelectedEntity from "./useSelectedEntity";
import useNewEntity from "./useNewEntity";

export default function useEntity(options) {
  try {
    // data

    //const { value: selectedEntity } = useSelectedEntity({ withImages: true });
    const { value: selectedEntity } = useSelectedEntity(options);

    const newEntity = useNewEntity();
    const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);
    const editedEntity = useSelector((s) => s.entities.editedEntity);

    const entityModel = useEntityModel();

    // helpers

    let entity = selectedEntity ?? null;

    // helpers

    let label;

    // helpers - entity

    if (!entity?.id) {
      entity = {
        ...newEntity,
        //label: newEntity.label ?? entityModel?.strings?.labelNew, // we don't want to override the label key if it exists when creating a new entity.
      };
    } else if (isEditingEntity) {
      label = editedEntity?.[entityModel?.labelKey];
      entity = { ...editedEntity, label, entityModel };
    } else {
      label = entity[entityModel?.labelKey];
      entity = { ...entity, label, entityModel };
    }

    //console.log("debug_1509 [useEntity] entity", entity);

    return entity;
  } catch (error) {
    console.log("error", error);
  }
}
