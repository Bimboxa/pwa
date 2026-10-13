import { Box } from "@mui/material";
import { keyframes } from "@emotion/react";

// « Espace » key badge of the « Détection auto » cards: pulses green while a
// detection is waiting to be committed with the Space key.
const detectionPulse = keyframes`
  0%   { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
  50%  { background-color: #00ff0066; box-shadow: 0 0 10px #00ff00; }
  100% { background-color: #00ff00; box-shadow: 0 0 4px #00ff00; }
`;

export default function BadgeSpaceCommit({ active }) {
  // render

  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 56,
        height: 22,
        px: 0.5,
        borderRadius: "6px",
        border: "1px solid",
        borderColor: active ? "#00aa00" : "text.disabled",
        backgroundColor: active
          ? undefined
          : (theme) => theme.palette.action.hover,
        borderBottomWidth: "3px",
        color: active ? "#000" : "text.primary",
        fontFamily: "monospace",
        fontWeight: "bold",
        fontSize: "0.7rem",
        lineHeight: 1,
        animation: active
          ? `${detectionPulse} 0.8s ease-in-out infinite`
          : "none",
      }}
    >
      Espace
    </Box>
  );
}
