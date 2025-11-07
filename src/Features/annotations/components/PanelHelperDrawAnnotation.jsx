import { useSelector, useDispatch } from "react-redux";

import { Box, Typography } from "@mui/material";

import Panel from "Features/layout/components/Panel";
import BoxCenter from "Features/layout/components/BoxCenter";

import SectionEditedAnnotationNextPoint from "./SectionEditedAnnotationNextPoint";
import SectionFixedLengthToNextPoint from "./SectionFixedLengthToNextPoint";

export default function PanelHelperDrawAnnotation() {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const helperMap = {
    MARKER: "1 click = 1 annotation",
    POLYLINE: "",
    POLYGONE: "1 click = 1 point",
    RECTANGLE: `1er click = 1er point \n2nd click = fin du dessin`,
  };

  const helperS = helperMap[enabledDrawingMode];

  return (
    <Panel>
      <BoxCenter sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {["POLYLINE", "RECTANGLE"].includes(enabledDrawingMode) && (
          <Box sx={{ p: 1 }}>
            <Box sx={{ bgcolor: "white" }}>
              {/* <SectionEditedAnnotationNextPoint /> */}
              <SectionFixedLengthToNextPoint />
            </Box>
          </Box>
        )}

        <Typography variant="body2" sx={{ mt: 2, px: 2, whiteSpace: "pre" }}>
          {helperS}
        </Typography>
      </BoxCenter>
    </Panel>
  );
}
