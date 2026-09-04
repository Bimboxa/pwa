import { useEffect, useState } from "react";

import {
  Box,
  Button,
  CircularProgress,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { Link as LinkIcon } from "@mui/icons-material";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import fetchNotesAppProjects from "../services/fetchNotesAppProjects";

// "Dossier" (notes-app project) linked to the selected scope: shows the link
// when set, otherwise lists the user's remote projects to pick from.
export default function SectionNotesAppProjectLink({ appName = "Krnet" }) {
  // strings

  const selectS = `Choisissez le dossier ${appName} à lier à cette mission`;
  const emptyS = "Aucun dossier accessible avec ce compte.";
  const unlinkS = "Délier";
  const errorS = "Impossible de récupérer les dossiers.";

  // data

  const { link, linkProject, unlinkProject } = useNotesAppScopeLink();

  // state

  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // effects - fetch the remote projects while no project is linked

  useEffect(() => {
    if (link?.projectId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchNotesAppProjects()
      .then((items) => {
        if (!cancelled) setProjects(items);
      })
      .catch((e) => {
        console.log("[notesApp] fetch projects failed", e);
        if (!cancelled) setError(errorS);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [link?.projectId]);

  // handlers

  async function handleSelectProject(project) {
    try {
      await linkProject(project);
    } catch (e) {
      console.log("[notesApp] link project failed", e);
      setError(e.message ?? "Liaison impossible.");
    }
  }

  async function handleUnlink() {
    try {
      await unlinkProject();
    } catch (e) {
      console.log("[notesApp] unlink project failed", e);
    }
  }

  // render - linked state

  if (link?.projectId) {
    return (
      <Box
        sx={{
          p: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
          <LinkIcon fontSize="small" color="action" />
          <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }}>
            {link.projectName ?? link.projectId}
          </Typography>
        </Box>
        <Button size="small" onClick={handleUnlink}>
          {unlinkS}
        </Button>
      </Box>
    );
  }

  // render - project picker

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
        {selectS}
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}

      {!loading && error && (
        <Typography variant="caption" color="error" sx={{ px: 1 }}>
          {error}
        </Typography>
      )}

      {!loading && !error && projects?.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
          {emptyS}
        </Typography>
      )}

      {!loading && projects?.length > 0 && (
        <List dense sx={{ overflow: "auto" }}>
          {projects.map((project) => (
            <ListItemButton
              key={project.projectId}
              onClick={() => handleSelectProject(project)}
            >
              <ListItemText
                primary={project.projectName}
                secondary={project.role}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
}
