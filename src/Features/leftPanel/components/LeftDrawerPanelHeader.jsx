import { Typography } from "@mui/material";

// Shared header of the module left drawers: designation of the items
// listed below (e.g. "Annotations", "Mailles").
export default function LeftDrawerPanelHeader({ title }) {
  return (
    <Typography
      variant="subtitle2"
      sx={{
        px: 2,
        pt: 1.5,
        pb: 0.5,
        color: "text.secondary",
        textTransform: "uppercase",
      }}
    >
      {title}
    </Typography>
  );
}
