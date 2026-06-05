import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "../rightPanelSlice";

import VerticalMenu from "Features/layout/components/VerticalMenu";

import { Download, Info, Visibility } from "@mui/icons-material";

import { Box, Paper, Slide } from "@mui/material";

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
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import PanelSelectionProperties from "Features/selection/components/PanelSelectionProperties";
import PanelAdminEntityModel from "Features/entityModels/components/PanelAdminEntityModel";
import PanelAdminListing from "Features/adminEditor/components/PanelAdminListing";
import PanelAdminEntity from "Features/adminEditor/components/PanelAdminEntity";
import PanelAnnotationsAuto from "Features/annotationsAuto/components/PanelAnnotationsAuto";
import PanelPrint from "Features/print/components/PanelPrint";

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
    <Box sx={{ display: "flex", minHeight: 0, minWidth: 0, position: "relative" }}>

      {/* Open panel renders as an overlay drawer (right: 100% anchors it flush to
          the left of the band, floating over the viewer) so opening/closing it
          never changes the viewer's pixel size — avoids zoom/pan jumps. */}
      <Slide direction="left" in={openPanel} mountOnEnter unmountOnExit>
        <Box
          sx={{
            position: "absolute",
            right: "100%",
            top: 0,
            bottom: 0,
            width,
            minWidth: 0,
            bgcolor: "background.default",
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            borderLeft: (theme) => `1px solid ${theme.palette.divider}`,
            boxShadow: 3,
          }}
        >
          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
          {/* EXPORT merged into PRINT panel */}
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
          {selectedKey === "ADMIN_MODEL" && <PanelAdminEntityModel />}
          {selectedKey === "ADMIN_LISTING" && <PanelAdminListing />}
          {selectedKey === "ADMIN_ENTITY" && <PanelAdminEntity />}
          {selectedKey === "ANNOTATIONS_AUTO" && <PanelAnnotationsAuto />}
          {selectedKey === "PRINT" && <PanelPrint />}
        </Box>
      </Slide>

      {/* The band stays visually on top of the overlay drawer (which slides out
          from behind it), so it needs a higher z-index than the panel above. */}
      <Box
        sx={{
          position: "relative",
          zIndex: 300,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <VerticalMenuRightPanel />
      </Box>
    </Box>
  );
}
