import {useDispatch, useSelector} from "react-redux";

import useEntities from "../hooks/useEntities";

import ListEntities from "./ListEntities";

import {Box} from "@mui/material";
import {setSelectedEntityId} from "../entitiesSlice";

export default function SectionListEntitiesInListPanel() {
  const dispatch = useDispatch();

  // data

  const {value: entities, loading} = useEntities();
  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  // helpers

  const selection = selectedEntityId ? [selectedEntityId] : [];

  // handlers

  function handleClick(entity) {
    console.log("[SectionListEntitiesInListPanel] handleClick", entity);
    const id = selectedEntityId === entity.id ? null : entity.id;
    dispatch(setSelectedEntityId(id));
  }

  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      <ListEntities
        entities={entities}
        onClick={handleClick}
        selection={selection}
      />
    </Box>
  );
}
