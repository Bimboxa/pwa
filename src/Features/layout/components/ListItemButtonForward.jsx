import BoxCenter from "./BoxCenter";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

export default function ListItemButtonForward({label, onClick}) {
  return (
    <ListItem
      disablePadding
      dense
      secondaryAction={
        <BoxCenter>
          <Forward color="action" />
        </BoxCenter>
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
