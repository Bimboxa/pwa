import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenu from "Features/layout/components/VerticalMenu";

import { Download, Info, Visibility } from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import VerticalMenuRightPanel from "./VerticalMenuRightPanel";
import PanelAnnotationFormat from "Features/annotations/components/PanelAnnotationFormat";

export default function RightPanelContainer() {
  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const width = useSelector((s) => s.rightPanel.width);

  // helper

  const openPanel = Boolean(selectedKey);

  return (
    <>
      <Box sx={{ position: "absolute", zIndex: 10, top: "8px", right: "8px" }}>
        <VerticalMenuRightPanel />
      </Box>

      {openPanel && (
        <Paper
          sx={{
            position: "absolute",
            top: "12px",
            right: "64px",
            width,
            minHeight: 100,
            bgcolor: "white",
            zIndex: 200,
          }}
        >
          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
          {selectedKey === "ANNOTATION_FORMAT" && <PanelAnnotationFormat />}
        </Paper>
      )}
    </>
  );
}
