import { Typography } from "@mui/material";
export default function HeaderListPanel({ title }) {
  return (
    <Typography variant="h4" sx={{ p: 2 }}>
      {title}
    </Typography>
  );
}
