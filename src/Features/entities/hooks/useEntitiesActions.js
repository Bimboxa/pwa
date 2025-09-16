import { useSelector, useDispatch } from "react-redux";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import {
  setIsEditingEntity,
  setOpenDialogDeleteEntity,
} from "../entitiesSlice";

import { Edit, Delete } from "@mui/icons-material";

export default function useEntitiesActions() {
  const dispatch = useDispatch();

  // data

  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  // main

  const actions = [
    {
      label: "Modifier",
      icon: Edit,
      handler: () => {
        dispatch(setIsEditingEntity(true));
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
