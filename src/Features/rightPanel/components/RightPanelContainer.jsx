import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedMenuItemKey,
  setElevationWidth,
  setElevationViewerWidth,
} from "../rightPanelSlice";

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
import PanelElevation from "Features/elevation/components/PanelElevation";
import PanelMesh from "Features/mesh/components/PanelMesh";
import PanelImportAnnotations from "Features/importAnnotations/components/PanelImportAnnotations";
import PanelLocalLlm from "Features/localLlm/components/PanelLocalLlm";
import PanelThreedProperties from "Features/threedEditor/components/PanelThreedProperties";

export default function RightPanelContainer() {
  const dispatch = useDispatch();

  // data

  const selectedKey = useSelector((s) => s.rightPanel.selectedMenuItemKey);
  const fixedWidth = useSelector((s) => s.rightPanel.width);
  const elevationWidth = useSelector((s) => s.rightPanel.elevationWidth);
  const elevationViewerWidth = useSelector(
    (s) => s.rightPanel.elevationViewerWidth
  );

  // Both the Élévation viewer and the Maillage panel are resizable, but keep
  // independent widths: Maillage uses elevationWidth (fixed default), Élévation
  // uses elevationViewerWidth defaulting to 50% of the viewer when uncustomized.
  const isElevation = selectedKey === "ELEVATION";
  const isMesh = selectedKey === "MESH";
  const isResizable = isElevation || isMesh;

  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1200;
  const elevationDefaultWidth = Math.round(viewportWidth * 0.5);

  // The 3D properties panel hosts the basemap rotation/translation rows, which
  // need more room than the default fixed width.
  const width = isElevation
    ? (elevationViewerWidth ?? elevationDefaultWidth)
    : isMesh
      ? elevationWidth
      : selectedKey === "THREED_PROPERTIES"
        ? 380
        : fixedWidth;

  // handlers - resize: each resizable tool updates its own width; the fixed
  // tools keep theirs.

  function handleResizeMouseDown(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const maxWidth = Math.max(1000, Math.round(viewportWidth * 0.9));
    function onMove(ev) {
      const next = Math.min(
        Math.max(startWidth + (startX - ev.clientX), 260),
        maxWidth
      );
      dispatch(
        isElevation ? setElevationViewerWidth(next) : setElevationWidth(next)
      );
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "ew-resize";
  }

  const windowHeight = useSelector((s) => s.layout.windowHeight);
  const bottomBarHeight = useSelector((s) => s.layout.bottomBarHeightDesktop);
  const topBarHeight = useSelector((s) => s.layout.topBarHeight);

  // helper - maxHeight

  const height = windowHeight - topBarHeight - bottomBarHeight;

  // helper

  const openPanel = Boolean(selectedKey);

  return (
    <Box
      sx={{ display: "flex", minHeight: 0, minWidth: 0, position: "relative" }}
    >
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
          {/* resize handle on the left frontier — shown for the resizable
              tools (Élévation, Maillage); each keeps its own width */}
          {isResizable && (
            <Box
              onMouseDown={handleResizeMouseDown}
              sx={{
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: 8,
                cursor: "ew-resize",
                zIndex: 250,
                "&:hover": { bgcolor: "primary.main", opacity: 0.3 },
              }}
            />
          )}

          {selectedKey === "SHOWER" && <PanelShower />}
          {selectedKey === "EDITOR_EXPORT" && <PanelEditorExport />}
          {/* EXPORT merged into PRINT panel */}
          {/* {selectedKey === "ANNOTATION_FORMAT" && <PanelAnnotationFormat />} */}
          {selectedKey === "NODE_FORMAT" && <PanelNodeFormat />}
          {selectedKey === "ENTITY" && (
            <PanelEditEntity showCloseButton={false} />
          )}
          {selectedKey === "SELECTION" && <PanelSelection />}
          {selectedKey === "SELECTION_PROPERTIES" && (
            <PanelSelectionProperties />
          )}
          {selectedKey === "ENTITY_ZONES" && <PanelEntityZones />}
          {selectedKey === "PDF_REPORT" && <PanelPdfReport />}
          {selectedKey === "OPENCV" && <PanelOpencv />}
          {selectedKey === "MASTER_PROJECT_PICTURES" && (
            <PanelMasterProjectPictures />
          )}
          {selectedKey === "TOOLS" && <PanelTools />}
          {selectedKey === "CHAT" && <PanelChat />}
          {selectedKey === "ADMIN_MODEL" && <PanelAdminEntityModel />}
          {selectedKey === "ADMIN_LISTING" && <PanelAdminListing />}
          {selectedKey === "ADMIN_ENTITY" && <PanelAdminEntity />}
          {selectedKey === "ANNOTATIONS_AUTO" && <PanelAnnotationsAuto />}
          {selectedKey === "PRINT" && <PanelPrint />}
          {selectedKey === "ELEVATION" && <PanelElevation />}
          {selectedKey === "MESH" && <PanelMesh />}
          {selectedKey === "IMPORT_ANNOTATIONS" && <PanelImportAnnotations />}
          {selectedKey === "LOCAL_LLM" && <PanelLocalLlm />}
          {selectedKey === "THREED_PROPERTIES" && <PanelThreedProperties />}
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
