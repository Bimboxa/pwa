import { setOpenedPanel } from "Features/listings/listingsSlice";
import { useSelector, useDispatch } from "react-redux";

import { Edit } from "@mui/icons-material";

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
        dispatch(setOpenedPanel("EDITED_ENTITY"));
      },
      disabled: !selectedEntityId,
    },
  ];

  return actions;
}
