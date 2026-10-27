/* eslint-disable react/prop-types */
import {
  Alert,
  Button,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { FileDownloadOutlined } from "@mui/icons-material";
import LocalScanSlicePreview from "./LocalScanSlicePreview";

export default function ScanProjectionPreview({
  projection,
  onRotate,
  onDownload,
  showProjectionTools = true,
}) {
  const { result, mode, setMode, pending, current, frame, error } = projection;
  return (
    <Stack spacing={1}>
      <LocalScanSlicePreview
        key={frame?.rows.join(",") ?? "empty"}
        result={result}
        mode={mode}
        pending={result ? !current || Boolean(error) : pending}
        aspectRatio={
          projection.previewOrientation === "PORTRAIT" ? 210 / 297 : 297 / 210
        }
        overlayControls={
          showProjectionTools && (
            <ToggleButtonGroup
              exclusive
              size="small"
              disabled={!result}
              aria-label="Type d’image projetée"
              value={mode}
              onChange={(_, value) => value && setMode(value)}
              sx={{
                bgcolor: "background.paper",
                boxShadow: 1,
                "& .MuiToggleButton-root": {
                  px: 1,
                  py: 0.25,
                  fontSize: "0.75rem",
                },
              }}
            >
              <ToggleButton value="density">Densité</ToggleButton>
              <ToggleButton value="rgb">Couleurs</ToggleButton>
            </ToggleButtonGroup>
          )
        }
        onRotate={current && !error ? onRotate : undefined}
      />
      {showProjectionTools && result && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={0.5}
          sx={{ flexWrap: "wrap" }}
        >
          <Typography variant="caption" aria-live="polite">
            {current
              ? `${result.pointCount.toLocaleString("fr-FR")} points · ${(result.pixelSize * 100).toFixed(2)} cm/pixel`
              : "Actualisation… aperçu précédent."}
          </Typography>
          {onDownload && (
            <Button
              size="small"
              startIcon={<FileDownloadOutlined />}
              disabled={!current || Boolean(error)}
              onClick={() => onDownload(mode)}
              sx={{ ml: "auto !important" }}
            >
              Télécharger
            </Button>
          )}
        </Stack>
      )}
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  );
}
