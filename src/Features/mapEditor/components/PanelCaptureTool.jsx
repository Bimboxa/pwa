import { useEffect, useRef, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setCaptureToolActive,
  setCaptureFileName,
  setCapturePanelCondensed,
  setEnabledDrawingMode,
} from "../mapEditorSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { selectCaptureHostViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import { Box, Button, IconButton, Tab, Tabs, Typography } from "@mui/material";
import { Close, KeyboardDoubleArrowRight } from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import PanelPovFilters from "Features/pov/components/PanelPovFilters";
import SectionPovCadrage from "Features/pov/components/SectionPovCadrage";
import SectionCaptureLabels from "./SectionCaptureLabels";
import SectionCaptureExport from "./SectionCaptureExport";
import ToolbarCaptureCondensed from "./ToolbarCaptureCondensed";

import useExitCaptureTool from "../hooks/useExitCaptureTool";

// Right-panel body of the global "Capture" tool (Alt+C), mirroring the POV
// properties panel: Image (export), Cadrage (frame + legend + logo) and
// Filtres (annotation templates visibility) tabs. Driven by
// captureToolActive: the frame ignores the right panel (no inset), but panel
// and frame live together — closing the panel (band toggle, Fermer, another
// tool) exits the capture mode, and an external exit (Alt+C, the save bar's
// X under the frame, the header X) closes the panel.
// This component stays the single mount point of the CAPTURE tool whatever
// the panel format, so the lifecycle effects below run in both: the condensed
// black band (ToolbarCaptureCondensed) is rendered instead of the tabs when
// capturePanelCondensed is on.
export default function PanelCaptureTool() {
  const dispatch = useDispatch();

  // strings

  const captionS = "Outil";
  const titleS = "Capture";
  const collapseS = "Réduire le panneau";

  // data

  const captureToolActive = useSelector((s) => s.mapEditor.captureToolActive);
  const capturePanelCondensed = useSelector(
    (s) => s.mapEditor.capturePanelCondensed
  );
  const hostViewerKey = useSelector(selectCaptureHostViewerKey);
  // File name delivered by the save bar's "Créer la capture" — the panel's
  // field edits it, the bar consumes it.
  const captureFileName = useSelector((s) => s.mapEditor.captureFileName);

  // state

  const [tab, setTab] = useState("IMAGE");

  // helpers

  const isThreed = hostViewerKey === "THREED";

  // effect - opening the panel arms the frame, closing it (unmount: band
  // toggle, Fermer, switch to another tool or module) disarms it: panel and
  // frame are linked.

  useEffect(() => {
    dispatch(setEnabledDrawingMode(null)); // clear active drawing tool
    dispatch(setCaptureToolActive(true));
    return () => dispatch(setCaptureToolActive(false));
  }, [dispatch]);

  // effect - an external exit (save bar X, floating quit button) closes the
  // panel too. Transition-only (true → false), so the pre-arming first
  // render doesn't self-close.

  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (wasActiveRef.current && !captureToolActive)
      dispatch(setSelectedMenuItemKey(null));
    wasActiveRef.current = captureToolActive;
  }, [captureToolActive, dispatch]);

  // handlers

  const handleClose = useExitCaptureTool();

  // render - condensed format (all hooks above run in both formats)

  if (capturePanelCondensed) return <ToolbarCaptureCondensed />;

  // render - full panel

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          p: 0.5,
          pl: 2,
          pr: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            sx={{
              fontStyle: "italic",
              fontSize: (theme) => theme.typography.caption.fontSize,
            }}
          >
            {captionS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} title="Quitter l'outil">
          <Close fontSize="small" />
        </IconButton>
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Capture" value="IMAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Cadrage" value="CADRAGE" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Filtres" value="FILTRES" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      {tab === "FILTRES" && <PanelPovFilters />}

      {tab === "CADRAGE" && (
        <SectionPovCadrage>
          {/* display-only label auto-layout (2D map only) */}
          {!isThreed && (
            <WhiteSectionGeneric>
              <SectionCaptureLabels />
            </WhiteSectionGeneric>
          )}
        </SectionPovCadrage>
      )}

      {tab === "IMAGE" && (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            p: 1,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          {/* Pure settings: the capture itself is triggered by the save
              bar's "Créer la capture" in the editor, which reads the file
              name and format from here */}
          <WhiteSectionGeneric>
            <SectionCaptureExport
              defaultFilename="capture"
              showOptions={false}
              showButton={false}
              allowPovMode
              filename={captureFileName}
              onFilenameChange={(v) => dispatch(setCaptureFileName(v))}
            />
          </WhiteSectionGeneric>
        </Box>
      )}

      {/* back to the condensed band — anchored below the tab content */}
      <Box sx={{ bgcolor: "common.black", flexShrink: 0 }}>
        <Button
          fullWidth
          startIcon={<KeyboardDoubleArrowRight />}
          onClick={() => dispatch(setCapturePanelCondensed(true))}
          sx={{
            color: "common.white",
            textTransform: "none",
            justifyContent: "center",
            py: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.08)" },
          }}
        >
          {collapseS}
        </Button>
      </Box>
    </BoxFlexVStretch>
  );
}
