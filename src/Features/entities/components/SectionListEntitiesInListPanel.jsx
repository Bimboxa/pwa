import { useDispatch, useSelector } from "react-redux";

import useEntities from "../hooks/useEntities";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useIsMobile from "Features/layout/hooks/useIsMobile";

import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";
import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedEntityId } from "../entitiesSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";

import ListEntities from "./ListEntities";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

export default function SectionListEntitiesInListPanel() {
  const dispatch = useDispatch();

  // data

  const isMobile = useIsMobile();

  const { value: listing } = useSelectedListing({ withEntityModel: true });
  const entityModel = listing?.entityModel;
  const sortBy = entityModel?.sortBy ?? listing?.sortBy;

  const { value: entities, loading } = useEntities({
    withImages: true,
    sortBy,
    withMarkers: entityModel?.type === "LOCATED_ENTITY",
    withAnnotations: entityModel?.type === "LOCATED_ENTITY",
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

    if (entity.entityModelType === "BASE_MAP" && id) {
      console.log("debug_2105 select map", entity);
      dispatch(setSelectedMainBaseMapId(entity.id));
      dispatch(setSelectedBaseMapsListingId(entity.listingId));
    }

    if (entity.annotation) {
      dispatch(setSelectedAnnotationId(entity.annotation.id));
    }

    dispatch(setSelectedEntityId(id));
  }

  function handleCreateClick() {
    dispatch(setOpenPanelListItem(true));
    dispatch(setSelectedEntityId(null));
  }

  return (
    <BoxFlexVStretch>
      <ListEntities
        listing={listing}
        entities={entities}
        onClick={handleClick}
        selection={selection}
        onCreateClick={handleCreateClick}
      />
    </BoxFlexVStretch>
  );
}
