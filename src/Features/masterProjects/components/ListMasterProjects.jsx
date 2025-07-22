import { List, ListItemButton, ListItemText } from "@mui/material";

export default function ListMasterProjects({ projects, onClick }) {
  return (
    <List dense>
      {projects.map((project) => (
        <ListItemButton
          key={project.id}
          divider
          onClick={() => onClick(project)}
        >
          <ListItemText primary={project.name} />
        </ListItemButton>
      ))}
    </List>
  );
}
