import { useEffect, useState } from "react";

import {
  Box,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";

import {
  HEIGHT_CUT_SIDE_BOTTOM,
  HEIGHT_CUT_SIDE_TOP,
} from "../constants/heightCutConstants";

// Delta (m, signed) + side (top / bottom of the prism) of a height cut.
// The delta is committed on blur / Enter.
export default function FieldsHeightCutDelta({
  delta,
  side,
  showSide = true,
  disabled = false,
  onDeltaChange,
  onSideChange,
}) {
  // strings

  const deltaLabelS = "Delta";
  const topS = "Haut";
  const bottomS = "Bas";

  // state

  const [text, setText] = useState(formatDelta(delta));
  useEffect(() => {
    setText(formatDelta(delta));
  }, [delta]);

  // handlers

  function commit() {
    const value = Number(String(text).replace(",", "."));
    if (!Number.isFinite(value)) {
      setText(formatDelta(delta));
      return;
    }
    if (value !== Number(delta)) onDeltaChange?.(value);
  }

  // render

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
      <TextField
        size="small"
        label={deltaLabelS}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") e.target.blur();
        }}
        slotProps={{
          input: {
            endAdornment: <InputAdornment position="end">m</InputAdornment>,
          },
          htmlInput: { inputMode: "decimal" },
        }}
        sx={{ width: 110 }}
      />
      {showSide && (
        <ToggleButtonGroup
          size="small"
          exclusive
          disabled={disabled}
          value={
            side === HEIGHT_CUT_SIDE_BOTTOM
              ? HEIGHT_CUT_SIDE_BOTTOM
              : HEIGHT_CUT_SIDE_TOP
          }
          onChange={(_, value) => value && onSideChange?.(value)}
        >
          <ToggleButton value={HEIGHT_CUT_SIDE_TOP} sx={{ py: 0.25 }}>
            {topS}
          </ToggleButton>
          <ToggleButton value={HEIGHT_CUT_SIDE_BOTTOM} sx={{ py: 0.25 }}>
            {bottomS}
          </ToggleButton>
        </ToggleButtonGroup>
      )}
    </Box>
  );
}

function formatDelta(delta) {
  const value = Number(delta);
  return Number.isFinite(value) ? String(value) : "0";
}
