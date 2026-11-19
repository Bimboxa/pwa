import { useDispatch, useSelector } from "react-redux";

import {
  resetPrintZonesZones,
  selectImagesConnector,
  selectImagesPanelColumns,
  selectPrintZonesTileSizeMode,
  selectPrintZonesCaptureZones,
  selectPrintZonesTileSizePx,
  selectPrintZonesZones,
  setImagesConnector,
  setImagesPanelColumns,
  setPrintZonesTileSizeMode,
  setPrintZonesTileSizePx,
} from "../popperImagesSlice";

import {
  Box,
  Button,
  DialogActions,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import FieldImageConnectorStyle from "Features/imageAnnotations/components/FieldImageConnectorStyle";
import ImagesDisplayOptionsPreview from "./ImagesDisplayOptionsPreview";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";
import { IMAGES_DISPLAY_MODE_OPTIONS } from "../constants/imagesDisplayModeOptions";
import {
  PANEL_COLUMNS_OPTIONS,
  PRINT_ZONES_TILE_SIZE_MAX_PX,
  PRINT_ZONES_TILE_SIZE_MIN_PX,
} from "../services/popperImagesLocalStorage";
import { toggleGroupSx } from "Features/annotations/constants/fieldSx";

// ---------------------------------------------------------------------------
// DialogImagesDisplayOptions — "…" of the photos controls in the bottom bar:
// every display option of the photos in one place. Left: the options, one
// white section per topic (display mode, connector — colour, size, end
// marker, line, number on the photo —, and the options of the SELECTED mode only: overlay panel or
// print-zone tiles). Right: a schematic of the result
// (ImagesDisplayOptionsPreview). All of them are per-device settings of
// popperImagesSlice, applied live.
// ---------------------------------------------------------------------------

const rowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 32,
};

// Options with a text label: wider buttons than the icon-only groups.
const labelToggleGroupSx = {
  ...toggleGroupSx,
  "& .MuiToggleButton-root": {
    ...toggleGroupSx["& .MuiToggleButton-root"],
    textTransform: "none",
    gap: 0.5,
    px: 1.25,
    py: 0.5,
    fontSize: "0.75rem",
  },
};

