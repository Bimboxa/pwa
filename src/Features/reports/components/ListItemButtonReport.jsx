import {useState} from "react";

import {
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
} from "@mui/material";
import {Download} from "@mui/icons-material";

export default function ListItemButtonReport({report}) {
  // state

  const [isOver, setIsOver] = useState(false);

  // handlers

  function handleMouseEnter() {
    setIsOver(true);
  }
  function handleMouseLeave() {
    setIsOver(false);
  }
  return (
    <ListItem
      dense
      divider
      disablePadding
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      secondaryAction={
        isOver ? (
          <IconButton>
            <Download />
          </IconButton>
        ) : null
      }
    >
      <ListItemButton>
        <ListItemText primary={report.name} />
      </ListItemButton>
    </ListItem>
  );
}
