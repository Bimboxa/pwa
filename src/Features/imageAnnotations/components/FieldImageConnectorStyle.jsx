import { useEffect, useState } from "react";

import {
  Box,
  InputBase,
  Popover,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import {
  CallMade as ArrowIcon,
  DoNotDisturbAlt as NoneIcon,
  FiberManualRecord as PointIcon,
  Pin as NumberIcon,
} from "@mui/icons-material";

import ColorPickerContent from "Features/colors/components/ColorPickerContent";
import {
  numberInputSx,
  toggleGroupSx,
} from "Features/annotations/constants/fieldSx";

import { parseImageConnectorSize } from "../utils/getImageConnectorConfig";

// One height for every control (swatch, toggles, size input), forced on each
// of them so they always line up.
const CONTROL_HEIGHT_PX = 26;

const rowSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 1,
  minHeight: 32,
};

const controlToggleGroupSx = {
  ...toggleGroupSx,
  height: CONTROL_HEIGHT_PX,
  "& .MuiToggleButton-root": {
    ...toggleGroupSx["& .MuiToggleButton-root"],
    height: CONTROL_HEIGHT_PX,
    py: 0,
  },
};

// Solid / dashed line glyph of the line toggle.
function LineGlyph({ dashed = false }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 20 20"
      sx={{ width: 20, height: 20, display: "block" }}
    >
      <line
        x1={2}
        y1={10}
        x2={18}
        y2={10}
        stroke="currentColor"
        strokeWidth={2}
        strokeDasharray={dashed ? "4 3" : undefined}
      />
    </Box>
  );
}

// Connector of the photos (global display setting), four rows:
// - general: colour swatch + end marker size (page points of the print zone);
// - end on the anchor side: numbered badge, arrow head or dot;
// - line: solid, dashed or none;
// - end on the photo side: number on the photo corner, or not.
// Presentational, no frame of its own (rendered inside a section of
// DialogImagesDisplayOptions). `onChange` receives a partial `{ color }` /
// `{ end }` / `{ line }` / `{ size }`; `onShowNumberChange` a boolean. The
// size is committed on blur (or Enter) only, never on each keystroke; an
// empty / invalid input snaps back to the current value.
export default function FieldImageConnectorStyle({
  color,
  end,
  line,
  size,
  onChange,
  showNumber,
  onShowNumberChange,
}) {
  // strings
  const generalS = "Couleur et taille";
  const colorS = "Couleur du connecteur";
  const sizeHintS =
    "Taille de la terminaison, en points de la zone d'impression";
  const endS = "Terminaison côté ancrage";
  const numberS = "Numéro";
  const arrowS = "Flèche";
  const pointS = "Point";
  const lineS = "Ligne";
  const solidS = "Ligne pleine";
  const dashedS = "Pointillé";
  const noneS = "Aucune ligne";
  const photoNumberS = "Numéro sur la photo";

  // state
  const [anchorEl, setAnchorEl] = useState(null);
  const [sizeDraft, setSizeDraft] = useState(String(size ?? ""));
  useEffect(() => {
    setSizeDraft(String(size ?? ""));
  }, [size]);

  // handlers
  function handleColorChange(nextColor) {
    onChange({ color: nextColor });
  }

  function handleEndChange(_event, nextEnd) {
    if (nextEnd !== null) onChange({ end: nextEnd });
  }

  function handleLineChange(_event, nextLine) {
    if (nextLine !== null) onChange({ line: nextLine });
  }

  function commitSize() {
    const next = parseImageConnectorSize(sizeDraft);
    // Unchanged, empty or invalid: the draft snaps back, nothing dispatched.
    if (next === undefined || next === size) {
      setSizeDraft(String(size ?? ""));
      return;
    }
    onChange({ size: next });
  }

  // render
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box sx={rowSx}>
        <Typography variant="body2">{generalS}</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            role="button"
            aria-label={colorS}
            title={colorS}
            onClick={(event) => setAnchorEl(event.currentTarget)}
            sx={{
              width: CONTROL_HEIGHT_PX,
              height: CONTROL_HEIGHT_PX,
              boxSizing: "border-box",
              flexShrink: 0,
              borderRadius: "50%",
              bgcolor: color,
              cursor: "pointer",
              border: "2px solid",
              borderColor: "divider",
              "&:hover": { transform: "scale(1.1)" },
              transition: "transform 0.2s",
            }}
          />
          <InputBase
            value={sizeDraft}
            onChange={(event) => setSizeDraft(event.target.value)}
            onBlur={commitSize}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") event.target.blur();
            }}
            title={sizeHintS}
            inputProps={{ inputMode: "decimal", "aria-label": sizeHintS }}
            endAdornment={
              <Box
                component="span"
                sx={{ fontSize: "0.7rem", color: "text.secondary", ml: 0.25 }}
              >
                pt
              </Box>
            }
            sx={{ ...numberInputSx, height: CONTROL_HEIGHT_PX }}
          />
        </Box>
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2">{endS}</Typography>
        <ToggleButtonGroup
          value={end}
          exclusive
          onChange={handleEndChange}
          size="small"
          aria-label={endS}
          sx={controlToggleGroupSx}
        >
          <ToggleButton value="ARROW" title={arrowS} aria-label={arrowS}>
            <ArrowIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="POINT" title={pointS} aria-label={pointS}>
            <PointIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="NUMBER" title={numberS} aria-label={numberS}>
            <NumberIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2">{lineS}</Typography>
        <ToggleButtonGroup
          value={line}
          exclusive
          onChange={handleLineChange}
          size="small"
          aria-label={lineS}
          sx={controlToggleGroupSx}
        >
          <ToggleButton value="SOLID" title={solidS} aria-label={solidS}>
            <LineGlyph />
          </ToggleButton>
          <ToggleButton value="DASHED" title={dashedS} aria-label={dashedS}>
            <LineGlyph dashed />
          </ToggleButton>
          <ToggleButton value="NONE" title={noneS} aria-label={noneS}>
            <NoneIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={rowSx}>
        <Typography variant="body2">{photoNumberS}</Typography>
        <Switch
          size="small"
          checked={Boolean(showNumber)}
          onChange={(event) => onShowNumberChange(event.target.checked)}
          inputProps={{ "aria-label": photoNumberS }}
        />
      </Box>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { mt: 1, borderRadius: 2, boxShadow: 6 } },
        }}
      >
        <ColorPickerContent
          color={color}
          onColorChange={handleColorChange}
          onClose={() => setAnchorEl(null)}
        />
      </Popover>
    </Box>
  );
}
