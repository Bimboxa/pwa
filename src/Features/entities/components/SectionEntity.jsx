import { useRef } from "react";
import { useDispatch } from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
} from "../entitiesSlice";

import useEntity from "../hooks/useEntity";

import useEntityFormTemplate from "../hooks/useEntityFormTemplate";

import { Box, Typography } from "@mui/material";

import FormEntity from "./FormEntity";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BlockBottomActionsInPanel from "./BlockBottomActionsInPanel";
import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";

export default function SectionEntity() {
  const dispatch = useDispatch();
  const containerRef = useRef(null);

  // data

  const entity = useEntity();
  console.log("[SectionEntity] entity", entity);

  const template = useEntityFormTemplate();

  // helper

  const caption = `Créé par ${entity.createdBy}`;

  // handlers

  function handleEntityChange(entity) {
    console.log("entityChanged", entity);
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
      ref={containerRef}
      sx={{
        width: 1,
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
      }}
    >
      {entity?.createdBy && (
        <Typography
          sx={{ p: 1 }}
          variant="caption"
          color="text.secondary"
          noWrap
        >
          {caption}
        </Typography>
      )}
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
            sectionContainerEl={containerRef?.current}
          />
        </Box>
      </Box>

      <BlockBottomActionsInPanel onSaved={handleSaved} />
    </Box>
  );
}
