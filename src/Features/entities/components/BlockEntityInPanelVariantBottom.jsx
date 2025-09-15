import {
  Box,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemButton,
  ListItemText,
  Paper,
} from "@mui/material";
import { Close, Add } from "@mui/icons-material";

import ButtonInPanel from "Features/layout/components/ButtonInPanel";

export default function BlockEntityInPanelVariantBottom({
  label,
  id,
  onClick,
  onClose,
  bgcolor,
}) {
  // helpers

  bgcolor = !id ? bgcolor : "common.white";
  const color = !id ? "common.white" : "common.black";
  const p = !id ? 1 : 0;
  const addIcon = Boolean(!id);

  return (
    <Box sx={{ width: 1, p }}>
      {/* <ButtonInPanel label={label} onClick={onClick} variant="default" /> */}
      <Paper elevation={6} width={1}>
        <ListItem
          //dense
          sx={{ bgcolor, color }}
          disablePadding
          secondaryAction={
            id ? (
              <IconButton edge="end" onClick={onClose}>
                <Close />
              </IconButton>
            ) : null
          }
        >
          <ListItemButton onClick={onClick}>
            <ListItemIcon color="inherit">
              {addIcon ? <Add sx={{ color: "white" }} /> : null}
            </ListItemIcon>

            <ListItemText primary={label} />
          </ListItemButton>
        </ListItem>
      </Paper>
    </Box>
  );
}
