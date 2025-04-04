import {List, ListItemButton, ListItemText, ListItemIcon} from "@mui/material";
import {Add} from "@mui/icons-material";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function ListProjects({
  loading,
  projects,
  selection,
  onClick,
  onNewClick,
}) {
  const appConfig = useAppConfig();

  // strings

  const addS = appConfig?.strings?.project?.new;
  const addDescriptionS = appConfig?.strings?.project?.create;
  const clientRefS = "Réf.";

  // handlers

  function handleProjectClick(project) {
    if (onClick) onClick(project);
  }

  function handleNewClick() {
    onNewClick();
  }

  return (
    <>
      {!loading && (
        <List dense>
          {projects.map((project) => {
            const selected = selection.includes(project.id);
            const refLabel = project?.clientRef
              ? `${clientRefS} ${project.clientRef}`
              : null;
            return (
              <ListItemButton
                divider
                selected={selected}
                key={project.id}
                onClick={() => handleProjectClick(project)}
              >
                <ListItemText primary={project.name} secondary={refLabel} />
              </ListItemButton>
            );
          })}
          {onNewClick && (
            <ListItemButton onClick={handleNewClick}>
              <ListItemIcon>
                <Add />
              </ListItemIcon>
              <ListItemText primary={addS} secondary={addDescriptionS} />
            </ListItemButton>
          )}
        </List>
      )}
    </>
  );
}
