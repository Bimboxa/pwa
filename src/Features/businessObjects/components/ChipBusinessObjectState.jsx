import { Chip } from "@mui/material";

import { COLOR_HEX } from "Features/notesApp/utils/notesAppStateModels";

// Row badge of the object's state in the listing's primary Krnet state model
// (Krnet Badge): uppercase bold label, outlined in the state color.
export default function ChipBusinessObjectState({ state }) {
  // render

  if (!state) return null;
  const color = COLOR_HEX[state.color] ?? COLOR_HEX.blue;
  return (
    <Chip
      label={state.name}
      size="small"
      variant="outlined"
      sx={{
        height: 18,
        fontSize: "0.6rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        color,
        borderColor: color,
        bgcolor: `${color}14`,
        "& .MuiChip-label": { px: 0.75 },
      }}
    />
  );
}
