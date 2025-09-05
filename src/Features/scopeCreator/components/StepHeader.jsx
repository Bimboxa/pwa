import { Box, Typography } from "@mui/material";

export default function StepHeader({ title }) {
  return (
    <Box
      sx={{
        p: 1,
        py: 2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box sx={{ bgcolor: "background.default", borderRadius: "8px", p: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </Box>
    </Box>
  );
}
