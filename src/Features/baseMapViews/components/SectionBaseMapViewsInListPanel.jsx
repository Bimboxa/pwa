import { useSelector, useDispatch } from "react-redux";

import { setSelectedBaseMapViewId } from "../baseMapViewsSlice";

import useBaseMapViews from "../hooks/useBaseMapViews";
import useBaseMapView from "../hooks/useBaseMapView";

import ListPanelGeneric from "Features/listPanel/components/ListPanelGeneric";
import ListItemBaseMapView from "./ListItemBaseMapView";
import SectionBaseMapViewInListPanel from "./SectionBaseMapViewInListPanel";

export default function SectionBaseMapViewsInListPanel() {
  const dispatch = useDispatch();

  // data

  const views = useBaseMapViews();
  const selectedId = useSelector((s) => s.baseMapViews.selectedBaseMapViewId);
  const selectedBaseMapView = useBaseMapView({ id: selectedId });

  // helpers

  const selection = selectedId ? [selectedId] : [];

  // handlers

  function onItemClick(view) {
    console.log("view", view);
    dispatch(setSelectedBaseMapViewId(view.id));
  }

  function handleCloseSelection() {
    dispatch(setSelectedBaseMapViewId(null));
  }

  if (selectedId)
    return (
      <SectionBaseMapViewInListPanel
        item={selectedBaseMapView}
        onClose={() => handleCloseSelection}
      />
    );

  return (
    <ListPanelGeneric
      title="Plans"
      items={views}
      onItemClick={onItemClick}
      selection={selection}
      componentListItem={ListItemBaseMapView}
      componentSelectedItem={SectionBaseMapViewInListPanel}
    />
  );
}