// `action`: controls on the title row, right-aligned.
function Section({ title, action, hint, children }) {
  return (
    <Box
      sx={{
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Box sx={rowSx}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
      {Boolean(hint) && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export default function DialogImagesDisplayOptions({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Options d'affichage des photos";
  const modeS = "Mode d'affichage";
  const connectorS = "Connecteur";
  const panelS = "Panneau (mode overlay)";
  const columnsS = "Colonnes";
  const tilesS = "Vignettes (mode zones)";
  const tileSizeS = "Taille";
  const autoS = "Automatique";
  const fixedS = "Fixe";
  const autoHintS =
    "Automatique : réduite si les photos ne tiennent pas dans leur zone.";
  const resetZonesS = "Réinitialiser les zones";
  const previewS = "Aperçu";
  const closeS = "Fermer";

  // data

  const { displayMode, linkNumber, setDisplayMode, setLinkNumber } =
    useImagesDisplaySettings();
  const connector = useSelector(selectImagesConnector);
  const panelColumns = useSelector(selectImagesPanelColumns);
  const sizeMode = useSelector(selectPrintZonesTileSizeMode);
  const sizePx = useSelector(selectPrintZonesTileSizePx);
  const zones = useSelector(selectPrintZonesZones);
  const captureZones = useSelector(selectPrintZonesCaptureZones);

  // helpers

  const zonesResized =
    Object.keys(zones).length > 0 || Object.keys(captureZones).length > 0;
  const exSitu = displayMode === "EX_SITU";
  const printZones = displayMode === "PRINT_ZONES";
  const modeHint = IMAGES_DISPLAY_MODE_OPTIONS.find(
    (o) => o.key === displayMode
  )?.tooltip;

  // render

  return (
    <DialogGeneric title={titleS} open={open} onClose={onClose} width={780}>
      <Box
        sx={{
          bgcolor: "grey.100",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          gap: 2,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {/* ---- Left: options ---- */}
        <Box
          sx={{
            flex: "1 1 340px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <Section title={modeS} hint={modeHint}>
            <ToggleButtonGroup
              value={displayMode}
              exclusive
              onChange={(_e, mode) => {
                if (mode !== null) setDisplayMode(mode);
              }}
              size="small"
              aria-label={modeS}
              sx={{ ...labelToggleGroupSx, alignSelf: "flex-start" }}
            >
              {IMAGES_DISPLAY_MODE_OPTIONS.map(({ key, label, Icon }) => (
                <ToggleButton key={key} value={key}>
                  <Icon fontSize="small" />
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Section>

          <Section title={connectorS}>
            <FieldImageConnectorStyle
              color={connector.color}
              end={connector.end}
              line={connector.line}
              size={connector.size}
              onChange={(patch) => dispatch(setImagesConnector(patch))}
              showNumber={linkNumber}
              onShowNumberChange={setLinkNumber}
            />
          </Section>

          {exSitu && (
            <Section title={panelS}>
              <Box sx={rowSx}>
                <Typography variant="body2">{columnsS}</Typography>
                <ToggleButtonGroup
                  value={panelColumns}
                  exclusive
                  onChange={(_e, columns) => {
                    if (columns !== null)
                      dispatch(setImagesPanelColumns(columns));
                  }}
                  size="small"
                  aria-label={columnsS}
                  sx={labelToggleGroupSx}
                >
                  {PANEL_COLUMNS_OPTIONS.map((columns) => (
                    <ToggleButton key={columns} value={columns}>
                      {columns}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            </Section>
          )}

          {printZones && (
            <Section title={tilesS} hint={autoHintS}>
              <Box sx={rowSx}>
                <Typography variant="body2">{tileSizeS}</Typography>
                <ToggleButtonGroup
                  value={sizeMode}
                  exclusive
                  onChange={(_e, mode) => {
                    if (mode !== null)
                      dispatch(setPrintZonesTileSizeMode(mode));
                  }}
                  size="small"
                  aria-label={tileSizeS}
                  sx={labelToggleGroupSx}
                >
                  <ToggleButton value="AUTO">{autoS}</ToggleButton>
                  <ToggleButton value="FIXED">{fixedS}</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <Box
                sx={{
                  ...rowSx,
                  gap: 2,
                  opacity: sizeMode === "FIXED" ? 1 : 0.4,
                }}
              >
                <Slider
                  size="small"
                  disabled={sizeMode !== "FIXED"}
                  min={PRINT_ZONES_TILE_SIZE_MIN_PX}
                  max={PRINT_ZONES_TILE_SIZE_MAX_PX}
                  step={8}
                  value={sizePx}
                  onChange={(_e, v) => dispatch(setPrintZonesTileSizePx(v))}
                  sx={{ ml: 1 }}
                />
                <Typography
                  variant="caption"
                  sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}
                >
                  {`${sizePx} px`}
                </Typography>
              </Box>
              <Button
                size="small"
                variant="outlined"
                disabled={!zonesResized}
                onClick={() => dispatch(resetPrintZonesZones())}
                sx={{ alignSelf: "flex-start", textTransform: "none" }}
              >
                {resetZonesS}
              </Button>
            </Section>
          )}
        </Box>

        {/* ---- Right: schematic of the result ---- */}
        <Box
          sx={{ flex: "1 1 300px", minWidth: 0, position: "sticky", top: 0 }}
        >
          <Section title={previewS}>
            <ImagesDisplayOptionsPreview />
          </Section>
        </Box>
      </Box>
      <DialogActions>
        <Button onClick={onClose}>{closeS}</Button>
      </DialogActions>
    </DialogGeneric>
  );
}
