/* eslint-disable react/prop-types */
import {
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// « Affichage du modèle » section of the Scan 3D tool: visibility (the
// « 3D » chip of the base map), Points / Réaliste (the bottom bar mode),
// the point size and the « Zmap pour le raycaster » switch of the base map
// (first person walks on the relief, the 3D altimetry reads it — shown or
// not; stored as baseMap.localScan.zMapRaycast).
export default function SectionScanDisplay({
  loaded,
  mode,
  pointSize,
  modelVisible,
  zMapRaycast = true,
  onToggleVisible,
  onChangeMode,
  onChangePointSize,
  onZMapRaycastChange,
}) {
  // render
  return (
    <WhiteSectionGeneric>
      <Stack spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">Affichage du modèle</Typography>
          <Tooltip
            title={modelVisible ? "Masquer le modèle" : "Afficher le modèle"}
          >
            <IconButton
              size="small"
              aria-label={
                modelVisible ? "Masquer le modèle" : "Afficher le modèle"
              }
              onClick={onToggleVisible}
            >
              {modelVisible ? (
                <Visibility fontSize="small" />
              ) : (
                <VisibilityOff fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          sx={{
            flexWrap: "wrap",
            columnGap: 3,
            rowGap: 1,
            "& .MuiToggleButton-root": {
              px: 1,
              py: 0.25,
              fontSize: "0.75rem",
            },
          }}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={mode}
            aria-label="Mode d’affichage du modèle"
            onChange={(_, value) => onChangeMode(value)}
          >
            <ToggleButton value="POINTS">Points</ToggleButton>
            <ToggleButton value="SPLAT" disabled={loaded.kind !== "SPLAT"}>
              Réaliste
            </ToggleButton>
          </ToggleButtonGroup>
          {/* Kept in place in « Réaliste » (disabled): no layout jump. */}
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography
              variant="caption"
              color={mode === "POINTS" ? "text.secondary" : "text.disabled"}
              sx={{ whiteSpace: "nowrap" }}
            >
              Taille des points
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={pointSize}
              aria-label="Taille des points"
              disabled={mode !== "POINTS"}
              onChange={(_, size) => {
                if (size !== null) onChangePointSize(size);
              }}
            >
              {[1, 2, 4].map((size) => (
                <ToggleButton
                  key={size}
                  value={size}
                  sx={{ whiteSpace: "nowrap" }}
                >
                  {size} px
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
        </Stack>
        {loaded.kind === "SPLAT" && (
          <Typography variant="caption" color="text.secondary">
            Les points sont les centres des gaussiennes, pas un relevé laser.
          </Typography>
        )}
        {onZMapRaycastChange && (
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={zMapRaycast}
                onChange={(_, checked) => onZMapRaycastChange(checked)}
              />
            }
            label="Activer la Zmap pour le raycaster"
            sx={{
              m: 0,
              gap: 0.5,
              "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
            }}
          />
        )}
        {onZMapRaycastChange && (
          <Typography variant="caption" color="text.secondary">
            Première personne et altitude sous la souris lisent le relief de la
            Zmap, affichée ou non.
          </Typography>
        )}
      </Stack>
    </WhiteSectionGeneric>
  );
}
