import { useSelector, useDispatch } from "react-redux";

import {
  setAdvancedLayout,
  setDisable3D,
  setSatelliteCaptureMode,
} from "../appConfigSlice";

import useAppConfig from "../hooks/useAppConfig";
import setDisable3DInLocalStorage from "../services/setDisable3DInLocalStorage";
import setSatelliteCaptureModeInLocalStorage from "../services/setSatelliteCaptureModeInLocalStorage";
import { SATELLITE_CAPTURE_MODES } from "Features/satelliteMap/utils/satelliteCaptureModes";

import { Box, Typography } from "@mui/material";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import FieldCheck from "Features/form/components/FieldCheck";
import FieldOptionSelector from "Features/form/components/FieldOptionSelector";

import ButtonDeleteProjects from "./ButtonDeleteProjects";
import ButtonShowChrono from "Features/chrono/components/ButtonShowChrono";

export default function PanelAppConfig({ onClose }) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();
  const advancedLayout = useSelector((s) => s.appConfig.advancedLayout);
  const disable3D = useSelector((s) => s.appConfig.disable3D);
  const satelliteCaptureMode = useSelector(
    (s) => s.appConfig.satelliteCaptureMode
  );

  // helpers

  const version = appConfig?.version ?? "-";
  const satelliteModeOption =
    SATELLITE_CAPTURE_MODES.find((m) => m.key === satelliteCaptureMode) ??
    SATELLITE_CAPTURE_MODES[0];

  // handlers

  function handleAdvancedLayoutChange(v) {
    dispatch(setAdvancedLayout(v));
  }

  function handleDisable3DChange(v) {
    dispatch(setDisable3D(v));
    setDisable3DInLocalStorage(v);
  }

  function handleSatelliteCaptureModeChange(option) {
    if (!option?.key) return;
    dispatch(setSatelliteCaptureMode(option.key));
    setSatelliteCaptureModeInLocalStorage(option.key);
  }

  // render

  return (
    <BoxFlexVStretch>
      <Box sx={{ p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Version : {version}
        </Typography>
      </Box>

      <Box sx={{ px: 1, py: 0.5 }}>
        <FieldCheck
          value={advancedLayout}
          onChange={handleAdvancedLayoutChange}
          label="Mode avancé"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ px: 1, py: 0.5 }}>
        <FieldCheck
          value={disable3D}
          onChange={handleDisable3DChange}
          label="Désactiver la 3D"
          options={{ type: "switch" }}
        />
      </Box>

      <Box sx={{ px: 1, pt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Import image satellite
        </Typography>
      </Box>
      <FieldOptionSelector
        value={satelliteModeOption}
        label="Projection de capture"
        onChange={handleSatelliteCaptureModeChange}
        valueOptions={SATELLITE_CAPTURE_MODES}
        options={{ labelKey: "label" }}
      />

      <ButtonShowChrono />

      <BoxFlexVStretch sx={{ overflow: "auto", flexGrow: 1 }}>
        <ButtonDeleteProjects onDeleted={onClose} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
