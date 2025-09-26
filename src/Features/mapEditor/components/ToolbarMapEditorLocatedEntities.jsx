import { useSelector } from "react-redux";

import useAnnotations from "Features/annotations/hooks/useAnnotations";

import { Box, Typography } from "@mui/material";

import Toolbar from "Features/layout/components/Toolbar";
import ButtonRefreshMap from "./ButtonRefreshMap";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawPolyline from "./ButtonDrawPolyline";
import ButtonAutoSegmentation from "./ButtonAutoSegmentation";
import ButtonDrawFreeline from "./ButtonDrawFreeline";
import ButtonDrawMarker from "./ButtonDrawMarker";
import ButtonAddText from "./ButtonAddText";
import ButtonDownloadBaseMapView from "./ButtonDownloadBaseMapView";
import SelectorAnnotationTemplateInMapEditor from "./SelectorAnnotationTemplateInMapEditor";
import useSelectedAnnotationTemplateInMapEditor from "../hooks/useSelectedAnnotationTemplateInMapEditor";
import getPropsFromAnnotationTemplateId from "Features/annotations/utils/getPropsFromAnnotationTemplateId";

export default function ToolbarMapEditorLocatedEntities() {
  // strings

  const addS = "Ajoutez une annotation";

  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });
  const annotationTemplateId = useSelector(
    (s) => s.mapEditor.selectedAnnotationTemplateId
  );

  // helpers - annotation types

  const { type } = getPropsFromAnnotationTemplateId(annotationTemplateId);
  const annotationTypes = type ? [type] : ["MARKER", "TEXT"];

  // helpers

  const noAnnotation = !annotations?.length > 0;

  // helpers - buttonsMap

  const buttonsMap = {
    MARKER: <ButtonDrawMarker />,
    TEXT: <ButtonAddText />,
  };

  if (noAnnotation)
    return (
      <Box
        sx={{
          bgcolor: "secondary.main",
          p: 0.25,
          borderRadius: "4px",
          color: "white",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Typography sx={{ px: 2 }}>{addS}</Typography>
        <Toolbar>
          <ButtonDrawMarker />
        </Toolbar>
      </Box>
    );

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <SelectorAnnotationTemplateInMapEditor />

      <Toolbar sx={{ ml: 1 }}>
        {annotationTypes.map((type) => buttonsMap[type])}
      </Toolbar>
    </Box>
  );
}
