/* eslint-disable react/prop-types */
import { useState } from "react";
import { useDispatch } from "react-redux";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import {
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  CenterFocusStrong,
  Close,
  CropFree,
  MoreHoriz,
} from "@mui/icons-material";
import stringifyFileSize from "Features/files/utils/stringifyFileSize";

// Header of the Scan 3D tool: the scan of the selected base map (name,
// count, size), the panel close and the model actions (frame, load zone).
export default function Scan3dHeader({
  model,
  baseMapName,
  busy = false,
  onFrame,
  onEditZone,
}) {
  const dispatch = useDispatch();
  const [anchor, setAnchor] = useState(null);
  function run(action) {
    setAnchor(null);
    action();
  }
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        p: 1,
        flexShrink: 0,
        bgcolor: "background.default",
        borderBottom: 1,
        borderColor: "divider",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" noWrap title={baseMapName ?? ""}>
          {baseMapName ?? "Scan 3D"}
        </Typography>
        {model && (
          <Typography
            variant="caption"
            color="text.secondary"
            noWrap
            sx={{ display: "block" }}
            title={model.name}
          >
            {model.name} · {model.count.toLocaleString("fr-FR")}{" "}
            {model.kind === "SPLAT" ? "gaussiennes" : "points"} ·{" "}
            {stringifyFileSize(model.size)}
          </Typography>
        )}
      </Box>
      <Tooltip title="Fermer le panneau">
        <IconButton
          size="small"
          aria-label="Fermer le panneau Scan 3D"
          onClick={() => dispatch(setSelectedMenuItemKey(null))}
        >
          <Close fontSize="small" />
        </IconButton>
      </Tooltip>
      {model && (
        <>
          <Tooltip title="Actions du modèle">
            <IconButton
              size="small"
              aria-label="Actions du modèle"
              aria-haspopup="menu"
              aria-expanded={Boolean(anchor)}
              disabled={busy}
              onClick={(event) => setAnchor(event.currentTarget)}
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <MenuItem onClick={() => run(onFrame)}>
              <ListItemIcon>
                <CenterFocusStrong fontSize="small" />
              </ListItemIcon>
              <ListItemText>Cadrer</ListItemText>
            </MenuItem>
            {onEditZone && (
              <MenuItem onClick={() => run(onEditZone)}>
                <ListItemIcon>
                  <CropFree fontSize="small" />
                </ListItemIcon>
                <ListItemText>Modifier la zone</ListItemText>
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  );
}
