import { Typography } from "@mui/material";

import formatChronoTime from "../utils/formatChronoTime";

const SIZE_TO_FONT = {
  large: "2.6rem",
  header: "1.1rem",
  small: "0.95rem",
};

export default function ChronoTimeDisplay({ ms, size = "large" }) {
  // render

  return (
    <Typography
      sx={{
        fontFamily:
          '"SF Mono", "Roboto Mono", "Menlo", "Consolas", monospace',
        fontWeight: 700,
        fontSize: SIZE_TO_FONT[size] ?? SIZE_TO_FONT.large,
        lineHeight: 1,
        letterSpacing: "0.06em",
        color: "secondary.main",
        textAlign: "center",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {formatChronoTime(ms)}
    </Typography>
  );
}
