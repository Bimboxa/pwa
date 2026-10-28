/* eslint-disable react/prop-types */
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CropLandscape,
  CropPortrait,
  FileDownloadOutlined,
  Terrain,
} from "@mui/icons-material";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import LocalScanSlicePreview from "./LocalScanSlicePreview";

// « Tranche et image projetée » section of the Scan 3D tool: the slice
// (two-handle vertical slider over the image, Z limits below it), the
// projected image (the one « Mettre à jour » writes — its framing, format,
// zoom and pan are the base map image), the density / colours choice, the
// download and the 3D clipping of the points outside the slice.
// boundsIn3d / onBoundsIn3dChange: « Voir en 3D » — the coloured points
// near the two cut planes in the 3D scene.
// heightMapOptions / onHeightMapOptionsChange: « Carte de profondeur » —
// whether the points below Z inf / above Z sup feed the height map of the
// base map (altimetry under the cursor) at the next update.
export default function SectionScanSlice({
  projection,
  onDownload,
  boundsIn3d = true,
  onBoundsIn3dChange,
  heightMapOptions,
  onHeightMapOptionsChange,
}) {
  const {
    domain,
    verticalKey,
    lower,
    upper,
    changeRange,
    clip,
    setClip,
    result,
    mode,
    setMode,
    pending,
    current,
    error,
    heightMapVisible,
    setHeightMapVisible,
    heightPreview,
    heightPending,
  } = projection;

  // helpers

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
        width: 96,
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

  // render

  const sliderOverlay = (
    <Paper
      elevation={0}
      sx={{
        position: "absolute",
        top: 8,
        bottom: 8,
        left: 8,
        width: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        py: 0.5,
        bgcolor: "rgba(255,255,255,0.85)",
        borderRadius: 1,
      }}
    >
      <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1.2 }}>
        {domain.max.toFixed(1)}
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, py: 1, display: "flex" }}>
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
      <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1.2 }}>
        {domain.min.toFixed(1)}
      </Typography>
    </Paper>
  );

  const overlaySx = {
    bgcolor: "background.paper",
    boxShadow: 1,
    "& .MuiToggleButton-root": {
      px: 1,
      py: 0.25,
      fontSize: "0.75rem",
    },
  };
  const modeToggle = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <ToggleButtonGroup
        exclusive
        size="small"
        disabled={!result}
        aria-label="Type d’image projetée"
        value={mode}
        onChange={(_, value) => value && setMode(value)}
        sx={overlaySx}
      >
        <ToggleButton value="density">Densité</ToggleButton>
        <ToggleButton value="rgb">Couleurs</ToggleButton>
      </ToggleButtonGroup>
      {/* Heat map of the heights seen from above (the base map height map
          to come, same filter as « Carte de profondeur »). */}
      <Tooltip
        title={
          heightMapVisible
            ? "Masquer la carte de profondeur"
            : "Afficher la carte de profondeur"
        }
      >
        <span>
          <ToggleButton
            value="height"
            size="small"
            selected={heightMapVisible}
            disabled={!result || !current}
            aria-label="Carte de profondeur"
            onChange={() => setHeightMapVisible(!heightMapVisible)}
            sx={{ ...overlaySx, px: 0.75, py: 0.25 }}
          >
            <Terrain fontSize="small" />
          </ToggleButton>
        </span>
      </Tooltip>
    </Stack>
  );

  const orientationToggle = (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={projection.previewOrientation}
      aria-label="Format de l’image"
      sx={{ "& .MuiToggleButton-root": { py: 0.25 } }}
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
    <WhiteSectionGeneric>
      <Stack spacing={1}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="subtitle2">Tranche et image projetée</Typography>
          {orientationToggle}
        </Stack>
        <LocalScanSlicePreview
          result={result}
          mode={mode}
          pending={pending}
          stale={Boolean(result && (!current || error))}
          aspectRatio={
            projection.previewOrientation === "PORTRAIT" ? 210 / 297 : 297 / 210
          }
          overlayControls={modeToggle}
          sideControls={sliderOverlay}
          onFramingChange={projection.setFraming}
          heightPreview={heightPreview}
        />
        {heightMapVisible && current && (
          <Typography variant="caption" color="text.secondary">
            {heightPending
              ? "Carte de profondeur en cours…"
              : heightPreview?.count
                ? `Carte de profondeur : du clair (${heightPreview.min.toFixed(2)} m) au foncé (${heightPreview.max.toFixed(2)} m), point le plus haut vu de dessus.`
                : "Carte de profondeur : aucun point dans l’intervalle choisi."}
          </Typography>
        )}
        {/* Z limits aligned with « Calculer » */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 1 }}>
          {limitField(0, lower)}
          {limitField(1, upper)}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={boundsIn3d}
                onChange={(_, checked) => onBoundsIn3dChange?.(checked)}
              />
            }
            label="Voir en 3D"
            sx={{
              m: 0,
              ml: 0.5,
              gap: 0.5,
              whiteSpace: "nowrap",
              "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
            }}
          />
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="contained"
            disabled={!projection.canCalculate}
            onClick={projection.calculate}
          >
            {pending ? "Calcul…" : "Calculer"}
          </Button>
        </Stack>
        {result && (
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
                : pending
                  ? "Calcul en cours… aperçu précédent."
                  : "Tranche modifiée : cliquez sur Calculer."}
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
        {heightMapOptions && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ flexWrap: "wrap", rowGap: 0.5 }}
          >
            <Typography variant="caption" color="text.secondary">
              Carte de profondeur :
            </Typography>
            {[
              ["includeBelow", "points sous Z inf"],
              ["includeAbove", "points au-dessus de Z sup"],
            ].map(([key, label]) => (
              <FormControlLabel
                key={key}
                control={
                  <Checkbox
                    size="small"
                    checked={Boolean(heightMapOptions[key])}
                    onChange={(_, checked) =>
                      onHeightMapOptionsChange?.({
                        ...heightMapOptions,
                        [key]: checked,
                      })
                    }
                    sx={{ p: 0.5 }}
                  />
                }
                label={label}
                sx={{
                  m: 0,
                  "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" },
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </WhiteSectionGeneric>
  );
}
