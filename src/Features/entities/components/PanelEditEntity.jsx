import { useRef } from "react";
import { useDispatch } from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
} from "../entitiesSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";

import useEntity from "../hooks/useEntity";

import useEntityFormTemplate from "../hooks/useEntityFormTemplate";

import { Box, Typography } from "@mui/material";

import FormEntity from "./FormEntity";
import IconButtonClose from "Features/layout/components/IconButtonClose";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BlockBottomActionsInPanel from "./BlockBottomActionsInPanel";
import BlockEntityInPanel from "./BlockEntityInPanel";
import HeaderEntityInPanel from "./HeaderEntityInPanel";

export default function PanelEditEntity() {
  const dispatch = useDispatch();
  const selectorContainerRef = useRef(null);

  // data

  const entity = useEntity();

  const template = useEntityFormTemplate();
  console.log("debug_1011_entity", entity, template);

  // helper

  const caption = `Créé par ${entity.createdBy}`;

  // helper - showCloseButton

  const showCloseButton = entity?.id ? true : false;

  // handlers

  function handleEntityChange(entity) {
    console.log("entityChange", entity);
    if (!entity.id) {
      dispatch(setNewEntity(entity));
    } else {
      dispatch(setEditedEntity(entity));
      dispatch(setIsEditingEntity(true));
    }
  }

  function handleSaved() {
    dispatch(setOpenedPanel("LISTING"));
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
        position: "relative",
      }}
    >
      <HeaderEntityInPanel showCloseButton={showCloseButton} />

      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <Box sx={{ bgcolor: "white" }}>
          <FormEntity
            template={template}
            entity={entity}
            onEntityChange={handleEntityChange}
            sectionContainerEl={selectorContainerRef?.current}
          />
        </Box>
      </Box>

      <BlockBottomActionsInPanel onSaved={handleSaved} />
    </Box>
  );
}
