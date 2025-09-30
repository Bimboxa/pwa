import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenu from "Features/layout/components/VerticalMenu";

import { Download, Info, Visibility } from "@mui/icons-material";

import { Box, Paper } from "@mui/material";

import PanelShower from "Features/shower/components/PanelShower";
import PanelEditorExport from "Features/editorExport/components/PanelEditorExport";
import VerticalMenuRightPanel from "./VerticalMenuRightPanel";
import PanelAnnotationFormat from "Features/annotations/components/PanelAnnotationFormat";
import PanelEditEntity from "Features/entities/components/PanelEditEntity";
import PanelNodeFormat from "Features/mapEditor/components/PanelNodeFormat";

export default function RightPanelContainer() {
  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const width = useSelector((s) => s.rightPanel.width);

  const windowHeight = useSelector((s) => s.layout.windowHeight);
  const bottomBarHeight = useSelector((s) => s.layout.bottomBarHeightDesktop);
  const topBarHeight = useSelector((s) => s.layout.topBarHeight);

  // helper - maxHeight

  const height = windowHeight - topBarHeight - bottomBarHeight;

  // helper

  const openPanel = Boolean(selectedKey);

  return (
    <>
      {/* <Box sx={{ position: "absolute", zIndex: 10, top: "8px", right: "8px" }}>
        <VerticalMenuRightPanel />
      </Box> */}

      {openPanel && (
        <Box
          sx={{
            position: "absolute",
            top: topBarHeight,
            bottom: bottomBarHeight,
            right: 0,
            width,
            minWidth: 0,
            bgcolor: "white",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            ...(!openPanel & { transform: "translateX(100%)" }),
          }}
        >
          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
          {/* {selectedKey === "ANNOTATION_FORMAT" && <PanelAnnotationFormat />} */}
          {selectedKey === "NODE_FORMAT" && <PanelNodeFormat />}
          {selectedKey === "ENTITY" && <PanelEditEntity />}
        </Box>
      )}
    </>
  );
}
