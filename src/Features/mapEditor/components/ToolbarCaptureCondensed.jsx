import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import {
  setCapturePanelCondensed,
  setImageModeAspectRatio,
  setImageModeBorder,
  setImageModeExportMode,
  setImageModeLegendOverlay,
  setImageModePageFormat,
  setImageModeTitle,
} from "../mapEditorSlice";

import { selectCaptureHostViewerKey } from "Features/viewers/utils/effectiveViewerKey";

import {
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowDropDown,
  BorderOuter,
  Close,
  ContentCopy,
  CropLandscape,
  CropPortrait,
  CropSquare,
  Image as ImageIcon,
  ListAlt,
  Numbers,
  PhotoCamera,
  PictureAsPdf,
  Title,
  Tune,
  Wallpaper,
} from "@mui/icons-material";

import useExitCaptureTool from "../hooks/useExitCaptureTool";

// Width of the condensed band — read by RightPanelContainer to size the
// drawer when the capture tool is in its condensed format.
export const CAPTURE_TOOLBAR_WIDTH = 70;

const ASPECT_RATIO_OPTIONS = [
  { value: "LANDSCAPE", label: "Paysage", icon: <CropLandscape /> },
  { value: "SQUARE", label: "Carré", icon: <CropSquare /> },
  { value: "PORTRAIT", label: "Portrait", icon: <CropPortrait /> },
  // Frame ratio locked on the active base map's image ratio
  // (useCaptureAspectRatio resolves it to a number).
  { value: "BASE_MAP", label: "Fond de plan", icon: <Wallpaper /> },
];

// A4 and A3 share the same √2 aspect ratio: the frame on screen is identical,
// only the PDF export page size changes. Text-based "icons" (no crop icon
// carries the page size).
const pageFormatIconSx = { fontSize: 14, fontWeight: 600, lineHeight: 1 };
const PAGE_FORMAT_OPTIONS = [
  {
    value: "A4",
    label: "A4",
    icon: <Typography sx={pageFormatIconSx}>A4</Typography>,
  },
  {
    value: "A3",
    label: "A3",
    icon: <Typography sx={pageFormatIconSx}>A3</Typography>,
  },
];

const EXPORT_MODE_OPTIONS = [
  { value: "pdf", label: "PDF", icon: <PictureAsPdf /> },
  { value: "png", label: "PNG", icon: <ImageIcon /> },
  { value: "clipboard", label: "Presse-papier", icon: <ContentCopy /> },
  { value: "pov", label: "Point de vue", icon: <PhotoCamera /> },
];

const ITEM_SX = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.25,
  width: 1,
  py: 1,
  px: 0.5,
  color: "common.white",
  transition: "all 0.15s ease",
  "&:hover": { opacity: 1, bgcolor: "rgba(255,255,255,0.08)" },
};

const LABEL_SX = {
  color: "common.white",
  fontSize: "0.65rem",
  lineHeight: 1.2,
  textAlign: "center",
};

