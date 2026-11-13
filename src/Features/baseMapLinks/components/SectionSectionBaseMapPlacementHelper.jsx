import { useDispatch, useSelector } from "react-redux";

import {
  SECTION_BASE_MAP_MODES,
  selectSectionBaseMapPlacement,
  setSectionBaseMapPlacementParams,
} from "../sectionBaseMapPlacementSlice";

import {
  Box,
  ListSubheader,
  MenuItem,
  Paper,
  Select,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CropLandscape as LandscapeIcon,
  CropPortrait as PortraitIcon,
  CropSquare as SquareIcon,
} from "@mui/icons-material";

import SectionTransformToolHelper from "Features/annotationTransform/components/SectionTransformToolHelper";

import {
  FORMATS,
  SCALES,
  SIZES,
} from "Features/baseMaps/utils/getBlankBaseMapGeometry";

import useSectionBaseMapListing from "../hooks/useSectionBaseMapListing";
import useVerticalBaseMapsByListing from "../hooks/useVerticalBaseMapsByListing";

const SHORTCUTS = [
  { key: "Glisser", label: "Déplacer le fond de plan dans le plan de coupe" },
  { key: "Espace", label: "Créer le fond de plan" },
  { key: "Esc", label: "Annuler" },
];
const SHORTCUTS_EXISTING = [
  SHORTCUTS[0],
  { key: "Espace", label: "Poser le fond de plan" },
  SHORTCUTS[2],
];

const FORMAT_ICONS = {
  paysage: LandscapeIcon,
  carre: SquareIcon,
  portrait: PortraitIcon,
};
const FORMAT_LABELS = {
  paysage: "Paysage",
  carre: "Carré",
  portrait: "Portrait",
};

const ROW_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 36,
};
const TOGGLE_SX = { textTransform: "none", px: 1, py: 0.25 };

const hasScale = (baseMap) => {
  const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
  return Number.isFinite(meterByPx) && meterByPx > 0;
};

// ---------------------------------------------------------------------------
// SectionSectionBaseMapPlacementHelper — drawing-helper body of the
// « + fond de plan » command of a section mark (see
// sectionBaseMapPlacementSlice): the page to stand in the vertical plane of
// the mark — a new blank page (name, format, size, scale, folder: the fields
// of DialogCreateBlankBaseMap) or an existing vertical base map of the scope
// — and the shortcuts. The 3D preview follows every change
// (useSectionBaseMapPlacement).
// ---------------------------------------------------------------------------

