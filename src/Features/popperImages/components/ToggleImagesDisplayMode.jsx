import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";

import useImagesDisplaySettings from "../hooks/useImagesDisplaySettings";

// ---------------------------------------------------------------------------
// ToggleImagesDisplayMode — header toggle of PopperImages: "In situ" (the
// photos are drawn in the scene) | "Ex situ" (the photos are the tiles of
// the panel, only their anchor stays in the scene). Same look as
// ToggleContentMode (PopperMapListings).
// ---------------------------------------------------------------------------

export default function ToggleImagesDisplayMode() {
  // strings

  const inSituS = "In situ";
  const exSituS = "Ex situ";

  // data

  const { displayMode, setDisplayMode } = useImagesDisplaySettings();

  // helpers

  const options = [
    { value: "IN_SITU", label: inSituS },
    { value: "EX_SITU", label: exSituS },
  ];

  // handlers

  function handleChange(_e, value) {
    if (value) setDisplayMode(value);
  }

  // render

  return (
    <ToggleButtonGroup
      value={displayMode}
      exclusive
      size="small"
      // Inside the popper the header is the drag handle.
      onMouseDown={(e) => e.stopPropagation()}
      onChange={handleChange}
      sx={{ flex: 1, minWidth: 0 }}
    >
      {options.map(({ value, label }) => (
        <ToggleButton
          key={value}
          value={value}
          sx={{ flex: 1, py: 0.25, px: 0.5, minWidth: 0 }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{ fontWeight: 600, textTransform: "none" }}
          >
            {label}
          </Typography>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
