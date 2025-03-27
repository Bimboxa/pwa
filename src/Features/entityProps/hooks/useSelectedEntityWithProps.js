import {useSelector} from "react-redux";

import useEntitiesWithProps from "./useEntitiesWithProps";

export default function useSelectedEntityWithProps() {
  const selection = useSelector((s) => s.entityProps.selection);
  const selectedId = selection?.length > 0 ? selection[0] : null;

  const {value: entitiesWithProps} = useEntitiesWithProps();

  const selectedEntity = entitiesWithProps?.find(
    (entity) => entity.id === selectedId
  );

  return selectedEntity;
}
