import {useDispatch} from "react-redux";

import {setRemoteProjectsContainer} from "../scopeSelectorSlice";
import useRemoteProjectsContainers from "../hooks/useRemoteProjectsContainers";

import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import {ArrowForwardIos as Forward} from "@mui/icons-material";

import BoxCenter from "Features/layout/components/BoxCenter";

export default function SectionRemoteProjectsContainers() {
  const dispatch = useDispatch();

  // data

  const containers = useRemoteProjectsContainers();

  // handlers

  function handleContainerClick(container) {
    dispatch(setRemoteProjectsContainer(container));
  }

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
          key={container.service}
          disablePadding
        >
          <ListItemButton
            key={container.service}
            onClick={() => handleContainerClick(container)}
          >
            <ListItemText primary={container.name} />
          </ListItemButton>
        </ListItem>
      ))}
    </List>
  );
}
