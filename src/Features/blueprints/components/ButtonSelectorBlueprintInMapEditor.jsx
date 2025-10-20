import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";

import { setBlueprintIdInMapEditor } from "../blueprintsSlice";

import useBlueprintInMapEditor from "../hooks/useBlueprintInMapEditor";
import useBlueprints from "../hooks/useBlueprints";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import PanelSelectorBlueprint from "./PanelSelectorBlueprint";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import { ArrowDropDown } from "@mui/icons-material";

export default function ButtonSelectorBlueprintInMapEditor({ onCreateClick }) {
  const dispatch = useDispatch();

  // data

  const blueprint = useBlueprintInMapEditor();
  const blueprints = useBlueprints();

  // state

  const [open, setOpen] = useState(false);

  // helpers

  const label = blueprint ? blueprint.name : "Sélectionnez un export";

  // handlers

  function handleClick() {
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  function handleSelect(id) {
    console.log("debug_2010_handleSelect", id);
    dispatch(setBlueprintIdInMapEditor(id));
    setOpen(false);
  }

  function handleCreateClick() {
    onCreateClick();
  }

  return (
    <>
      <ButtonGeneric
        label={label}
        onClick={handleClick}
        endIcon={<ArrowDropDown />}
      />
      <DialogGeneric open={open} onClose={handleClose} width="350px">
        <PanelSelectorBlueprint
          blueprints={blueprints}
          selectedBlueprintId={blueprint?.id}
          onChange={handleSelect}
          onCreateClick={handleCreateClick}
          onClose={handleClose}
        />
      </DialogGeneric>
    </>
  );
}
