import {useSelector} from "react-redux";

import {Box} from "@mui/material";

import ToolbarMapEditorMain from "./ToolbarMapEditorMain";
import ToolbarShapeProps from "Features/shapes/components/ToolbarShapeProps";

export default function ToolbarMapEditor() {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helper

  const showMain = !Boolean(enabledDrawingMode);
  const showShapeProps = Boolean(enabledDrawingMode);

  return (
    <Box sx={{}}>
      {showMain && <ToolbarMapEditorMain />}
      {showShapeProps && <ToolbarShapeProps />}
    </Box>
  );
}
