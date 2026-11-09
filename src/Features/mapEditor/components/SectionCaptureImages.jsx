import { useSelector, useDispatch } from "react-redux";

import { setImageModeImagesOverlay } from "../mapEditorSlice";
import {
  selectImagesDisplayMode,
  selectImagesLinkLine,
  selectImagesLinkNumber,
  setImagesDisplayMode,
  setImagesLinkLine,
  setImagesLinkNumber,
} from "Features/popperImages/popperImagesSlice";

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

// "Photos" capture-mode block: the PopperImages display mode (shared
// preference — the editor panel toggles the same value), the tile ↔ anchor
// link style, and the capture zone of the ex-situ tiles (visibility,
// columns). Capture tool's Cadrage tab, 2D and 3D.
export default function SectionCaptureImages() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Photos";
  const modeS = "Affichage";
  const inSituS = "In situ";
  const exSituS = "Ex situ";
  const lineS = "Lien par ligne";
  const numberS = "Lien par numéro";
  const zoneS = "Zone photos dans le cadre";
  const columnsS = "Colonnes";

  // data

  const displayMode = useSelector(selectImagesDisplayMode);
  const linkLine = useSelector(selectImagesLinkLine);
  const linkNumber = useSelector(selectImagesLinkNumber);
  const overlay = useSelector((s) => s.mapEditor.imageModeImagesOverlay);
  const exSitu = displayMode === "EX_SITU";

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <Typography variant="overline" sx={LABEL_SX}>
        {titleS}
      </Typography>
      <RowToggle
        label={modeS}
        value={displayMode}
        options={[
          { value: "IN_SITU", label: inSituS },
          { value: "EX_SITU", label: exSituS },
        ]}
        onChange={(v) => dispatch(setImagesDisplayMode(v))}
      />
      {exSitu && (
        <>
          <FieldCheck
            value={linkLine}
            onChange={(checked) => dispatch(setImagesLinkLine(checked))}
            label={lineS}
            options={{ type: "switch", showAsInline: true }}
          />
          <FieldCheck
            value={linkNumber}
            onChange={(checked) => dispatch(setImagesLinkNumber(checked))}
            label={numberS}
            options={{ type: "switch", showAsInline: true }}
          />
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
