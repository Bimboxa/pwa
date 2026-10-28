/* eslint-disable react/prop-types */
import {
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

// « Calibration » section of the Scan 3D tool: the source vertical axis,
// the metres per source unit and the vertical offset of the point cloud
// relative to the base map plane (relative to the pose stored on the base
// map; written by « Mettre à jour le fond de plan »).
export default function SectionScanCalibration({
  placement,
  offsetZ,
  disabled = false,
  onPlace,
  onOffsetZChange,
}) {
  // helpers

  function commitOffset(input) {
    const value = Number(input.value);
    if (!input.value || !Number.isFinite(value)) {
      input.value = String(offsetZ);
      return;
    }
    if (value !== offsetZ) onOffsetZChange(value);
  }

  // render
  return (
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
        <Typography variant="subtitle2">Calibration</Typography>
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
            disabled={disabled}
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
            disabled={disabled}
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
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="body2">Décalage Z du scan</Typography>
          <TextField
            key={offsetZ}
            type="number"
            size="small"
            defaultValue={+offsetZ.toFixed(3)}
            disabled={disabled}
            aria-label="Décalage Z du scan"
            sx={{
              width: 96,
              "& .MuiInputBase-root": { height: 32, fontSize: "0.8125rem" },
              "& .MuiInputBase-input": { px: 1, py: 0.5 },
            }}
            slotProps={{
              htmlInput: { step: 0.01 },
              input: {
                endAdornment: (
                  <Typography variant="caption" color="text.secondary">
                    m
                  </Typography>
                ),
              },
            }}
            onBlur={(event) => commitOffset(event.target)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.target.blur();
            }}
          />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Échelle à confirmer avec une distance connue. Le décalage Z déplace le
          nuage par rapport au fond de plan ; il est enregistré par « Mettre à
          jour le fond de plan ».
        </Typography>
      </Stack>
    </WhiteSectionGeneric>
  );
}
