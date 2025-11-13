import { useDispatch, useSelector } from "react-redux";

import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setIsEditingEntity } from "../entitiesSlice";
import { setEditedEntity } from "../entitiesSlice";

export default function useOnEntityEdit() {
  const dispatch = useDispatch();

  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);

  const onEntityEdit = (entity) => {
    console.log("debug_2310 edit entity", entity);
    dispatch(setIsEditingEntity(true));
    dispatch(setEditedEntity(entity));
    switch (entity?.entityModelType) {
      case "BASE_MAP":
        dispatch(setOpenedPanel("EDITED_ENTITY"));
        break;

      case "MATERIAL_ENTITY":
        dispatch(setOpenedPanel("EDITED_ENTITY"));
        break;

      case "LOCATED_ENTITY":
        dispatch(setOpenedPanel("EDITED_ENTITY"));
        break;

      case "BLUEPRINT":
        dispatch(setOpenedPanel("EDITED_BLUEPRINT"));
        break;

      default:
        break;
    }
  };

  return onEntityEdit;
}
