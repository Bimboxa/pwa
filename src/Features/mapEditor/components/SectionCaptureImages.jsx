import { useSelector, useDispatch } from "react-redux";

import { setImageModeImagesOverlay } from "../mapEditorSlice";
import {
  selectImagesDisplayMode,
  selectImagesPanelColumns,
  setImagesPanelColumns,
} from "Features/popperImages/popperImagesSlice";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";
import SelectorImagesDisplayMode from "Features/popperImages/components/SelectorImagesDisplayMode";

const LABEL_SX = {
  fontWeight: 600,
  color: "text.secondary",
  lineHeight: 1.2,
};

function RowToggle({ label, value, options, onChange }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1,
      }}
    >
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={value}
        onChange={(_e, v) => {
          if (v !== null && v !== undefined) onChange(v);
        }}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value} sx={{ py: 0.25, px: 1 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: 600, textTransform: "none" }}
            >
              {o.label}
            </Typography>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

// "Photos" capture-mode block: the display mode of the photos (same state as
// the bottom bar selector, hidden while framing) and, in overlay mode, the
// capture zone of the tiles (visibility, columns — the same setting as the
// editor's Photos panel, popperImages.panelColumns). The print zones are laid
// out automatically. The links and the show / hide toggle are the bottom bar
// settings (also the "Photos" button of the condensed capture band). Capture
// tool's Cadrage tab, 2D and 3D.
export default function SectionCaptureImages() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";
  const modeS = "Affichage";
  const inSituHintS = "Photos affichées sur le fond de plan.";
  const printZonesHintS =
    "Photos réparties automatiquement sur les 4 bords du cadre.";
  const zoneS = "Zone photos dans le cadre";
  const columnsS = "Colonnes";

  // data

  const displayMode = useSelector(selectImagesDisplayMode);
  const exSitu = displayMode === "EX_SITU";
  const overlay = useSelector((s) => s.mapEditor.imageModeImagesOverlay);
  const columns = useSelector(selectImagesPanelColumns);

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        {titleS}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          "& > .MuiPaper-root": {
            boxShadow: "none",
            border: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          {modeS}
        </Typography>
        <SelectorImagesDisplayMode dense />
      </Box>
      {!exSitu && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {displayMode === "PRINT_ZONES" ? printZonesHintS : inSituHintS}
        </Typography>
      )}
      {exSitu && (
        <>
          <FieldCheck
            value={Boolean(overlay?.visible)}
            onChange={(checked) =>
              dispatch(
                setImageModeImagesOverlay({
                  ...overlay,
                  visible: Boolean(checked),
                })
              )
            }
            label={zoneS}
            options={{ type: "switch", showAsInline: true }}
          />
          {overlay?.visible && (
            <RowToggle
              label={columnsS}
              value={columns}
              options={[1, 2].map((n) => ({ value: n, label: String(n) }))}
              onChange={(v) => dispatch(setImagesPanelColumns(v))}
            />
          )}
        </>
      )}
    </Box>
  );
}
