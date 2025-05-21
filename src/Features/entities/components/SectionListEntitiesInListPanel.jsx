import {useDispatch, useSelector} from "react-redux";

import useEntities from "../hooks/useEntities";

import ListEntities from "./ListEntities";

import {Box} from "@mui/material";
import {setSelectedEntityId} from "../entitiesSlice";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useIsMobile from "Features/layout/hooks/useIsMobile";
import {setOpenPanelListItem} from "Features/listPanel/listPanelSlice";

import {setSelectedMapId} from "Features/maps/mapsSlice";

export default function SectionListEntitiesInListPanel() {
  const dispatch = useDispatch();

  // data

  const isMobile = useIsMobile();

  const {value: listing} = useSelectedListing({withEntityModel: true});
  const entityModel = listing?.entityModel;
  const sortBy = entityModel?.sortBy ?? listing?.sortBy;

  const {value: entities, loading} = useEntities({
    withImages: true,
    sortBy,
    withMarkers: entityModel?.type === "LOCATED_ENTITY",
  });
  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  // debug

  // helpers

  const selection = selectedEntityId ? [selectedEntityId] : [];

  // handlers

  function handleClick(entity) {
    console.log("[SectionListEntitiesInListPanel] handleClick", entity);
    let id = selectedEntityId === entity.id ? null : entity.id;

    if (isMobile) {
      id = entity.id;
      dispatch(setOpenPanelListItem(true));
    }

    if (entity.entityModelType === "MAP" && id) {
      console.log("debug_2105 select map", entity);
      dispatch(setSelectedMapId(entity.id));
    }

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
