import { useSelector } from "react-redux";

import useBaseMap from "Features/baseMaps/hooks/useBaseMap";

import BaseMap from "Features/baseMaps/js/BaseMap";

export default function useMainBaseMap() {
  const id = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const editedEntity = useSelector((s) => s.entities.editedEntity);
  const isEditingEntity = useSelector((s) => s.entities.isEditingEntity);

  const mainBaseMap = useBaseMap({ id });

  if (isEditingEntity && editedEntity?.entityModelType === "BASE_MAP") {
    return new BaseMap({ ...editedEntity });
  } else {
    return mainBaseMap;
  }
}
