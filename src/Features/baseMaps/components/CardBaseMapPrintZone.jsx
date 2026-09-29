import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setShowPrintZone } from "Features/baseMaps/baseMapsSlice";

import {
  Box,
  Button,
  IconButton,
  InputBase,
  MenuItem,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CropLandscape as LandscapeIcon,
  CropPortrait as PortraitIcon,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";

import useUpdateBaseMapPrintZone from "../hooks/useUpdateBaseMapPrintZone";
import {
  toggleGroupSx,
  numberInputSx,
} from "Features/annotations/constants/fieldSx";
import {
  PRINT_ZONE_FORMATS,
  applyPrintZoneFormatChange,
  formatPrintZoneScale,
  getScaleFromPrintZone,
} from "../utils/printZone";

// Compact « Zone d'impression » card of the base map properties panel:
// title + visibility toggle of the dashed sheet (hidden by default), ONE row
// with the sheet format, its orientation and the 1:N scale, and « Voir
// plus » opening the full sub-panel (PanelBaseMapPrintZone). Same write path
// / change rules as SectionBaseMapPrintZone. Hidden for photo base maps.
export default function CardBaseMapPrintZone({ baseMap, onSeeMore }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Zone d'impression";
  const showS = "Afficher la zone d'impression";
  const hideS = "Masquer la zone d'impression";
  const landscapeS = "Paysage";
  const portraitS = "Portrait";
  const scaleS = "Éch. 1 /";
  const seeMoreS = "Voir plus";

  // data

  const showPrintZone = useSelector((s) => s.baseMaps.showPrintZone);
  const updatePrintZone = useUpdateBaseMapPrintZone();

  // helpers

  const zone = baseMap?.getPrintZone?.() ?? null;
  const meterByPx = baseMap?.getMeterByPx?.();
  const derivedScale = zone ? getScaleFromPrintZone(zone, meterByPx) : null;
  const effectiveScale = zone?.scale > 0 ? zone.scale : derivedScale;
  const scaleText = effectiveScale ? formatPrintZoneScale(effectiveScale) : "";

  // state — scale input text, committed on blur / Enter

  const [scaleInput, setScaleInput] = useState(scaleText);
  useEffect(() => {
    setScaleInput(scaleText);
  }, [scaleText]);

  // handlers

  function handleToggleVisibility() {
    dispatch(setShowPrintZone(!showPrintZone));
  }

  function handleFormatChange(e) {
    const format = e.target.value;
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

  function handleScaleCommit() {
    const raw = String(scaleInput ?? "")
      .replace(",", ".")
      .trim();
    const parsed = raw === "" ? null : Number(raw);
    const scale = parsed > 0 && Number.isFinite(parsed) ? parsed : null;
    // unchanged text (stored or derived value) → no-op
    if (raw === scaleText) return;
    if (scale === (zone.scale ?? null)) {
      setScaleInput(scaleText);
      return;
    }
    updatePrintZone(
      baseMap.id,
      applyPrintZoneFormatChange(zone, { scale, meterByPx })
    );
  }

  // render

  if (!baseMap || baseMap.isPhoto || !zone) return null;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pl: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {titleS}
          </Typography>
          <Tooltip title={showPrintZone ? hideS : showS}>
            <IconButton size="small" onClick={handleToggleVisibility}>
              {showPrintZone ? (
                <Visibility fontSize="small" />
              ) : (
                <VisibilityOff fontSize="small" color="disabled" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            pl: 1,
          }}
        >
          <Select
            value={zone.format}
            onChange={handleFormatChange}
            size="small"
            variant="standard"
            disableUnderline
            sx={{ fontSize: "0.8rem", minWidth: 48 }}
          >
            {PRINT_ZONE_FORMATS.map((f) => (
              <MenuItem key={f} value={f} sx={{ fontSize: "0.85rem" }}>
                {f}
              </MenuItem>
            ))}
          </Select>

          <ToggleButtonGroup
            value={zone.orientation}
            exclusive
            onChange={handleOrientationChange}
            size="small"
            sx={toggleGroupSx}
          >
            <ToggleButton value="landscape" aria-label={landscapeS}>
              <Tooltip title={landscapeS}>
                <LandscapeIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="portrait" aria-label={portraitS}>
              <Tooltip title={portraitS}>
                <PortraitIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" noWrap>
              {scaleS}
            </Typography>
            <InputBase
              value={scaleInput}
              onChange={(e) => setScaleInput(e.target.value)}
              onBlur={handleScaleCommit}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.target.blur();
              }}
              placeholder="50"
              sx={{
                ...numberInputSx,
                ...(!(zone.scale > 0) && { color: "text.secondary" }),
              }}
            />
          </Box>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" onClick={onSeeMore}>
            {seeMoreS}
          </Button>
        </Box>
      </Box>
    </WhiteSectionGeneric>
  );
}
