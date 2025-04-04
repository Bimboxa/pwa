import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";
import useRemoteProjectsContainers from "../hooks/useRemoteProjectsContainers";
import BoxCenter from "Features/layout/components/BoxCenter";

export default function ListRemoteContainers({containers, onClick}) {
  // render

  return (
    <List dense>
      {containers.map((container) => {
        return (
          <ListItem
            divider
            secondaryAction={
              <BoxCenter>
                <Forward color="action" />
              </BoxCenter>
            }
            key={container.service}
            disablePadding
          >
            <ListItemButton
              key={container.service}
              onClick={() => onClick(container)}
            >
              <ListItemText primary={container.name} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
