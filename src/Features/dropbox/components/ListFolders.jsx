import {List, ListItemButton} from "@mui/material";

export default function ListFolders({folders, onClick}) {
  return (
    <List dense>
      {folders.map((folder) => (
        <ListItemButton key={folder.id} divider onClick={() => onClick(folder)}>
          {folder.name}
        </ListItemButton>
      ))}
    </List>
  );
}
