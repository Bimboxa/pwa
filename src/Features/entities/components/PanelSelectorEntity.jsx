import {useState} from "react";

import {useDispatch} from "react-redux";

import {triggerEntityTemplateUpdate} from "../entitiesSlice";

import {Box} from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import ListEntities from "./ListEntities";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ListItemButtonCreate from "Features/layout/components/ListItemButtonCreate";
import PanelCreateListingEntity from "./PanelCreateListingEntity";

export default function PanelSelectorEntity({
  title,
  entities,
  entitiesListing,
  selectedEntityId,
  onSelectionChange,
  onClose,
}) {
  const dispatch = useDispatch();

  // state

  const [openCreate, setOpenCreate] = useState(false);

  // helpers

  const selection = selectedEntityId ? [selectedEntityId] : [];

  // handlers

  function handleClick(entity) {
    const id = selectedEntityId === entity.id ? null : entity.id;
    onSelectionChange(id);
  }

  function handleCreateClick() {
    console.log("create");
    setOpenCreate(true);
  }

  function handleCloseCreate() {
    setOpenCreate(false);
  }

  function handleEntityCreated(entity) {
    dispatch(triggerEntityTemplateUpdate());
    onSelectionChange(entity.id);
    setOpenCreate(false);
  }

  // render

  if (!openCreate)
    return (
      <BoxFlexVStretch>
        {title && <HeaderTitleClose title={title} onClose={onClose} />}
        <Box sx={{bgcolor: "white"}}>
          <ListEntities
            entities={entities}
            selection={selection}
            onClick={handleClick}
          />
          <ListItemButtonCreate onClick={handleCreateClick} />
        </Box>
      </BoxFlexVStretch>
    );

  if (openCreate)
    return (
      <PanelCreateListingEntity
        onClose={handleCloseCreate}
        listing={entitiesListing}
        onEntityCreated={handleEntityCreated}
      />
    );
}
