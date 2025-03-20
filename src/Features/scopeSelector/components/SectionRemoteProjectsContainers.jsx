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

export default function SectionRemoteProjectsContainers({
  onRemoteContainerClick,
}) {
  // data

  const containers = useRemoteProjectsContainers();

  // render

  return (
    <List dense>
      {containers.map((container) => (
        <ListItem
          divider
          secondaryAction={
            <BoxCenter>
              <Forward />
            </BoxCenter>
          }
          key={container.id}
          disablePadding
        >
          <ListItemButton
            key={container.id}
            onClick={() => onRemoteContainerClick(container)}
          >
            <ListItemText primary={container.name} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
