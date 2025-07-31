import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ListPanelCreateItemBorder from "./ListPanelCreateItemBorder";
import SectionCreateMarkerInListPanel from "Features/markers/components/SectionCreateMarkerInListPanel";
import SectionCreateLocatedEntityInListPanel from "Features/locatedEntities/components/SectionCreateLocatedEntityInListPanel";

export default function ListPanelCreateItem() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helper

  const showLocatedEntity = Boolean(enabledDrawingMode);

  return (
    <BoxFlexVStretch>
      <ListPanelCreateItemBorder>
        <BoxFlexVStretch>
          <SectionCreateLocatedEntityInListPanel />
        </BoxFlexVStretch>
      </ListPanelCreateItemBorder>
    </BoxFlexVStretch>
  );
}