export default function SectionSectionBaseMapPlacementHelper() {
  const dispatch = useDispatch();

  // strings

  const hintS =
    "Glissez le fond de plan dans le plan du trait de coupe, puis Espace pour valider";
  const blankS = "Page blanche";
  const existingS = "Fond de plan existant";
  const nameS = "Nom";
  const formatS = "Format";
  const sizeS = "Taille";
  const scaleS = "Échelle";
  const folderS = "Dossier";
  const baseMapS = "Fond de plan";
  const pickS = "Choisir un fond de plan vertical";
  const noneS =
    "Aucun fond de plan vertical à l'échelle dans ce plan de repérage";
  const noScaleS = "sans échelle";

  // data

  const { mode, name, format, size, scale, existingBaseMapId } = useSelector(
    selectSectionBaseMapPlacement
  );
  const { listings, listing } = useSectionBaseMapListing();
  const { groups } = useVerticalBaseMapsByListing();

  // helpers

  const isExisting = mode === SECTION_BASE_MAP_MODES.EXISTING;
  const hasVerticalBaseMaps = groups.some((g) => g.baseMaps.some(hasScale));

  // handlers

  function setParams(params) {
    dispatch(setSectionBaseMapPlacementParams(params));
  }

  // The 3D key handler ignores a focused control's keys: a toggle gives the
  // keyboard back to the 3D view (Space then validates there).
  function handleToggle(key) {
    return (e, value) => {
      if (value === null || value === undefined) return;
      setParams({ [key]: value });
      e.currentTarget?.blur?.();
    };
  }

  // Enter in the name field gives the keyboard back too.
  function handleKeyDownCapture(e) {
    if (e.target?.tagName !== "INPUT") return;
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  }

  // render

  return (
    <SectionTransformToolHelper
      hint={hintS}
      shortcuts={isExisting ? SHORTCUTS_EXISTING : SHORTCUTS}
    >
      <Paper
        variant="outlined"
        onKeyDownCapture={handleKeyDownCapture}
        sx={{
          px: 1,
          py: 0.75,
          borderRadius: 1,
          bgcolor: "background.paper",
          display: "flex",
          flexDirection: "column",
          gap: 0.5,
          minWidth: 320,
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          fullWidth
          value={mode}
          onChange={handleToggle("mode")}
        >
          <ToggleButton value={SECTION_BASE_MAP_MODES.BLANK} sx={TOGGLE_SX}>
            {blankS}
          </ToggleButton>
          <ToggleButton value={SECTION_BASE_MAP_MODES.EXISTING} sx={TOGGLE_SX}>
            {existingS}
          </ToggleButton>
        </ToggleButtonGroup>

        {!isExisting && (
          <>
            <Box sx={ROW_SX}>
              <Typography variant="body2" color="text.secondary">
                {nameS}
              </Typography>
              <TextField
                size="small"
                variant="standard"
                value={name}
                onChange={(e) => setParams({ name: e.target.value })}
                sx={{ flex: 1, maxWidth: 220 }}
              />
            </Box>
            <Box sx={ROW_SX}>
              <Typography variant="body2" color="text.secondary">
                {formatS}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={format}
                onChange={handleToggle("format")}
              >
                {FORMATS.map((f) => {
                  const Icon = FORMAT_ICONS[f];
                  return (
                    <ToggleButton
                      key={f}
                      value={f}
                      title={FORMAT_LABELS[f]}
                      aria-label={FORMAT_LABELS[f]}
                      sx={TOGGLE_SX}
                    >
                      <Icon fontSize="small" />
                    </ToggleButton>
                  );
                })}
              </ToggleButtonGroup>
            </Box>
            <Box sx={ROW_SX}>
              <Typography variant="body2" color="text.secondary">
                {sizeS}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={size}
                onChange={handleToggle("size")}
              >
                {SIZES.map((s) => (
                  <ToggleButton key={s} value={s} sx={TOGGLE_SX}>
                    {s}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={ROW_SX}>
              <Typography variant="body2" color="text.secondary">
                {scaleS}
              </Typography>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={scale}
                onChange={handleToggle("scale")}
              >
                {SCALES.map((s) => (
                  <ToggleButton key={s} value={s} sx={TOGGLE_SX}>
                    {`1:${s}`}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            {listings.length > 1 && (
              <Box sx={ROW_SX}>
                <Typography variant="body2" color="text.secondary">
                  {folderS}
                </Typography>
                <Select
                  size="small"
                  variant="standard"
                  value={listing?.id ?? ""}
                  onChange={(e) => setParams({ listingId: e.target.value })}
                  onClose={() => document.activeElement?.blur?.()}
                  sx={{ flex: 1, maxWidth: 220 }}
                >
                  {listings.map((l) => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
            )}
          </>
        )}

        {isExisting &&
          (hasVerticalBaseMaps ? (
            <Box sx={ROW_SX}>
              <Typography variant="body2" color="text.secondary">
                {baseMapS}
              </Typography>
              <Select
                size="small"
                variant="standard"
                displayEmpty
                value={existingBaseMapId ?? ""}
                onChange={(e) =>
                  setParams({ existingBaseMapId: e.target.value || null })
                }
                onClose={() => document.activeElement?.blur?.()}
                renderValue={(value) => {
                  const found = groups
                    .flatMap((g) => g.baseMaps)
                    .find((bm) => bm.id === value);
                  return found?.name ?? pickS;
                }}
                sx={{ flex: 1, maxWidth: 220 }}
              >
                {groups.flatMap((group) => [
                  <ListSubheader key={`listing-${group.listing.id}`}>
                    {group.listing.name}
                  </ListSubheader>,
                  ...group.baseMaps.map((bm) => (
                    <MenuItem
                      key={bm.id}
                      value={bm.id}
                      disabled={!hasScale(bm)}
                    >
                      {hasScale(bm) ? bm.name : `${bm.name} (${noScaleS})`}
                    </MenuItem>
                  )),
                ])}
              </Select>
            </Box>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ p: 0.5 }}
            >
              {noneS}
            </Typography>
          ))}
      </Paper>
    </SectionTransformToolHelper>
  );
}
