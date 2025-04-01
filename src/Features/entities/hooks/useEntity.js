import {useSelector} from "react-redux";

import useEntityModel from "./useEntityModel";
import useSelectedEntity from "./useSelectedEntity";
import useNewEntity from "./useNewEntity";

export default function useEntity() {
  // data

  const {value: selectedEntity} = useSelectedEntity();

  const newEntity = useNewEntity();
  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);
  const editedEntity = useSelector((s) => s.entities.editedEntity);

  const entityModel = useEntityModel();

  // helpers

  let entity = selectedEntity;

  // helpers

  const label = entity ? entity[entityModel?.labelKey] : "-";

  // helpers - entity

  if (!entity?.id) {
    entity = {
      ...newEntity,
      label: entityModel?.strings?.labelNew,
    };
  } else if (isEditingEntity) {
    entity = {...editedEntity, label};
  } else {
    entity = {...entity, label};
  }

  return entity;
}
