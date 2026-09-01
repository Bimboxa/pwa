import { useSelector, useDispatch } from "react-redux";

import { setSatelliteCaptureMode } from "Features/appConfig/appConfigSlice";

import setSatelliteCaptureModeInLocalStorage from "Features/appConfig/services/setSatelliteCaptureModeInLocalStorage";
import { SATELLITE_CAPTURE_MODES } from "Features/satelliteMap/utils/satelliteCaptureModes";

import { Box, Typography } from "@mui/material";
import FieldOptionSelector from "Features/form/components/FieldOptionSelector";

// "Éditeurs > Carte satellite" page: device-local satellite capture
// preferences (the projection selector formerly in the compact app config
// dialog).
export default function PageSatelliteMap() {
  const dispatch = useDispatch();

  // data

  const satelliteCaptureMode = useSelector(
    (s) => s.appConfig.satelliteCaptureMode
  );

  // helpers

  const satelliteModeOption =
    SATELLITE_CAPTURE_MODES.find((m) => m.key === satelliteCaptureMode) ??
    SATELLITE_CAPTURE_MODES[0];

  // handlers

  function handleSatelliteCaptureModeChange(option) {
    if (!option?.key) return;
    dispatch(setSatelliteCaptureMode(option.key));
    setSatelliteCaptureModeInLocalStorage(option.key);
  }

  // render

  return (
    <Box sx={{ px: 3, py: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Carte satellite
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Import image satellite
      </Typography>
      <FieldOptionSelector
        value={satelliteModeOption}
        label="Projection de capture"
        onChange={handleSatelliteCaptureModeChange}
        valueOptions={SATELLITE_CAPTURE_MODES}
        options={{ labelKey: "label" }}
      />
    </Box>
  );
}
