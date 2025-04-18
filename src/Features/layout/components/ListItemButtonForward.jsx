import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

export default function ListItemButtonForward({label, onClick}) {
  return (
    <ListItem
      disablePadding
      dense
      secondaryAction={
        <IconButton onClick={onClick}>
          <Forward color="action" />
        </IconButton>
      }
    >
      <ListItemButton
        sx={{bgcolor: "white"}}
        dense
        color="inherit"
        onClick={onClick}
      >
        <ListItemText>
          <Typography variant="body2">{label}</Typography>
        </ListItemText>
      </ListItemButton>
    </ListItem>
  );
}
