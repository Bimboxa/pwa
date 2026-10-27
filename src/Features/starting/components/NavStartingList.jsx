import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import { SECTIONS } from "../data/startingSections";

// Left menu of the starting dialog: one entry per section.
export default function NavStartingList({ sectionKey, onSelect }) {
  return (
    <Box sx={{ width: 240, minWidth: 240, overflow: "auto", py: 1 }}>
      <List dense>
        {SECTIONS.map(({ key, label, Icon }) => (
          <ListItemButton
            key={key}
            selected={key === sectionKey}
            onClick={() => onSelect(key)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}
