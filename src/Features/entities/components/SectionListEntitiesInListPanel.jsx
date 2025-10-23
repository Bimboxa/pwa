import { useDispatch, useSelector } from "react-redux";

import useEntities from "../hooks/useEntities";
import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useIsMobile from "Features/layout/hooks/useIsMobile";
import useOnEntityClick from "../hooks/useOnEntityClick";

import { setOpenPanelListItem } from "Features/listPanel/listPanelSlice";
import {
  setSelectedBaseMapsListingId,
  setSelectedMainBaseMapId,
  setSelectedNode,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedEntityId } from "../entitiesSlice";
import { setSelectedAnnotationId } from "Features/annotations/annotationsSlice";
import { setOpenedPanel } from "Features/listings/listingsSlice";
import { setSelectedItem } from "Features/selection/selectionSlice";

import ListEntities from "./ListEntities";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SectionActions from "./SectionActions";
import SelectorAnnotationTemplate from "Features/annotations/components/SelectorAnnotationTemplate";

export default function SectionListEntitiesInListPanel() {
  const dispatch = useDispatch();

  // data

  const isMobile = useIsMobile();

  const { value: listing } = useSelectedListing({ withEntityModel: true });
  const entityModel = listing?.entityModel;
  const sortBy = entityModel?.sortBy ?? listing?.sortBy;
  const filterByMainBaseMap = useSelector(
    (s) => s.mapEditor.filterByMainBaseMap
  );

  const { value: entities, loading } = useEntities({
    withImages: true,
    sortBy,
    withMarkers: entityModel?.type === "LOCATED_ENTITY",
    withAnnotations: entityModel?.type === "LOCATED_ENTITY",
    filterByMainBaseMap: entityModel?.type === "LOCATED_ENTITY",
  });
  const selectedEntityId = useSelector((s) => s.entities.selectedEntityId);

  const onEntityClick = useOnEntityClick();

  // debug

  console.log("debug_1509 entities", entities, listing?.id);

  // helpers

  const selection = selectedEntityId ? [selectedEntityId] : [];

  // helpers - variant

  let variant = "DEFAULT";

  if (listing?.entityModel?.type === "ANNOTATION_TEMPLATE")
    variant = "ANNOTATION_TEMPLATES";

  // handlers

  function handleClick(entity) {
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
      //dispatch(setSelectedAnnotationId(entity.annotation.id));
      dispatch(
        setSelectedNode({
          id: entity.annotation.id,
          nodeType: "ANNOTATION",
          annotationType: entity.annotation.type,
        })
      );
    }

    dispatch(setSelectedEntityId(id));

    onEntityClick(entity);
    //dispatch(setOpenedPanel("EDITED_ENTITY"));
  }

  function handleCreateClick() {
    //dispatch(setOpenPanelListItem(true));
    dispatch(setSelectedEntityId(null));
    dispatch(setOpenedPanel("NEW_ENTITY"));
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
