import {useRef} from "react";
import {useDispatch} from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
} from "../entitiesSlice";

import useEntity from "../hooks/useEntity";

import useEntityFormTemplate from "../hooks/useEntityFormTemplate";

import {Box, Paper} from "@mui/material";

import FormEntity from "./FormEntity";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BlockBottomActionsInListPanel from "./BlockBottomActionsInListPanel";
import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

export default function SectionEntity() {
  const dispatch = useDispatch();
  const selectorContainerRef = useRef(null);

  // data

  const entity = useEntity();
  console.log("[SectionEntity] entity", entity);

  const template = useEntityFormTemplate();

  // handlers

  function handleEntityChange(entity) {
    if (!entity.id) {
      dispatch(setNewEntity(entity));
    } else {
      dispatch(setEditedEntity(entity));
      dispatch(setIsEditingEntity(true));
    }
  }

  function handleSaved() {
    dispatch(setOpenPanelListItem(false));
  }

  return (
    <Box
      ref={selectorContainerRef}
      sx={{
        width: 1,
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <FormEntity
          template={template}
          entity={entity}
          onEntityChange={handleEntityChange}
          selectorContainerRef={selectorContainerRef}
        />
      </Box>

      <BlockBottomActionsInListPanel onSaved={handleSaved} />
    </Box>
  );
}
