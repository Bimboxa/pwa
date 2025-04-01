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

export default function ListRemoteProjectsContainers({items, onClick}) {
  // render

  return (
    <List dense>
      {items.map((item) => {
        return (
          <ListItem
            divider
            secondaryAction={
              <BoxCenter>
                <Forward />
              </BoxCenter>
            }
            key={item.service}
            disablePadding
          >
            <ListItemButton key={item.service} onClick={() => onClick(item)}>
              <ListItemText primary={item.name} />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}
