import {List, ListItemButton, ListItemText, ListItemIcon} from "@mui/material";
import {Add} from "@mui/icons-material";

export default function ListProjects({
  loading,
  projects,
  selection,
  onClick,
  onNewClick,
}) {
  // strings

  const addS = "Nouveau dossier";
  const addDescriptionS = "Créer un nouveau dossier";
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
