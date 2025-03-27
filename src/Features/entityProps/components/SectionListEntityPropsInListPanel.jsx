import {useDispatch, useSelector} from "react-redux";

import {setSelection} from "../entityPropsSlice";

import useEntitiesWithProps from "../hooks/useEntitiesWithProps";

import ListEntitiesWithProps from "./ListEntitiesWithProps";

import {Box} from "@mui/material";

export default function SectionListEntityPropsInListPanel() {
  const dispatch = useDispatch();

  // data

  const selection = useSelector((s) => s.entityProps.selection);
  const multiSelect = useSelector((s) => s.entityProps.multiSelect);
  const {value: entities, loading} = useEntitiesWithProps();
  //const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  console.log("entities", entities);
  // helpers

  // handlers

  function handleClick(entity) {
    console.log("entity", entity);
    const wasSelected = selection.includes(entity.id);
    let newSelection = selection
      ? selection.filter((id) => id !== entity.id)
      : [];
    if (multiSelect) {
      newSelection = wasSelected ? newSelection : [...newSelection, entity.id];
    } else {
      newSelection = wasSelected ? [] : [entity.id];
    }
    dispatch(setSelection(newSelection));
  }

  return (
    <Box sx={{width: 1, bgcolor: "common.white"}}>
      <ListEntitiesWithProps
        items={entities}
        onClick={handleClick}
        selection={selection}
      />
    </Box>
  );
}
