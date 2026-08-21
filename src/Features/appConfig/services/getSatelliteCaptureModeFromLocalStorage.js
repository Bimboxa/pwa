import { SATELLITE_CAPTURE_MODES } from "Features/satelliteMap/utils/satelliteCaptureModes";

export default function getSatelliteCaptureModeFromLocalStorage() {
  const v = localStorage.getItem("satelliteCaptureMode");
  return SATELLITE_CAPTURE_MODES.some((m) => m.key === v) ? v : "MERCATOR";
}
