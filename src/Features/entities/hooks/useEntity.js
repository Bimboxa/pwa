import {useSelector} from "react-redux";

import useEntityModel from "./useEntityModel";
import useSelectedEntity from "./useSelectedEntity";
import useNewEntity from "./useNewEntity";

export default function useEntity() {
  // data

  const {value: selectedEntity} = useSelectedEntity({withImages: true});

  const newEntity = useNewEntity();
  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);
  const editedEntity = useSelector((s) => s.entities.editedEntity);

  const entityModel = useEntityModel();

  // helpers

  let entity = selectedEntity;

  // helpers

  let label;

  // helpers - entity

  if (!entity?.id) {
    entity = {
      ...newEntity,
      label: newEntity.label ?? entityModel?.strings?.labelNew,
    };
  } else if (isEditingEntity) {
    label = editedEntity[entityModel?.labelKey];
    entity = {...editedEntity, label};
  } else {
    label = entity[entityModel?.labelKey];
    entity = {...entity, label};
  }

  return entity;
}
