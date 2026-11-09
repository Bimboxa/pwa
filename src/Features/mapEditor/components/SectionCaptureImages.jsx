import { useSelector, useDispatch } from "react-redux";

import { setImageModeImagesOverlay } from "../mapEditorSlice";
import { selectImagesExSitu } from "Features/popperImages/popperImagesSlice";

import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import FieldCheck from "Features/form/components/FieldCheck";

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

// "Photos" capture-mode block: the capture zone of the ex-situ tiles
// (visibility, columns). In situ / ex situ, the links and the show / hide
// toggle are the PopperImages settings (also the "Photos" button of the
// condensed capture band). Capture tool's Cadrage tab, 2D and 3D.
export default function SectionCaptureImages() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";
  const inSituHintS =
    "Photos in situ : réglez l'affichage ex situ dans le panneau Photos de l'éditeur.";
  const zoneS = "Zone photos dans le cadre";
  const columnsS = "Colonnes";

  // data

  const exSitu = useSelector(selectImagesExSitu);
  const overlay = useSelector((s) => s.mapEditor.imageModeImagesOverlay);

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        {titleS}
      </Typography>
      {!exSitu && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {inSituHintS}
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
              value={overlay?.columns ?? 2}
              options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
              onChange={(v) =>
                dispatch(setImageModeImagesOverlay({ ...overlay, columns: v }))
              }
            />
          )}
        </>
      )}
    </Box>
  );
}
