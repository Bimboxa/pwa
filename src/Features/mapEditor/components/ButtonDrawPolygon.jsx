import {useSelector} from "react-redux";

import {Pentagon as Polygon} from "@mui/icons-material";
import {IconButton} from "@mui/material";

import editor from "App/editor";

export default function ButtonDrawPolygon() {
  // data

  const mapId = useSelector((s) => s.mapEditor.loadedMainMapId);

  // handler

  function handleClick() {
    editor.mapEditor.enableDrawingMode("POLYGON", {mapId}, {updateRedux: true});
  }

  return (
    <IconButton onClick={handleClick} color="inherit">
      <Polygon />
    </IconButton>
  );
}
