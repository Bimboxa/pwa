/* eslint-disable react/prop-types */
import { useState } from "react";
import {
  Alert,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { CropPortrait, CropLandscape } from "@mui/icons-material";
import useCreateBaseMapFromImage from "Features/baseMaps/hooks/useCreateBaseMapFromImage";
import sliceImageFile from "../utils/sliceImageFile";

export default function ButtonCreateScanBaseMap({
  projection,
  modelName,
  resourceId,
}) {
  const create = useCreateBaseMapFromImage();
  const [busy, setBusy] = useState(false),
    [status, setStatus] = useState(null);
  async function handleCreate() {
    if (!projection.current || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      const { result, mode, frame } = projection;
      const name = `${modelName.replace(/\.ply$/i, "")} · ${mode === "density" ? "Densité" : "Couleurs"} · Z ${result.lower.toFixed(2)} à ${result.upper.toFixed(2)} m`;
      const file = await sliceImageFile(result, mode);
      const entity = await create({
        file,
        name,
        meterByPx: result.pixelSize,
        orientation: "HORIZONTAL",
        source: "local-scan",
        selectOnCreate: false,
        triggerInitialSave: false,
        createdFrom: {
          type: "LOCAL_SCAN",
          resourceId: resourceId ?? null,
          mode,
          lower: result.lower,
          upper: result.upper,
          frame: { min: frame.min, max: frame.max, rows: frame.rows },
        },
      });
      if (!entity?.id) throw new Error("Le fond de plan n’a pas pu être créé.");
      setStatus({
        severity: "success",
        message:
          "Fond de plan créé à l’échelle dans les fonds de plan du projet.",
      });
    } catch (error) {
      setStatus({ severity: "error", message: error.message });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={projection.previewOrientation}
          aria-label="Orientation de l’aperçu"
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
        <Button
          sx={{ flex: 1 }}
          variant="contained"
          disabled={!projection.current || Boolean(projection.error) || busy}
          onClick={handleCreate}
        >
          {busy ? "Création…" : "Créer un fond de plan"}
        </Button>
      </Stack>
      {status && <Alert severity={status.severity}>{status.message}</Alert>}
    </Stack>
  );
}
