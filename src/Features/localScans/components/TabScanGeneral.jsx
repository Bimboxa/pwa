/* eslint-disable react/prop-types */
import {
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ScanProjectionPreview from "./ScanProjectionPreview";
import ButtonCreateScanBaseMap from "./ButtonCreateScanBaseMap";

// « Général » tab of the Scan 3D tool: model display and base map creation.
export default function TabScanGeneral({
  loaded,
  view,
  mode,
  pointSize,
  modelVisible,
  projection,
  onToggleVisible,
  onChangeMode,
  onChangePointSize,
  onDownload,
}) {
  // render
  return (
    <>
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
            {mode === "POINTS" && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ whiteSpace: "nowrap" }}
                >
                  Taille des points
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={pointSize}
                  aria-label="Taille des points"
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
            )}
          </Stack>
          {loaded.kind === "SPLAT" && (
            <Typography variant="caption" color="text.secondary">
              Les points sont les centres des gaussiennes, pas un relevé laser.
            </Typography>
          )}
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Stack spacing={1}>
          <Typography variant="subtitle2">Image projetée</Typography>
          <ScanProjectionPreview
            projection={projection}
            onDownload={onDownload}
          />
          <ButtonCreateScanBaseMap
            projection={projection}
            view={view}
            modelName={loaded.name}
            resourceId={loaded.resourceId}
          />
        </Stack>
      </WhiteSectionGeneric>
    </>
  );
}
