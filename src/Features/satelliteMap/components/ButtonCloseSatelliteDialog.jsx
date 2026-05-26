import { Paper } from "@mui/material";

import IconButtonClose from "Features/layout/components/IconButtonClose";

export default function ButtonCloseSatelliteDialog({ onClose }) {
  return (
    <Paper>
      <IconButtonClose onClose={onClose} />
    </Paper>
  );
}
