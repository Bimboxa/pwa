/* eslint-disable react/prop-types */
import {
  Box,
  Button,
  FormControlLabel,
  Skeleton,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ScanProjectionPreview from "./ScanProjectionPreview";

// « Position » tab of the Scan 3D tool: axis/scale, reference point and
// two-point horizontal alignment.
export default function TabScanPosition({
  placement,
  inspection,
  picked,
  pickMessage,
  coordinates,
  projection,
  onPlace,
  onInspectionChange,
  onRotate,
}) {
  // render
  return (
    <>
      <WhiteSectionGeneric>
        <Stack
          spacing={1}
          sx={{
            "& .MuiToggleButton-root": {
              px: 1,
              py: 0.25,
              fontSize: "0.75rem",
            },
          }}
        >
          <Typography variant="subtitle2">Placement du modèle</Typography>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
          >
            <Typography variant="body2">Axe vertical</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={placement.up}
              aria-label="Axe vertical"
              onChange={(_, value) => {
                if (value) onPlace({ up: value });
              }}
            >
              <ToggleButton value="Z">Z</ToggleButton>
              <ToggleButton value="Y">Y</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
          >
            <Typography variant="body2">Mètres / unité</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={placement.scale}
              aria-label="Mètres par unité"
              onChange={(_, value) => {
                if (value !== null) onPlace({ scale: value });
              }}
            >
              {[1, 2, 3].map((scale) => (
                <ToggleButton key={scale} value={scale}>
                  {scale}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Échelle à confirmer avec une distance connue.
          </Typography>
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Stack spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={1}
          >
            <Typography variant="subtitle2">Point de référence</Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={inspection}
                  onChange={(_, value) => onInspectionChange(value)}
                />
              }
              label="Activer"
              labelPlacement="start"
              sx={{
                m: 0,
                gap: 0.5,
                "& .MuiFormControlLabel-label": {
                  fontSize: "0.8125rem",
                },
              }}
            />
          </Stack>
          {inspection && (
            <Typography variant="caption">
              Cliquez sur le modèle pour relever un point. Glissez pour
              naviguer. Plan recherché dans un cube de 1 m ; grille temporaire
              de 2 × 2 m.
            </Typography>
          )}
          {inspection && !picked && (
            <Stack
              spacing={0.5}
              role="status"
              aria-label="En attente du clic sur le modèle"
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <Box sx={{ flex: 1 }}>
                  {["X", "Y", "Z"].map((axis) => (
                    <Skeleton
                      key={axis}
                      variant="text"
                      width={110}
                      height={22}
                    />
                  ))}
                </Box>
                <Skeleton variant="rounded" width={145} height={32} />
              </Stack>
              <Skeleton variant="text" width="85%" height={18} />
            </Stack>
          )}
          {pickMessage && (
            <Typography variant="caption">{pickMessage}</Typography>
          )}
          {picked && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ flex: 1 }}>
                {coordinates.map(({ key, value }) => (
                  <Typography key={key} variant="body2">
                    {key} :{" "}
                    {Math.abs(value) < 0.0005
                      ? "0,000"
                      : value.toLocaleString("fr-FR", {
                          minimumFractionDigits: 3,
                          maximumFractionDigits: 3,
                        })}{" "}
                    m
                  </Typography>
                ))}
              </Box>
              <Button onClick={() => onPlace({ origin: picked.point })}>
                Mettre à l’origine
              </Button>
            </Stack>
          )}
          {picked && (
            <Typography variant="caption" color="text.secondary">
              {picked.neighbourCount?.toLocaleString("fr-FR")} points dans le
              cube.{" "}
              {picked.normal
                ? `Plan soutenu par ${Math.round(picked.support * 100)} % des points analysés.`
                : "Centre du point ; aucun plan fiable."}
            </Typography>
          )}
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Axe X du modèle</Typography>
          <ScanProjectionPreview
            projection={projection}
            onRotate={onRotate}
            showProjectionTools={false}
          />
          {projection.result && !projection.current && (
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <Button
                size="small"
                variant="contained"
                disabled={!projection.canCalculate}
                onClick={projection.calculate}
              >
                {projection.pending ? "Calcul…" : "Calculer la projection"}
              </Button>
            </Box>
          )}
          <Typography variant="caption">
            Rotation : {placement.yaw.toFixed(1)}°. L’axe choisi dans l’image
            fait pivoter le modèle 3D autour de son origine.
          </Typography>
          <Button
            disabled={placement.yaw === 0}
            onClick={() => onPlace({ yaw: 0 })}
          >
            Réinitialiser la rotation
          </Button>
        </Stack>
      </WhiteSectionGeneric>
    </>
  );
}
