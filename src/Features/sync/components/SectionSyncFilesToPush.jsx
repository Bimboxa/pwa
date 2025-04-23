import useSyncFilesToPush from "../hooks/useSyncFilesToPush";

import {List, ListItem, ListItemText} from "@mui/material";

export default function SectionSyncFilesToPush() {
  // data

  const syncFilesToPush = useSyncFilesToPush();
  console.log("syncFilesToPush", syncFilesToPush);

  return (
    <List dense>
      {syncFilesToPush.map((item) => {
        return (
          <ListItem key={item.path}>
            <ListItemText>{item.path}</ListItemText>
          </ListItem>
        );
      })}
    </List>
  );
}
