import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionCreateAnnotation from "./SectionCreateAnnotation";
import SectionEditAnnotation from "./SectionEditAnnotation";

export default function PanelAnnotationFormat() {
  // data

  const id = useSelector((s) => s.annotations.selectedAnnotationId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const showCreate = !Boolean(id) && Boolean(enabledDrawingMode);
  const showEdit = Boolean(id);

  return (
    <BoxFlexVStretch>
      {showCreate && <SectionCreateAnnotation />}
      {showEdit && <SectionEditAnnotation />}
    </BoxFlexVStretch>
  );
}
