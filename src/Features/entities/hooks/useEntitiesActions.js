import { useSelector, useDispatch } from "react-redux";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import {
  setIsEditingEntity,
  setEditedEntity,
  setOpenDialogDeleteEntity,
} from "../entitiesSlice";

import { Edit, Delete } from "@mui/icons-material";
import useSelectedEntity from "./useSelectedEntity";

export default function useEntitiesActions() {
  const dispatch = useDispatch();

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);
  const { value: selectedEntity } = useSelectedEntity({ withImage: true });

  // main

  const actions = [
    {
      label: "Modifier",
      icon: Edit,
      handler: () => {
        dispatch(setIsEditingEntity(true));
        dispatch(setEditedEntity(selectedEntity));
        dispatch(setOpenedPanel("EDITED_ENTITY"));
      },
      disabled: !selectedEntityId,
    },
    {
      label: "Supprimer",
      icon: Delete,
      handler: () => {
        dispatch(setOpenDialogDeleteEntity(true));
      },
      disabled: !selectedEntityId,
    },
  ];

  return actions;
}
