import { useSelector, useDispatch } from "react-redux";

import {
  setEditedBaseMapView,
  setIsCreatingBaseMapView,
  setIsEditingBaseMapView,
  setSelectedBaseMapViewId,
} from "../baseMapViewsSlice";

import useBaseMapViews from "../hooks/useBaseMapViews";
import useBaseMapView from "../hooks/useBaseMapView";

import ListPanelGeneric from "Features/listPanel/components/ListPanelGeneric";
import ListItemBaseMapView from "./ListItemBaseMapView";
import SectionBaseMapViewInListPanel from "./SectionBaseMapViewInListPanel";
import SectionEditBaseMapViewInListPanel from "./SectionEditBaseMapViewInListPanel";

export default function SectionBaseMapViewsInListPanel() {
  const dispatch = useDispatch();

  // data

  const views = useBaseMapViews();
  const selectedId = useSelector((s) => s.baseMapViews.selectedBaseMapViewId);
  const selectedBaseMapView = useBaseMapView({ id: selectedId });
  const isCreating = useSelector((s) => s.baseMapViews.isCreatingBaseMapView);
  const isEditing = useSelector((s) => s.baseMapViews.isEditingBaseMapView);

  // helpers

  const selection = selectedId ? [selectedId] : [];

  // handlers

  function onItemClick(view) {
    console.log("view", view);
    dispatch(setSelectedBaseMapViewId(view.id));
  }

  function handleEditClick(view) {
    dispatch(setSelectedBaseMapViewId(view.id));
    dispatch(setIsEditingBaseMapView(true));
    dispatch(setEditedBaseMapView(view));
  }

  function handleCloseSelection() {
    dispatch(setSelectedBaseMapViewId(null));
  }

  function handleCreateClick() {
    console.log("create new base map view");
    dispatch(setIsCreatingBaseMapView(true));
  }

  if (selectedId) {
    if (isEditing) {
      return <SectionEditBaseMapViewInListPanel />;
    } else {
      return (
        <SectionBaseMapViewInListPanel
          item={selectedBaseMapView}
          onClose={() => handleCloseSelection()}
        />
      );
    }
  }

  return (
    <ListPanelGeneric
      title="Plans"
      items={views}
      onItemClick={handleEditClick}
      onCreateClick={handleCreateClick}
      selection={selection}
      componentListItem={ListItemBaseMapView}
    />
  );
}
