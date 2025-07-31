import { Box } from "@mui/material";

export default function DiskGeneric({ children, bgcolor, size }) {
  return (
    <Box
      sx={{
        borderRadius: "50%",
        bgcolor,
        width: size,
        height: size,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {children}
    </Box>
  );
}
