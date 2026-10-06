import { IconButton, Paper, Tooltip } from "@mui/material";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";

// 2D twin of ButtonZoomOutThreed: re-fit the camera so the base map fills the
// visible editor viewport (the default camera matrix). Positioned by its
// parent — the top-right overlay row of UILayerDesktop, between the base map
// image mode selector and the base maps grid button, mirroring the 3D editor
// layout.
export default function ButtonZoomOutMap({ onResetCamera }) {
  // handlers

  function handleClick() {
    onResetCamera?.();
  }

  // render

  return (
    <Paper
      elevation={3}
      sx={{
        borderRadius: "10px",
      }}
    >
      <Tooltip title="Zoom out">
        <IconButton size="small" color="inherit" onClick={handleClick}>
          <ZoomOutMapIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}
