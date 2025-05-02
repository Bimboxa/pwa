import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";
import ListItemButtonForward from "Features/layout/components/ListItemButtonForward";

export default function ListRemoteContainers({containers, onClick}) {
  // render

  return (
    <List dense>
      {containers.map((container) => {
        return (
          <ListItemButtonForward
            onClick={() => onClick(container)}
            label={container.name}
            key={container.name}
            divider={true}
          />
        );
      })}
    </List>
  );
}
