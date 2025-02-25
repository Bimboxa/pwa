import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import Toolbar from "Features/layout/components/Toolbar";
import ButtonRefreshMap from "./ButtonRefreshMap";
import ButtonDrawPolygon from "./ButtonDrawPolygon";
import ButtonEditScale from "./ButtonEditScale";
import ButtonDrawPolyline from "./ButtonDrawPolyline";

export default function ToolbarMapEditor() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helper

  const hide = Boolean(enabledDrawingMode);

  return (
    <Box sx={{display: hide ? "none" : "flex"}}>
      <Toolbar>
        <ButtonRefreshMap />
        <ButtonEditScale />
        <ButtonDrawPolyline />
        <ButtonDrawPolygon />
      </Toolbar>
    </Box>
  );
}
