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
import PanelSelection from "Features/selection/components/PanelSelection";
import PanelEntityZones from "Features/relsZoneEntity/components/PanelEntityZones";
import PanelPdfReport from "Features/pdfReport/components/PanelPdfReport.jsx";
import PanelOpencv from "Features/opencv/components/PanelOpencv.jsx";
import PanelTools from "Features/tools/components/PanelTools";
import PanelMasterProjectPictures from "Features/masterProjectPictures/components/PanelMasterProjectPictures";
import PanelChat from "Features/chat/components/PanelChat";
import BaseMapDetail from "Features/baseMapEditor/components/PanelBaseMapDetail";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelExport from "Features/export/components/PanelExport";
import PanelSelectionProperties from "Features/selection/components/PanelSelectionProperties";

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
    <Box sx={{ display: "flex", minHeight: 0, minWidth: 0 }}>


      {openPanel && (
        <Box
          sx={{
            //position: "absolute",
            //right: 0,
            //top: topBarHeight,
            //bottom: 0,

            width,
            minWidth: 0,
            bgcolor: "background.default",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            ...(!openPanel & { transform: "translateX(100%)" }),
          }}
        >
          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
          {selectedKey === "EXPORT" && <PanelExport />}
          {/* {selectedKey === "ANNOTATION_FORMAT" && <PanelAnnotationFormat />} */}
          {selectedKey === "NODE_FORMAT" && <PanelNodeFormat />}
          {selectedKey === "ENTITY" && <PanelEditEntity showCloseButton={false} />}
          {selectedKey === "SELECTION" && <PanelSelection />}
          {selectedKey === "SELECTION_PROPERTIES" && <PanelSelectionProperties />}
          {selectedKey === "ENTITY_ZONES" && <PanelEntityZones />}
          {selectedKey === "PDF_REPORT" && <PanelPdfReport />}
          {selectedKey === "OPENCV" && <PanelOpencv />}
          {selectedKey === "MASTER_PROJECT_PICTURES" && <PanelMasterProjectPictures />}
          {selectedKey === "TOOLS" && <PanelTools />}
          {selectedKey === "CHAT" && <PanelChat />}
          {selectedKey === "BASE_MAP" && <BaseMapDetail />}
        </Box>
      )}

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
        }}
      >
        <VerticalMenuRightPanel />
      </Box>
    </Box>
  );
}
