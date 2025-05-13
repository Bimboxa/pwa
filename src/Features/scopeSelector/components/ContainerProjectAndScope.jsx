import {Box, ListItem, ListItemText} from "@mui/material";

export default function ContainerProjectAndScope({project, scope}) {
  console.log("[debug] project & scope", project, scope);

  const title = scope.name;
  const subtitle = `[${project.clientRef} • ${scope.clientRef}] ${project.name}`;
  return (
    <Box>
      <ListItem>
        <ListItemText primary={title} secondary={subtitle} />
      </ListItem>
    </Box>
  );
}
