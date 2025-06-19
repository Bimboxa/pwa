import {useRef, useState} from "react";
import {createPortal} from "react-dom";

import {useDispatch} from "react-redux";

import {triggerEntityTemplateUpdate} from "Features/entities/entitiesSlice";

import {Box} from "@mui/material";

import Panel from "Features/layout/components/Panel";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import PanelAddZone from "./PanelAddZone";
import SelectorVariantTree from "Features/tree/components/SelectorVariantTree";

export default function PanelSelectorZone({
  zonesTree,
  zonesListing,
  selection,
  onSelectionChange,
  onClose,
  multiSelect,
}) {
  const dispatch = useDispatch();
  const containerRef = useRef();

  // strings

  const title = "Sélectionnez une pièce";

  // state

  const [openCreate, setOpenCreate] = useState(false);
  const [tempSelection, setTempSelection] = useState(null); // used to get the context from onAddClick

  // helpers

  const color = zonesListing?.color;

  // helper - func

  const getZoneId = () => {
    if (Array.isArray(tempSelection)) {
      return tempSelection.length > 0 ? tempSelection[0] : null;
    } else {
      return tempSelection;
    }
  };
  // handlers

  function handleChange(selection) {
    onSelectionChange(selection);
  }

  function handleCreateClick({tempSelection}) {
    setOpenCreate(true);
    setTempSelection(tempSelection);
  }

  function handleZoneAdded(node) {
    console.log("add node", node);
    dispatch(triggerEntityTemplateUpdate());
    setOpenCreate(false);
    if (!multiSelect) onSelectionChange(node.id);
  }

  return (
    <Panel>
      <Box
        ref={containerRef}
        sx={{width: 1, height: 1, display: "flex", flexDirection: "column"}}
      >
        {openCreate &&
          createPortal(
            <Box
              sx={{
                position: "absolute",
                bgcolor: "white",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <PanelAddZone
                onClose={() => setOpenCreate(false)}
                zonesListing={zonesListing}
                zonesTree={zonesTree}
                selectedZoneId={getZoneId()}
                onZoneAdded={handleZoneAdded}
              />
            </Box>,
            containerRef.current
          )}
        <HeaderTitleClose title={title} onClose={onClose} />
        <SelectorVariantTree
          listing={zonesListing}
          items={zonesTree}
          selection={selection}
          onChange={handleChange}
          multiSelect={multiSelect}
          color={color}
          onCreateClick={handleCreateClick}
        />
      </Box>
    </Panel>
  );
}
