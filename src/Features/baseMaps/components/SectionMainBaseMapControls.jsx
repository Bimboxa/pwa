import { useDispatch, useSelector } from "react-redux";

import {
  setIsCalibrating,
  setShowCalibration,
  setCalibrationTargets,
} from "Features/baseMapEditor/baseMapEditorSlice";

import db from "App/db/db";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useShowMainBaseMapControls from "../hooks/useShowMainBaseMapControls";
import computeCalibrationTransform, {
  DEFAULT_RED,
  DEFAULT_GREEN,
} from "Features/mapEditor/utils/computeCalibrationTransform";

import { Box, Button } from "@mui/material";

import BaseMapSelectorInMapEditorV2 from "./BaseMapSelectorInMapEditorV2";
import BaseMapVersionSelectorInTopBar from "./BaseMapVersionSelectorInTopBar";
import FieldBaseMapZInTopBar from "./FieldBaseMapZInTopBar";

// Controls of the selected (main) base map: selector, versions, altitude (Z)
// and, while a versions calibration runs in the BaseMaps module, its
// Annuler / Calibrer buttons. Rendered in the center of the top bar, and —
// in full screen, where the top bar is gone — at the top center of the
// displayed editor (SectionMainBaseMapControlsFloating). Visibility rule:
// useShowMainBaseMapControls.
export default function SectionMainBaseMapControls() {
  const dispatch = useDispatch();

  // data

  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const show = useShowMainBaseMapControls();
  const isCalibrating = useSelector((s) => s.baseMapEditor.isCalibrating);
  const versionCompareId = useSelector((s) => s.baseMapEditor.versionCompareId);
  const calibrationTargetsByVersionId = useSelector(
    (s) => s.baseMapEditor.calibrationTargetsByVersionId
  );
  const baseMap = useMainBaseMap();

  // helpers

  const isBaseMapsModule = viewerKey === "BASE_MAPS";

  // handlers

  function handleCancelCalibration() {
    dispatch(setIsCalibrating(false));
    dispatch(setShowCalibration(false));
  }

  async function handleConfirmCalibration() {
    if (!baseMap || !versionCompareId) return;

    const activeVersion = baseMap.getActiveVersion();
    if (!activeVersion) return;

    const activeTargets = calibrationTargetsByVersionId[activeVersion.id] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };
    const refTargets = calibrationTargetsByVersionId[versionCompareId] || {
      red: DEFAULT_RED,
      green: DEFAULT_GREEN,
    };

    const refSize = baseMap.getImageSize();
    if (!refSize) return;

    const activeTransform = activeVersion.transform || {
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    };

    const newTransform = computeCalibrationTransform({
      activeTargets,
      refTargets,
      refSize,
      activeTransform,
    });

    if (!newTransform) return;

    await db.baseMapVersions.update(activeVersion.id, {
      transform: newTransform,
    });

    // Move active targets to reference positions after calibration
    dispatch(
      setCalibrationTargets({
        versionId: activeVersion.id,
        red: { x: refTargets.red.x, y: refTargets.red.y },
        green: { x: refTargets.green.x, y: refTargets.green.y },
      })
    );

    dispatch(setIsCalibrating(false));
    dispatch(setShowCalibration(false));
  }

  // render

  if (!show) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <BaseMapSelectorInMapEditorV2
        // The BaseMaps module edits the image itself: no eye there.
        showImageToggle={!isBaseMapsModule}
      />
      <BaseMapVersionSelectorInTopBar />
      <FieldBaseMapZInTopBar />
      {isBaseMapsModule && isCalibrating && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleCancelCalibration}
          >
            Annuler
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleConfirmCalibration}
            sx={{
              bgcolor: "warning.main",
              color: "warning.contrastText",
              "&:hover": { bgcolor: "warning.dark" },
            }}
          >
            Calibrer
          </Button>
        </Box>
      )}
    </Box>
  );
}