// One button of the band: icon over a small white caption. `active` renders
// the "pressed" state of the toggles (same visual language as
// VerticalMenuViewers: full opacity + translucent white background).
function ToolbarButton({ icon, label, tooltip, active, onClick }) {
  return (
    <Tooltip title={tooltip ?? label} placement="left">
      <ButtonBase
        onClick={onClick}
        sx={{
          ...ITEM_SX,
          opacity: active === false ? 0.5 : 1,
          bgcolor: active ? "rgba(255,255,255,0.16)" : "transparent",
        }}
      >
        <Box sx={{ fontSize: 22, display: "flex", alignItems: "center" }}>
          {icon}
        </Box>
        <Typography variant="caption" sx={LABEL_SX}>
          {label}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

// Recap icon of the current value + a small arrow opening the option menu.
function ToolbarSelect({ label, tooltip, options, value, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  const selected = options.find((option) => option.value === value);

  function handleSelect(option) {
    setAnchorEl(null);
    if (option.value !== value) onChange(option.value);
  }

  return (
    <>
      <Tooltip title={tooltip ?? label} placement="left">
        <ButtonBase onClick={(e) => setAnchorEl(e.currentTarget)} sx={ITEM_SX}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <Box sx={{ fontSize: 22, display: "flex", alignItems: "center" }}>
              {selected?.icon}
            </Box>
            <ArrowDropDown sx={{ fontSize: 16, ml: -0.25 }} />
          </Box>
          <Typography variant="caption" sx={LABEL_SX}>
            {label}
          </Typography>
        </ButtonBase>
      </Tooltip>

      <Menu
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "center", horizontal: "left" }}
        transformOrigin={{ vertical: "center", horizontal: "right" }}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            dense
            selected={option.value === value}
            disabled={option.disabled}
            onClick={() => handleSelect(option)}
          >
            <ListItemIcon>{option.icon}</ListItemIcon>
            <ListItemText>{option.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function BandDivider() {
  return (
    <Divider
      flexItem
      sx={{
        width: "60%",
        alignSelf: "center",
        borderColor: "rgba(255,255,255,0.2)",
      }}
    />
  );
}

// Condensed format of the capture tool's right panel: a black band of icon
// buttons for the options used while framing (frame, border, title, legend,
// export format), grouped by dividers. The full tabbed panel
// (PanelCaptureTool) stays one click away via "Options"; every other setting
// (file name, high definition, logo, labels, filters) lives there only.
export default function ToolbarCaptureCondensed() {
  const dispatch = useDispatch();

  // strings

  const closeS = "Fermer";
  const frameS = "Cadre";
  const pageFormatS = "Format";
  const borderS = "Bordure";
  const titleS = "Titre";
  const legendS = "Légende";
  const qtiesS = "Qtés";
  const exportS = "Export";
  const optionsS = "Options";

  // data

  const aspectRatio = useSelector((s) => s.mapEditor.imageModeAspectRatio);
  const pageFormat = useSelector((s) => s.mapEditor.imageModePageFormat);
  const border = useSelector((s) => s.mapEditor.imageModeBorder);
  const title = useSelector((s) => s.mapEditor.imageModeTitle);
  const legendOverlay = useSelector((s) => s.mapEditor.imageModeLegendOverlay);
  const exportMode = useSelector((s) => s.mapEditor.imageModeExportMode);
  const hostViewerKey = useSelector(selectCaptureHostViewerKey);

  // helpers

  const titleVisible = Boolean(title?.visible);
  const legendVisible = legendOverlay?.visible ?? true;
  const showQty = legendOverlay?.showQty ?? true;

  // The "Point de vue" mode captures through useCapturePovView, which only
  // knows the MAP and THREED hosts.
  const povModeAvailable =
    hostViewerKey === "MAP" || hostViewerKey === "THREED";
  const exportOptions = EXPORT_MODE_OPTIONS.map((option) =>
    option.value === "pov" ? { ...option, disabled: !povModeAvailable } : option
  );

  // handlers

  const exitCaptureTool = useExitCaptureTool();

  function handleToggleBorder() {
    dispatch(setImageModeBorder(!border));
  }

  function handleToggleTitle() {
    dispatch(setImageModeTitle({ visible: !titleVisible }));
  }

  // setImageModeLegendOverlay replaces the whole object: spread the current one
  function handleToggleLegend() {
    dispatch(
      setImageModeLegendOverlay({ ...legendOverlay, visible: !legendVisible })
    );
  }

  function handleToggleShowQty() {
    dispatch(
      setImageModeLegendOverlay({ ...legendOverlay, showQty: !showQty })
    );
  }

  // render

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        bgcolor: "common.black",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.5,
        py: 1,
        overflowY: "auto",
      }}
    >
      {/* 1. quitter le mode capture */}
      <ToolbarButton
        icon={<Close />}
        label={closeS}
        tooltip="Quitter le mode capture"
        onClick={exitCaptureTool}
      />

      <BandDivider />

      {/* 2. paramètres du cadre */}
      <ToolbarSelect
        label={frameS}
        tooltip="Format du cadre"
        options={ASPECT_RATIO_OPTIONS}
        value={aspectRatio}
        onChange={(value) => dispatch(setImageModeAspectRatio(value))}
      />
      <ToolbarSelect
        label={pageFormatS}
        tooltip="Format de la page PDF"
        options={PAGE_FORMAT_OPTIONS}
        value={pageFormat}
        onChange={(value) => dispatch(setImageModePageFormat(value))}
      />
      <ToolbarButton
        icon={<BorderOuter />}
        label={borderS}
        tooltip={border ? "Masquer la bordure" : "Afficher la bordure"}
        active={border}
        onClick={handleToggleBorder}
      />
      <ToolbarButton
        icon={<Title />}
        label={titleS}
        tooltip={titleVisible ? "Masquer le titre" : "Afficher le titre"}
        active={titleVisible}
        onClick={handleToggleTitle}
      />

      <BandDivider />

      {/* 3. bloc légende */}
      <ToolbarButton
        icon={<ListAlt />}
        label={legendS}
        tooltip={legendVisible ? "Masquer la légende" : "Afficher la légende"}
        active={legendVisible}
        onClick={handleToggleLegend}
      />
      <ToolbarButton
        icon={<Numbers />}
        label={qtiesS}
        tooltip={showQty ? "Masquer les quantités" : "Afficher les quantités"}
        active={showQty}
        onClick={handleToggleShowQty}
      />

      <BandDivider />

      {/* 4. format d'export */}
      <ToolbarSelect
        label={exportS}
        tooltip="Format d'export"
        options={exportOptions}
        value={exportMode}
        onChange={(value) => dispatch(setImageModeExportMode(value))}
      />

      <BandDivider />

      {/* 5. panneau complet */}
      <ToolbarButton
        icon={<Tune />}
        label={optionsS}
        tooltip="Plus d'options"
        onClick={() => dispatch(setCapturePanelCondensed(false))}
      />
    </Box>
  );
}
