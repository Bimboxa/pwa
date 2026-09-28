import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import {
  Box,
  Button,
  Tooltip,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import {
  CropLandscape as LandscapeIcon,
  CropPortrait as PortraitIcon,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldTextV2 from "Features/form/components/FieldTextV2";

import useUpdateBaseMapPrintZone from "../hooks/useUpdateBaseMapPrintZone";
import db from "App/db/db";
import {
  PRINT_ZONE_FORMATS,
  applyPrintZoneFormatChange,
  centerPrintZoneOnImage,
  fitPrintZoneToImage,
  formatPrintZoneScale,
  getMeterByPxFromPrintZone,
  getPdfPagePrintZone,
  getScaleFromPrintZone,
} from "../utils/printZone";

// « Zone d'impression » of a base map: the physical sheet (format,
// orientation, optional 1:N scale) the image is positioned on. Every base
// map has one (stored, else resolved from the PDF page / A3 landscape by
// BaseMap.getPrintZone); « Réinitialiser » drops the stored one. The image
// is also dragged on the sheet in the map editor (PrintZoneLayer); both go
// through useUpdateBaseMapPrintZone. Hidden for photo base maps.
export default function SectionBaseMapPrintZone({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Zone d'impression";
  const defaultPdfS = "Par défaut : page du PDF";
  const defaultS = "Par défaut : A3 paysage ajusté à l'image";
  const formatS = "Format";
  const orientationS = "Orientation";
  const landscapeS = "Paysage";
  const portraitS = "Portrait";
  const scaleS = "Échelle";
  const freeS = "libre";
  const lockedS = "Taille fixée par l'échelle";
  const notAppliedS = "Échelle non appliquée au fond de plan";
  const fitS = "Ajuster la feuille à l'image";
  const fitDisabledS = "Videz l'échelle pour ajuster la feuille à l'image";
  const centerS = "Centrer l'image";
  const applyScaleS = "Appliquer l'échelle au fond de plan";
  const applyScaleHintS =
    "Calibre le fond de plan pour que la zone soit imprimée à cette échelle";
  const resetS = "Réinitialiser";

  // data

  const updatePrintZone = useUpdateBaseMapPrintZone();

  // helpers

  const zone = baseMap?.getPrintZone?.() ?? null;
  const isStored = Boolean(baseMap?.printZone);
  const imageSize = baseMap?.getImageSize?.();
  const isDefaultFromPdf =
    !isStored &&
    Boolean(
      getPdfPagePrintZone({ createdFrom: baseMap?.createdFrom, imageSize })
    );
  const meterByPx = baseMap?.getMeterByPx?.();
  const hasMeterByPx = meterByPx > 0;
  const locked = Boolean(zone?.scale > 0 && hasMeterByPx);
  const derivedScale = zone ? getScaleFromPrintZone(zone, meterByPx) : null;
  const scaleMismatch =
    zone?.scale > 0 &&
    (!hasMeterByPx || Math.abs(derivedScale - zone.scale) > 1e-6);

  const sizeS = zone
    ? `${Math.round(zone.width)} × ${Math.round(zone.height)} px` +
      (derivedScale ? ` — 1 : ${formatPrintZoneScale(derivedScale)}` : "")
    : "";

  // handlers

  function handleFormatChange(_, format) {
    if (!format || format === zone.format) return;
    updatePrintZone(
      baseMap.id,
      applyPrintZoneFormatChange(zone, { format, meterByPx })
    );
  }

  function handleOrientationChange(_, orientation) {
    if (!orientation || orientation === zone.orientation) return;
    updatePrintZone(
      baseMap.id,
      applyPrintZoneFormatChange(zone, { orientation, meterByPx })
    );
  }

  function handleScaleChange(value) {
    const raw = String(value ?? "")
      .replace(",", ".")
      .trim();
    const parsed = raw === "" ? null : Number(raw);
    const scale = parsed > 0 && Number.isFinite(parsed) ? parsed : null;
    if (scale === (zone.scale ?? null)) return;
    updatePrintZone(
      baseMap.id,
      applyPrintZoneFormatChange(zone, { scale, meterByPx })
    );
  }

  function handleFit() {
    const rect = fitPrintZoneToImage({
      format: zone.format,
      orientation: zone.orientation,
      imageSize,
    });
    if (rect) updatePrintZone(baseMap.id, { ...zone, ...rect });
  }

  function handleCenter() {
    updatePrintZone(baseMap.id, centerPrintZoneOnImage(zone, imageSize));
  }

  // Inverse calibration: the sheet IS a 1:N print of the plan → meterByPx.
  // Same side effects as FieldBaseMapBlueprintScale (quantities refresh).
  async function handleApplyScale() {
    const next = getMeterByPxFromPrintZone(zone);
    if (!(next > 0)) return;
    await db.baseMaps.update(baseMap.id, { meterByPx: next });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  }

  function handleReset() {
    updatePrintZone(baseMap.id, null);
  }

  // render

  if (!baseMap || baseMap.isPhoto || !zone) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
          {titleS}
        </Typography>
        {!isStored && (
          <Typography variant="caption" color="text.secondary">
            {isDefaultFromPdf ? defaultPdfS : defaultS}
          </Typography>
        )}

        <Box>
          <Typography variant="caption" color="text.secondary">
            {formatS}
          </Typography>
          <ToggleButtonGroup
            value={zone.format}
            exclusive
            onChange={handleFormatChange}
            size="small"
            fullWidth
          >
            {PRINT_ZONE_FORMATS.map((f) => (
              <ToggleButton key={f} value={f}>
                <Typography variant="body2">{f}</Typography>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary">
            {orientationS}
          </Typography>
          <ToggleButtonGroup
            value={zone.orientation}
            exclusive
            onChange={handleOrientationChange}
            size="small"
            fullWidth
          >
            <ToggleButton value="landscape">
              <LandscapeIcon fontSize="small" sx={{ mr: 0.5 }} />
              <Typography variant="body2">{landscapeS}</Typography>
            </ToggleButton>
            <ToggleButton value="portrait">
              <PortraitIcon fontSize="small" sx={{ mr: 0.5 }} />
              <Typography variant="body2">{portraitS}</Typography>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <FieldTextV2
          label={scaleS}
          value={zone.scale > 0 ? formatPrintZoneScale(zone.scale) : ""}
          onChange={handleScaleChange}
          options={{
            showAsLabelAndField: true,
            changeOnBlur: true,
            hideMic: true,
            startAdornment: "1 :",
            placeholder: derivedScale
              ? formatPrintZoneScale(derivedScale)
              : freeS,
          }}
        />
        {locked && !scaleMismatch && (
          <Typography variant="caption" color="text.secondary">
            {lockedS}
          </Typography>
        )}
        {scaleMismatch && (
          <Typography variant="caption" color="warning.main">
            {notAppliedS}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary">
          {sizeS}
        </Typography>

        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Tooltip title={locked ? fitDisabledS : ""}>
            <span>
              <Button
                size="small"
                variant="outlined"
                onClick={handleFit}
                disabled={locked}
              >
                {fitS}
              </Button>
            </span>
          </Tooltip>
          <Button size="small" variant="outlined" onClick={handleCenter}>
            {centerS}
          </Button>
          {scaleMismatch && (
            <Tooltip title={applyScaleHintS}>
              <Button
                size="small"
                variant="contained"
                onClick={handleApplyScale}
              >
                {applyScaleS}
              </Button>
            </Tooltip>
          )}
        </Box>

        {isStored && (
          <Button
            size="small"
            onClick={handleReset}
            sx={{ alignSelf: "flex-start" }}
          >
            {resetS}
          </Button>
        )}
      </Box>
    </WhiteSectionGeneric>
  );
}
