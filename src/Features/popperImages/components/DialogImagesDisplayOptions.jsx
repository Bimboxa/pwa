import { useDispatch, useSelector } from "react-redux";

import {
  resetPrintZonesZones,
  selectPrintZonesTileSizeMode,
  selectPrintZonesTileSizePx,
  selectPrintZonesZones,
  setPrintZonesTileSizeMode,
  setPrintZonesTileSizePx,
} from "../popperImagesSlice";

import {
  Box,
  Button,
  DialogActions,
  FormControlLabel,
  Radio,
  RadioGroup,
  Slider,
  Typography,
} from "@mui/material";

import DialogGeneric from "Features/layout/components/DialogGeneric";

import {
  PRINT_ZONES_TILE_SIZE_MAX_PX,
  PRINT_ZONES_TILE_SIZE_MIN_PX,
} from "../services/popperImagesLocalStorage";

// ---------------------------------------------------------------------------
// DialogImagesDisplayOptions — "…" of the photos controls in the bottom bar:
// the display options that do not deserve a button of their own. Today: the
// size of the "print zones" tiles — automatic (shrunk until every photo fits
// in its zone) or fixed — and the reset of the zones resized by hand.
// ---------------------------------------------------------------------------

export default function DialogImagesDisplayOptions({ open, onClose }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Options d'affichage des photos";
  const sizeS = "Taille des vignettes (mode zones)";
  const autoS = "Automatique";
  const autoHintS = "Réduite si les photos ne tiennent pas dans leur zone";
  const resetZonesS = "Réinitialiser les zones";
  const fixedS = "Fixe";
  const closeS = "Fermer";

  // data

  const sizeMode = useSelector(selectPrintZonesTileSizeMode);
  const sizePx = useSelector(selectPrintZonesTileSizePx);
  const zones = useSelector(selectPrintZonesZones);
  const zonesResized = Object.keys(zones).length > 0;

  // render

  return (
    <DialogGeneric title={titleS} open={open} onClose={onClose} width={380}>
      <Box sx={{ px: 3, pb: 1, display: "flex", flexDirection: "column" }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          {sizeS}
        </Typography>
        <RadioGroup
          value={sizeMode}
          onChange={(e) => dispatch(setPrintZonesTileSizeMode(e.target.value))}
        >
          <FormControlLabel
            value="AUTO"
            control={<Radio size="small" />}
            label={
              <Box>
                <Typography variant="body2">{autoS}</Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {autoHintS}
                </Typography>
              </Box>
            }
          />
          <FormControlLabel
            value="FIXED"
            control={<Radio size="small" />}
            label={<Typography variant="body2">{fixedS}</Typography>}
          />
        </RadioGroup>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            pl: 3.5,
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
          />
          <Typography
            variant="caption"
            sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}
          >
            {`${sizePx} px`}
          </Typography>
        </Box>
      </Box>
      <DialogActions>
        <Button
          disabled={!zonesResized}
          onClick={() => dispatch(resetPrintZonesZones())}
          sx={{ mr: "auto" }}
        >
          {resetZonesS}
        </Button>
        <Button onClick={onClose}>{closeS}</Button>
      </DialogActions>
    </DialogGeneric>
  );
}
