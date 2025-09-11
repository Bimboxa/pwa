import { Typography, Box } from "@mui/material";

import SwitchShowBgImage from "./SwitchShowBgImage";

export default function PanelShower() {
  // strings

  const title = "Calques";

  return (
    <Box sx={{ p: 1 }}>
      <Typography>{title}</Typography>
      <SwitchShowBgImage />
    </Box>
  );
}
