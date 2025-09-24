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

export default function ToolbarMapEditorLocatedEntities() {
  // strings

  const addS = "Ajoutez une annotation";

  // data

  const baseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotations = useAnnotations({ filterByBaseMapId: baseMapId });

  // helpers

  const noAnnotation = !annotations?.length > 0;

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
    <Toolbar>
      <ButtonDrawMarker />
      <ButtonAddText />
      {/* <ButtonDrawPolyline />
      <ButtonDrawPolygon />
      <ButtonDrawFreeline />
      <ButtonDownloadBaseMapView /> */}
      {/*<ButtonAutoSegmentation />*/}
    </Toolbar>
  );
}
