import {useSelector} from "react-redux";

import {Pentagon as Polygon} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";
import useLoadedMainMap from "../hooks/useLoadedMainMap";

export default function ButtonDrawPolygon() {
  // data

  const mapId = useSelector((s) => s.mapEditor.loadedMainMapId);
  const newShape = useSelector((s) => s.shapes.newShape);

  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode(
      "POLYGON",
      {mapId, ...newShape},
      {updateRedux: true}
    );
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Polygon />
    </IconButton>
  );
}
