import { useSelector } from "react-redux";

import useAnnotations from "Features/annotations/hooks/useAnnotations";

import { Box, Typography } from "@mui/material";

import Toolbar from "Features/layout/components/Toolbar";
import ButtonRefreshMap from "./ButtonRefreshMap";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonDrawPolylineV2 from "./ButtonDrawPolylineV2";
import ButtonAutoSegmentation from "./ButtonAutoSegmentation";
import ButtonDrawFreeline from "./ButtonDrawFreeline";
import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonAddText from "./ButtonAddText";
import ButtonDownloadBaseMapView from "./ButtonDownloadBaseMapView";
import SelectorAnnotationTemplateInMapEditor from "./SelectorAnnotationTemplateInMapEditor";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";
import useSelectedAnnotationTemplateInMapEditor from "../hooks/useSelectedAnnotationTemplateInMapEditor";

export default function ToolbarMapEditorLocatedEntities() {
  // strings

  const addS = "Ajoutez une annotation";

  // data

  const selectedNode = useSelector((s) => s.mapEditor.selectedNode);
  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );
  const annotationTemplate = useSelectedAnnotationTemplateInMapEditor();

  // helpers - annotation types

  const { type } = annotationTemplate ?? {};
  const annotationTypes = type
    ? [type]
    : ["MARKER", "POLYLINE", "RECTANGLE", "TEXT"];

  // helpers

  const noAnnotation = !annotations?.length > 0;

  // helpers - buttonsMap

  const ToolButton = ({ type }) => {
    switch (type) {
      case "MARKER":
        return <ButtonDrawMarker />;
      case "TEXT":
        return <ButtonAddText />;
      case "POLYLINE":
        return <ButtonDrawPolylineV2 />;
      case "RECTANGLE":
        return <Rectangle />;
    }
  };

  // component

  const MainToolbar = () => (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <SelectorAnnotationTemplateInMapEditor />

      <Toolbar sx={{ ml: 1 }}>
        {annotationTypes.map((type) => (
          <ToolButton key={type} type={type} />
        ))}
      </Toolbar>
    </Box>
  );

  // render

  return null;

  if (noAnnotation)
    return (
      <Box
        sx={{
          bgcolor: "secondary.main",
          p: 1,
          borderRadius: "4px",
          color: "white",
          display: "flex",
          visibility: selectedNode ? "hidden" : "visible",
          flexDirection: "column",
        }}
      >
        <Typography sx={{ pb: 1 }}>{addS}</Typography>
        <MainToolbar />
      </Box>
    );

  return (
    <Box
      sx={{
        display: "flex",
        visibility: selectedNode ? "hidden" : "visible",
      }}
    >
      <MainToolbar />
    </Box>
  );
}
