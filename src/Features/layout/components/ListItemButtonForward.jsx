import useIsMobile from "Features/layout/hooks/useIsMobile";

import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

export default function ListItemButtonForward({label, onClick, divider}) {
  const isMobile = useIsMobile();
  return (
    <ListItem
      divider={divider}
      disablePadding
      dense={!isMobile}
      secondaryAction={
        <IconButton onClick={onClick}>
          <Forward color="action" />
        </IconButton>
      }
    >
      <ListItemButton sx={{bgcolor: "white"}} color="inherit" onClick={onClick}>
        <ListItemText>
          <Typography variant="body2">{label}</Typography>
        </ListItemText>
      </ListItemButton>
    </ListItem>
  );
}
