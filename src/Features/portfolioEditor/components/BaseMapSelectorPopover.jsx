import {
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import MapIcon from "@mui/icons-material/Map";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

export default function BaseMapSelectorPopover({
  anchorEl,
  open,
  onClose,
  onSelectBaseMap,
  onCreateBaseMap,
  onMouseEnter,
}) {
  // data

  const { value: baseMaps = [] } = useBaseMaps();

  // render

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: "center", horizontal: "center" }}
      transformOrigin={{ vertical: "center", horizontal: "center" }}
      slotProps={{
        paper: {
          sx: { width: 280, maxHeight: 360 },
          onMouseEnter,
          onMouseLeave: onClose,
        },
      }}
      disableRestoreFocus
    >
      <Box sx={{ p: 1.5 }}>
        <Typography variant="subtitle2">Fond de plan</Typography>
      </Box>
      <Divider />
      <List dense sx={{ maxHeight: 240, overflowY: "auto" }}>
        {baseMaps.map((map) => {
          const thumbnail = map.getThumbnail();
          return (
            <ListItem key={map.id} disablePadding>
              <ListItemButton onClick={() => onSelectBaseMap(map)}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {thumbnail ? (
                    <Box
                      component="img"
                      src={thumbnail}
                      alt=""
                      sx={{
                        width: 28,
                        height: 28,
                        objectFit: "cover",
                        borderRadius: 1,
                        border: 1,
                        borderColor: "divider",
                      }}
                    />
                  ) : (
                    <MapIcon fontSize="small" sx={{ color: "text.disabled" }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={map.name}
                  slotProps={{
                    primary: { variant: "body2", noWrap: true },
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
        {baseMaps.length === 0 && (
          <ListItem>
            <ListItemText
              primary="Aucun fond de plan"
              slotProps={{
                primary: {
                  variant: "body2",
                  color: "text.secondary",
                  sx: { fontStyle: "italic" },
                },
              }}
            />
          </ListItem>
        )}
      </List>
      <Divider />
      <ListItem disablePadding>
        <ListItemButton onClick={onCreateBaseMap}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            <AddIcon fontSize="small" color="primary" />
          </ListItemIcon>
          <ListItemText
            primary="Nouveau fond de plan..."
            slotProps={{
              primary: { variant: "body2", color: "primary", fontWeight: 500 },
            }}
          />
        </ListItemButton>
      </ListItem>
    </Popover>
  );
}
