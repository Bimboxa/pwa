/* eslint-disable react/prop-types */
import {
  Alert,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import LocalScanSlicePreview from "./LocalScanSlicePreview";

export default function ScanProjectionPreview({ projection, onRotate }) {
  const { result, mode, setMode, pending, current, frame, error } = projection;
  if (!result)
    return (
      <Stack spacing={1}>
        <Typography variant="body2" color="text.secondary">
          Définir l’image projetée dans l’onglet Projection.
        </Typography>
        {pending && (
          <Typography variant="caption">Calcul de la projection…</Typography>
        )}
        {error && <Alert severity="warning">{error}</Alert>}
      </Stack>
    );
  return (
    <Stack spacing={1}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, value) => value && setMode(value)}
      >
        <ToggleButton value="density">Densité</ToggleButton>
        <ToggleButton value="rgb">Couleurs</ToggleButton>
      </ToggleButtonGroup>
      <LocalScanSlicePreview
        key={frame.rows.join(",")}
        result={result}
        mode={mode}
        pending={!current || Boolean(error)}
        onRotate={current && !error ? onRotate : undefined}
      />
      <Typography variant="caption" aria-live="polite">
        {current
          ? `${result.pointCount.toLocaleString("fr-FR")} points · ${(result.pixelSize * 100).toFixed(2)} cm/pixel`
          : "Actualisation… aperçu précédent."}
      </Typography>
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  );
}
