/* eslint-disable react/prop-types */
import {
  Box,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ScanProjectionPreview from "./ScanProjectionPreview";

export default function LocalScanSliceSection({ projection, onDownload }) {
  const { domain, verticalKey, lower, upper, changeRange, clip, setClip } =
    projection;
  function commit(index, input) {
    const value = Number(input.value);
    if (!input.value || !Number.isFinite(value)) {
      input.value = String(index === 0 ? lower : upper);
      return;
    }
    const bounded = Math.max(domain.min, Math.min(domain.max, value));
    changeRange(
      index === 0
        ? [Math.min(bounded, upper), upper]
        : [lower, Math.max(bounded, lower)]
    );
  }
  const limitField = (index, value) => (
    <TextField
      key={`${verticalKey}:${index}:${value}`}
      label={index ? "Z sup (m)" : "Z inf (m)"}
      type="number"
      size="small"
      defaultValue={+value.toFixed(3)}
      sx={{
        width: 84,
        "& .MuiInputBase-root": { height: 32, fontSize: "0.8125rem" },
        "& .MuiInputBase-input": { px: 1, py: 0.5 },
      }}
      slotProps={{
        htmlInput: { step: 0.01, min: domain.min, max: domain.max },
      }}
      onBlur={(event) => commit(index, event.target)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.target.blur();
      }}
    />
  );
  return (
    <Stack spacing={1.5}>
      <WhiteSectionGeneric>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Tranche et image projetée</Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "84px minmax(0, 1fr)",
              gap: 1,
            }}
          >
            <Stack spacing={0.5} alignItems="center">
              {limitField(1, upper)}
              <Typography variant="caption">
                {domain.max.toFixed(2)} m
              </Typography>
              <Box sx={{ height: 230, py: 1 }}>
                <Slider
                  orientation="vertical"
                  value={[lower, upper]}
                  min={domain.min}
                  max={domain.max}
                  step={0.01}
                  disableSwap
                  valueLabelDisplay="auto"
                  getAriaLabel={(index) => (index ? "Z sup" : "Z inf")}
                  valueLabelFormat={(value) => `${value.toFixed(2)} m`}
                  onChange={(_, values) => changeRange(values)}
                  sx={{
                    color: "#00a6c7",
                    '& .MuiSlider-thumb[data-index="0"]': { color: "#ff610d" },
                  }}
                />
              </Box>
              <Typography variant="caption">
                {domain.min.toFixed(2)} m
              </Typography>
              {limitField(0, lower)}
            </Stack>
            <ScanProjectionPreview
              projection={projection}
              onDownload={onDownload}
            />
          </Box>
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Repérage dans la scène 3D</Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={clip}
                onChange={(_, checked) => setClip(checked)}
              />
            }
            label="Masquer les points hors de la tranche en 3D"
            sx={{
              m: 0,
              gap: 0.5,
              "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
            }}
          />
        </Stack>
      </WhiteSectionGeneric>
    </Stack>
  );
}
