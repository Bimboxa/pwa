/* eslint-disable react/prop-types */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import {
  Alert,
  Button,
  IconButton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, CropPortrait, CropLandscape } from "@mui/icons-material";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";
import FieldNumberCompact from "Features/threedMesh/components/FieldNumberCompact";
import updateScanBaseMapService from "../services/updateScanBaseMapService";
import prepareScanBaseMap from "../utils/prepareScanBaseMap";
import sliceImageFile from "../utils/sliceImageFile";
import getLocalScanMatrixInBaseMap from "../utils/getLocalScanMatrixInBaseMap";

// Base map of the current slice. Without a linked base map: name + « + »
// creates one and selects it (the panel then follows it). The base map keeps
// the scan pose in its own frame (localScan.matrix): the point cloud follows
// every later move of the map. Unsaved scans (no resource) only get the
// image. With the selected base map projected from this scan (linkedBaseMap):
// « Mettre à jour le fond de plan » replaces its image by the slice
// (updateScanBaseMapService).
export default function ButtonCreateScanBaseMap({
  projection,
  view,
  modelName,
  resourceId,
  linkedBaseMap,
}) {
  const dispatch = useDispatch();
  const create = useCreateBaseMapFromImage();

  // strings

  const createS = "Créer un fond de plan";
  const updateS = "Mettre à jour le fond de plan";
  const nameS = "Nom du fond de plan";
  const linkedS = (name) => `Fond de plan sélectionné : ${name}`;

  // state

  const [altitude, setAltitude] = useState(0);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(null);

  // helpers

  const { result, mode } = projection;
  const defaultName = result
    ? `${modelName.replace(/\.ply$/i, "")} · ${mode === "density" ? "Densité" : "Couleurs"} · Z ${result.lower.toFixed(2)} à ${result.upper.toFixed(2)} m`
    : "";
  const canRun =
    projection.current && !projection.error && !busy && Boolean(view);

  // handlers

  async function handleCreate() {
    if (!canRun || !Number.isFinite(altitude)) return;
    setBusy(true);
    setStatus(null);
    try {
      const { frame } = projection;
      const placement = prepareScanBaseMap(result, frame, altitude);
      const file = await sliceImageFile(result, mode);
      view.root.updateMatrixWorld(true);
      const localScan = resourceId
        ? {
            resourceId,
            matrix: getLocalScanMatrixInBaseMap(
              view.root.matrixWorld,
              placement
            ),
          }
        : null;
      const entity = await create({
        file,
        name: name.trim() || defaultName,
        meterByPx: result.pixelSize,
        ...placement,
        localScan,
        source: "local-scan",
        triggerInitialSave: false,
        createdFrom: {
          type: "LOCAL_SCAN",
          resourceId: resourceId ?? null,
          mode,
          altitude,
          lower: result.lower,
          upper: result.upper,
          frame: { min: frame.min, max: frame.max, rows: frame.rows },
        },
      });
      if (!entity?.id) throw new Error("Le fond de plan n’a pas pu être créé.");
      setName("");
      setStatus({
        severity: "success",
        message: `Fond de plan créé et positionné à Z = ${altitude} m.`,
      });
    } catch (error) {
      setStatus({ severity: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate() {
    if (!canRun || !linkedBaseMap) return;
    setBusy(true);
    setStatus(null);
    try {
      const { reframed } = await updateScanBaseMapService({
        baseMapId: linkedBaseMap.id,
        view,
        projection,
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

  const orientationToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={projection.previewOrientation}
      aria-label="Orientation de l’aperçu"
      sx={{ flexShrink: 0 }}
      onChange={(_, orientation) =>
        orientation && projection.setPreviewOrientation(orientation)
      }
    >
      <ToggleButton value="PORTRAIT" aria-label="Portrait">
        <Tooltip title="Portrait">
          <CropPortrait fontSize="small" />
        </Tooltip>
      </ToggleButton>
      <ToggleButton value="LANDSCAPE" aria-label="Paysage">
        <Tooltip title="Paysage">
          <CropLandscape fontSize="small" />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Stack spacing={1}>
      {linkedBaseMap && (
        <Typography variant="caption" color="text.secondary" noWrap>
          {linkedS(linkedBaseMap.name)}
        </Typography>
      )}
      {/* One line: preview format, altitude, name, « + » (or the update). */}
      <Stack direction="row" spacing={1} alignItems="center">
        {orientationToggle}
        {linkedBaseMap ? (
          <Button
            sx={{ flex: 1 }}
            variant="contained"
            disabled={!canRun}
            onClick={handleUpdate}
          >
            {busy ? "Mise à jour…" : updateS}
          </Button>
        ) : (
          <>
            <FieldNumberCompact
              label="Z"
              unit="m"
              value={altitude}
              disabled={busy}
              onChange={setAltitude}
            />
            <TextField
              size="small"
              sx={{ flex: 1, minWidth: 0 }}
              placeholder={defaultName || nameS}
              aria-label={nameS}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") void handleCreate();
              }}
            />
            <Tooltip title={createS}>
              <span>
                <IconButton
                  aria-label={createS}
                  disabled={!canRun || !Number.isFinite(altitude)}
                  onClick={handleCreate}
                  sx={{
                    flexShrink: 0,
                    bgcolor: "secondary.main",
                    color: "secondary.contrastText",
                    "&:hover": { bgcolor: "secondary.dark" },
                    "&.Mui-disabled": {
                      bgcolor: "action.disabledBackground",
                      color: "action.disabled",
                    },
                  }}
                >
                  <Add />
                </IconButton>
              </span>
            </Tooltip>
          </>
        )}
      </Stack>
      {status && <Alert severity={status.severity}>{status.message}</Alert>}
    </Stack>
  );
}
