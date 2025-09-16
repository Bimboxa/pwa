import { useSelector } from "react-redux";

import { Box } from "@mui/material";

import ToolbarMapEditor from "./ToolbarMapEditor";
import ToolbarShapeProps from "Features/shapes/components/ToolbarShapeProps";

export default function ToolbarMapEditorContainer({ svgElement }) {
  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helper

  const showMain = !Boolean(enabledDrawingMode);
  const showShapeProps = Boolean(enabledDrawingMode);

  return (
    <Box sx={{}}>
      {showMain && <ToolbarMapEditor svgElement={svgElement} />}
      {false && showShapeProps && <ToolbarShapeProps />}
    </Box>
  );
}
