import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListPanelCreateItemBorder from "./ListPanelCreateItemBorder";
import SectionCreateMarker from "Features/markers/components/SectionCreateMarker";
import SectionCreateLocatedEntityInListPanel from "Features/locatedEntities/components/SectionCreateLocatedEntityInListPanel";
import SectionCreateBaseMapViewInListPanel from "Features/baseMapViews/components/SectionCreateBaseMapViewInListPanel";

export default function ListPanelCreateItem() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const isCreatingBaseMapView = useSelector(
    (s) => s.baseMapViews.isCreatingBaseMapView
  );

  // helper

  const showLocatedEntity = Boolean(enabledDrawingMode);
  const showBaseMapView = isCreatingBaseMapView && !showLocatedEntity;

  return (
    <BoxFlexVStretch>
      <ListPanelCreateItemBorder>
        <BoxFlexVStretch>
          {showBaseMapView && <SectionCreateBaseMapViewInListPanel />}
          {showLocatedEntity && <SectionCreateLocatedEntityInListPanel />}
        </BoxFlexVStretch>
      </ListPanelCreateItemBorder>
    </BoxFlexVStretch>
  );
}
