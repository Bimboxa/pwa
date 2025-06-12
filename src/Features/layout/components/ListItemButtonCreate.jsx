import {
  ListItemButton,
  ListItemText,
  ListItemIcon,
  ListItem,
} from "@mui/material";
import {Add} from "@mui/icons-material";

import useIsMobile from "Features/layout/hooks/useIsMobile";

export default function ListItemButtonCreate({label = "Nouveau", onClick}) {
  const isMobile = useIsMobile();

  return (
    <ListItemButton onClick={onClick} dense={!isMobile} disablePadding divider>
      <ListItemIcon>
        <Add />
      </ListItemIcon>
      <ListItemText primary={label} />
    </ListItemButton>
  );
}
