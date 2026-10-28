/* eslint-disable react/prop-types */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { Alert, Button, Stack } from "@mui/material";
import updateScanBaseMapService from "../services/updateScanBaseMapService";
import frameProjectionRaster from "../utils/frameProjectionRaster";

// « Mettre à jour le fond de plan »: the image of the selected scan base
// map is replaced by the current slice (updateScanBaseMapService — the
// base map keeps its frame when it carries annotations), its localScan
// matrix follows the scan pose (calibration, Z offset) and its height map
// is rebuilt. Enabled once the current slice is calculated.
export default function ButtonUpdateScanBaseMap({
  projection,
  view,
  linkedBaseMap,
  heightMapOptions,
  disabled = false,
}) {
  const dispatch = useDispatch();

  // strings

  const updateS = "Mettre à jour le fond de plan";

  // state

  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(null);

  // helpers

  const { result } = projection;
  const canRun =
    projection.current &&
    !projection.error &&
    !busy &&
    !disabled &&
    Boolean(view) &&
    Boolean(linkedBaseMap);

  // The base map image is what the preview frames (format, zoom, pan):
  // the raster re-cut to that rectangle, white around the cloud.
  function getFramedRaster() {
    const { frame, framing } = projection;
    return framing
      ? frameProjectionRaster(result, frame, framing)
      : { result, frame };
  }

  // handlers

  async function handleUpdate() {
    if (!canRun) return;
    setBusy(true);
    setStatus(null);
    try {
      const { reframed } = await updateScanBaseMapService({
        baseMapId: linkedBaseMap.id,
        view,
        projection,
        framed: getFramedRaster(),
        heightMapOptions,
      });
      dispatch(triggerBaseMapsUpdate());
      dispatch(triggerEntitiesTableUpdate("baseMaps"));
      setStatus({
        severity: "success",
        message: reframed
          ? "Fond de plan mis à jour."
          : "Fond de plan mis à jour dans son cadre actuel : ses annotations restent en place.",
      });
    } catch (error) {
      setStatus({ severity: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Stack spacing={1}>
      {status && <Alert severity={status.severity}>{status.message}</Alert>}
      <Button
        fullWidth
        variant="contained"
        disabled={!canRun}
        onClick={handleUpdate}
      >
        {busy ? "Mise à jour…" : updateS}
      </Button>
    </Stack>
  );
}
