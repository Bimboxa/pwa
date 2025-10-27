import { useSelector, useDispatch } from "react-redux";

import { Box, Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function PanelHelperDrawAnnotation() {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const helperMap = {
    MARKER: "1 click = 1 annotation",
    POLYLINE: "Dbl click = fin du dessin",
    POLYGONE: "1 click = 1 point",
    RECTANGLE: "1er click = 1er point, 2nd click = fin du dessin",
  };

  const helperS = helperMap[enabledDrawingMode];

  return (
    <Panel>
      <BoxCenter>
        <Typography>{helperS}</Typography>
      </BoxCenter>
    </Panel>
  );
}
