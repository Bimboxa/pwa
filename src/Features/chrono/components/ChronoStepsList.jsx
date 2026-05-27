import { Box, Typography, Divider } from "@mui/material";

import ChronoTimeDisplay from "./ChronoTimeDisplay";

export default function ChronoStepsList({ steps }) {
  // render

  if (!steps?.length) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ mb: 0.5 }} />
      <Typography
        variant="caption"
        sx={{
          px: 0.5,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontSize: "0.65rem",
        }}
      >
        Étapes
      </Typography>
      <Box
        sx={{
          mt: 0.5,
          maxHeight: 160,
          overflowY: "auto",
        }}
      >
        {steps.map((step, idx) => (
          <Box
            key={step.id}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1,
              px: 0.75,
              py: 0.5,
              borderRadius: 1,
              "&:hover": { bgcolor: "action.hover" },
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: "text.disabled",
                  fontFamily: "monospace",
                  width: 18,
                  flexShrink: 0,
                }}
              >
                {String(idx + 1).padStart(2, "0")}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={step.name}
              >
                {step.name}
              </Typography>
            </Box>
            <ChronoTimeDisplay ms={step.durationMs} size="small" />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
