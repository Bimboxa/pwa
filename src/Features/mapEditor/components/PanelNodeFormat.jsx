import { useSelector } from "react-redux";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import SectionCreateAnnotation from "Features/annotations/components/SectionCreateAnnotation";
import SectionEditAnnotation from "Features/annotations/components/SectionEditAnnotation";
import PanelFormatBgImage from "Features/bgImage/components/PanelFormatBgImage";
import PanelFormatBaseMap from "Features/baseMaps/components/PanelFormatMainBaseMap";

export default function PanelNodeFormat() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);

  console.log("[PanelNodeFormat] selectedNode", selectedNode);

  // helpers

  const nodeType = selectedNode?.nodeType;

  // helpers

  const showCreate = Boolean(enabledDrawingMode);

  // helpers - format

  let format = "BG_IMAGE";
  if (showCreate) {
    format = "CREATE_ANNOTATION";
  } else if (nodeType === "BASE_MAP") {
    format = "BASE_MAP";
  } else if (nodeType === "ANNOTATION") {
    format = "EDIT_ANNOTATION";
  }

  console.log("debug_2509", format);

  return (
    <BoxFlexVStretch>
      {format === "BG_IMAGE" && <PanelFormatBgImage />}
      {format === "CREATE_ANNOTATION" && <SectionCreateAnnotation />}
      {format === "EDIT_ANNOTATION" && <SectionEditAnnotation />}
      {format === "BASE_MAP" && <PanelFormatBaseMap />}
    </BoxFlexVStretch>
  );
}
