import {useDispatch} from "react-redux";

import {
  setNewEntity,
  setEditedEntity,
  setIsEditingEntity,
} from "../entitiesSlice";

import useEntity from "../hooks/useEntity";
import useEntityFormTemplate from "../hooks/useEntityFormTemplate";

import {Box} from "@mui/material";

import FormEntity from "./FormEntity";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import BlockBottomActionsInListPanel from "./BlockBottomActionsInListPanel";
import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

export default function SectionEntity() {
  const dispatch = useDispatch();
  // data

  const entity = useEntity();
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
    <BoxFlexVStretch>
      <Box sx={{flexGrow: 1}}>
        <FormEntity
          template={template}
          entity={entity}
          onEntityChange={handleEntityChange}
        />
      </Box>

      <BlockBottomActionsInListPanel onSaved={handleSaved} />
    </BoxFlexVStretch>
  );
}
