import { Box } from "@mui/material";
import { keyframes } from "@mui/system";

const pulse = keyframes`
  0%, 100% { transform: scale(0.7); opacity: 0.45; }
  50% { transform: scale(1); opacity: 1; }
`;

// The model is working: a pulsing accent dot, no bubble.
export default function ThinkingBubble() {
  return (
    <Box
      role="status"
      aria-label="Réflexion en cours"
      sx={{ display: "flex", alignItems: "center", height: 22 }}
    >
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: "secondary.main",
          animation: `${pulse} 1.2s ease-in-out infinite`,
        }}
      />
    </Box>
  );
}
