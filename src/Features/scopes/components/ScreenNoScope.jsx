import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useSelectedProject from "Features/projects/hooks/useSelectedProject";

import { Box, Button, Typography } from "@mui/material";
import { Add, Home } from "@mui/icons-material";

// Blocking screen shown instead of the modules when the selected project has
// no scope: the user either creates one or goes back to the dashboard.
export default function ScreenNoScope() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const viewerMode = useSelector((s) => s.urlParams.viewerMode);
  const { value: project } = useSelectedProject();

  // strings

  const titleS =
    appConfig?.strings?.scope?.noneInProject ??
    "Aucun plan de repérage dans ce projet";
  const descriptionS =
    appConfig?.strings?.scope?.noneInProjectDescription ??
    "Créez-en un pour commencer à travailler dans ce projet.";
  const newS = appConfig?.strings?.scope?.new ?? "Nouveau dossier";
  const dashboardS = "Retour au tableau de bord";

  // handlers

  function handleCreate() {
    dispatch(setOpenScopeCreator(true));
  }

  function handleBackToDashboard() {
    dispatch(setSelectedProjectId(null));
    navigate("/dashboard");
  }

  // render

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        p: 3,
        bgcolor: "background.default",
        textAlign: "center",
      }}
    >
      {project?.name && (
        <Typography variant="overline" color="text.secondary">
          {project.name}
        </Typography>
      )}
      <Typography variant="h6">{titleS}</Typography>
      <Typography variant="body2" color="text.secondary">
        {descriptionS}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <Button startIcon={<Home />} onClick={handleBackToDashboard}>
          {dashboardS}
        </Button>
        {!viewerMode && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreate}
          >
            {newS}
          </Button>
        )}
      </Box>
    </Box>
  );
}
