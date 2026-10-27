/* eslint-disable react/prop-types */
import {
  Box,
  Button,
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
  const {
    domain,
    fullHeight,
    setFullHeight,
    verticalKey,
    lower,
    upper,
    changeRange,
    tolerance,
    setTolerance,
    clip,
    setClip,
    current,
  } = projection;
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
          <Typography variant="caption" color="text.secondary">
            Z en mètres après placement. Orange : Z inf · Bleu : Z sup.
            {fullHeight
              ? " Étendue complète des points, avec 5 % de marge."
              : " Bornes utiles estimées sur les 98 % centraux des hauteurs, avec 5 % de marge."}{" "}
            Écartez le sol et le plafond pour distinguer les parois.
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={fullHeight}
                onChange={(_, value) => setFullHeight(value)}
              />
            }
            label="Inclure les points isolés dans les bornes"
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "100px minmax(0, 1fr)",
              gap: 1,
            }}
          >
            <Stack spacing={1} alignItems="center">
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
            <ScanProjectionPreview projection={projection} />
          </Box>
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Repérage dans la scène 3D</Typography>
          <FormControlLabel
            control={
              <Switch
                checked={clip}
                onChange={(_, checked) => setClip(checked)}
              />
            }
            label="Masquer les points hors de la tranche en 3D"
          />
          <TextField
            label="Tolérance du repérage 3D ± (cm)"
            type="number"
            size="small"
            value={tolerance}
            onChange={(event) =>
              setTolerance(
                Math.max(0.1, Math.min(50, Number(event.target.value) || 0.1))
              )
            }
          />
          <Typography variant="caption" color="text.secondary">
            La tolérance concerne les deux limites colorées. La projection et le
            masquage utilisent exactement Z inf–Z sup. Densité : les pixels
            sombres contiennent davantage de points ; le mobilier peut aussi
            apparaître.
          </Typography>
        </Stack>
      </WhiteSectionGeneric>
      <WhiteSectionGeneric>
        <Typography variant="subtitle2">Exporter les images</Typography>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            disabled={!current}
            onClick={() => onDownload("density")}
          >
            PNG densité
          </Button>
          <Button
            size="small"
            disabled={!current}
            onClick={() => onDownload("rgb")}
          >
            PNG couleurs
          </Button>
        </Stack>
      </WhiteSectionGeneric>
    </Stack>
  );
}
