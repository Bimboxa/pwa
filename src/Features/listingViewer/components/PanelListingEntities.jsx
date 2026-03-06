import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import { setSelectedItem, selectSelectedItem } from "Features/selection/selectionSlice";

import useEntities from "Features/entities/hooks/useEntities";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useOnEntityClick from "Features/entities/hooks/useOnEntityClick";

import { Box, List } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import ListItemEntitySimple from "./ListItemEntitySimple";
import DialogCreateEntity from "./DialogCreateEntity";

import getFoundItems from "Features/search/getFoundItems";

export default function PanelListingEntities({ listing }) {
  const dispatch = useDispatch();

  // state

  const [searchText, setSearchText] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  // data

  const { value: selectedListing } = useSelectedListing();
  const activeListing = listing ?? selectedListing;

  const entityModel = activeListing?.entityModel;
  const sortBy = entityModel?.sortBy ?? activeListing?.sortBy;

  const { value: entities } = useEntities({
    withImages: true,
    sortBy,
    withComputedFields: true,
  });

  const selectedItem = useSelector(selectSelectedItem);
  const selectedEntityId = selectedItem?.entityId;

  const onEntityClick = useOnEntityClick();

  // helpers

  const filteredEntities = getFoundItems({
    items: entities,
    searchText,
    searchKeys: ["label", "name", "sublabel", "num"],
  });

  const selection = selectedEntityId ? [selectedEntityId] : [];
  const color = activeListing?.color;

  // handlers

  function handleSearchTextChange(text) {
    setSearchText(text);
  }

  function handleEntityClick(entity) {
    const id = selectedEntityId === entity.id ? null : entity.id;
    dispatch(setSelectedEntityId(id));
    dispatch(
      setSelectedItem({
        type: "ENTITY",
        entityId: id,
        listingId: entity?.listingId,
      })
    );
    onEntityClick(entity);
  }

  function handleCreateClick() {
    setOpenCreateDialog(true);
  }

  function handleCreateDialogClose() {
    setOpenCreateDialog(false);
  }

  function handleEntityCreated() {
    setOpenCreateDialog(false);
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ width: 1, p: 1, pt: 2 }}>
        <SearchBar
          value={searchText}
          onChange={handleSearchTextChange}
          onCreateClick={handleCreateClick}
          color={color}
        />
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <List dense disablePadding sx={{ bgcolor: "white", width: 1 }}>
          {filteredEntities?.map((entity) => (
            <ListItemEntitySimple
              key={entity.id}
              entity={entity}
              onClick={handleEntityClick}
              selected={selection.includes(entity.id)}
              listingColor={color}
            />
          ))}
        </List>
      </BoxFlexVStretch>

      <DialogCreateEntity
        open={openCreateDialog}
        listing={activeListing}
        onClose={handleCreateDialogClose}
        onEntityCreated={handleEntityCreated}
      />
    </BoxFlexVStretch>
  );
}
