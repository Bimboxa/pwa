import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionCreateAnnotation from "./SectionCreateAnnotation";
import SectionEditAnnotation from "./SectionEditAnnotation";
import PanelFormatBgImage from "Features/bgImage/components/PanelFormatBgImage";
import PanelFormatBaseMap from "Features/baseMaps/components/PanelFormatMainBaseMap";

export default function PanelAnnotationFormat() {
  // data

  const id = useSelector((s) => s.annotations.selectedAnnotationId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const mainBaseMapIsSelected = useSelector(
    (s) => s.mapEditor.mainBaseMapIsSelected
  );

  // helpers

  const showCreate = !Boolean(id) && Boolean(enabledDrawingMode);
  const showEdit = Boolean(id);
  const showBgImageFormat = !Boolean(id) && !Boolean(enabledDrawingMode);

  // helpers - format

  let format = "BG_IMAGE";
  if (mainBaseMapIsSelected) {
    format = "MAIN_BASE_MAP";
  } else if (showCreate) {
    format = "CREATE_ANNOTATION";
  } else if (showEdit) {
    format = "EDIT_ANNOTATION";
  }
  return (
    <BoxFlexVStretch>
      {format === "BG_IMAGE" && <PanelFormatBgImage />}
      {format === "CREATE_ANNOTATION" && <SectionCreateAnnotation />}
      {format === "EDIT_ANNOTATION" && <SectionEditAnnotation />}
      {format === "MAIN_BASE_MAP" && <PanelFormatBaseMap />}
    </BoxFlexVStretch>
  );
}
