import { Box, Typography } from "@mui/material";
import IconScope from "Features/scopes/components/IconScope";

export default function ContainerScope({ scope }) {
  if (!scope) return;

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "secondary.main",
          width: 36,
          height: 36,
          borderRadius: "8px",
        }}
      >
        <Box
          sx={{
            width: 24,
            height: 24,

            color: "white",
          }}
        >
          <IconScope />
        </Box>
      </Box>

      <Typography sx={{ pl: 1 }}>{scope.name}</Typography>
    </Box>
  );
}
