import { IconButton, Tooltip } from "@mui/material";
import { ZoomOutMap as CenterIcon } from "@mui/icons-material";

export default function ButtonCenterBaseMap({ onResetCamera }) {

  // strings

  const title = "Recentrer le fond de plan";

  // handler

  function handleClick() {
    onResetCamera();
  }

  return (
    <Tooltip title={title}>
      <IconButton onClick={handleClick} color="inherit">
        <CenterIcon />
      </IconButton>
    </Tooltip>
  );
}
