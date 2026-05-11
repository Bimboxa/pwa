import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";

import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import { IconButton, Box, Typography, Tooltip } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import { ViewSidebar } from "@mui/icons-material";

import { setLeftPanelDocked } from "Features/leftPanel/leftPanelSlice";
import ButtonGeneric from "./ButtonGeneric";
import ButtonDialogOnboardingSelectProject from "Features/projects/components/ButtonDialogOnboardingSelectProject";
import ButtonDialogOnboardingSelectScope from "Features/scopes/components/ButtonDialogOnboardingSelectScope";

export default function TopBarBreadcrumbs() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);

  const { value: selectedProject } = useSelectedProject();
  const { value: selectedScope } = useSelectedScope();

  // helper

  const noProject = !Boolean(projectId);
  const noScope = !Boolean(scopeId);

  console.log("projectId and scopeId", noProject, noScope, projectId);

  // handlers

  function handleClickHome() {
    dispatch(setSelectedProjectId(null));
    dispatch(setSelectedScopeId(null));
    navigate("/dashboard");
  }

  // components

  const Separator = () => (
    <Box
      sx={{
        height: "18px",
        borderRight: "1px solid",
        borderColor: (theme) => theme.palette.divider,
      }}
    />
  );

  const Home = () => (
    <IconButton onClick={handleClickHome}>
      <HomeIcon />
    </IconButton>
  );

  const ToggleDock = () => (
    <Tooltip
      title={
        leftPanelDocked
          ? "Masquer le panneau latéral"
          : "Garder le panneau latéral ouvert"
      }
    >
      <IconButton
        size="small"
        onClick={() => dispatch(setLeftPanelDocked(!leftPanelDocked))}
        sx={{
          color: "action.active",
          bgcolor: leftPanelDocked ? "action.selected" : "transparent",
          borderRadius: 1,
          p: 0.5,
        }}
      >
        <ViewSidebar sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );

  const Project = () => (
    <Box sx={{ maxWidth: 200, display: "flex" }}>
      <Tooltip title={selectedProject?.name}>
        <ButtonGeneric
          label={selectedProject?.name}
          onClick={() => dispatch(setSelectedScopeId(null))}
        />
      </Tooltip>
    </Box>
  );

  const Scope = () => (
    <ButtonGeneric
      label={selectedScope?.name}
    //onClick={() => dispatch(setSelectedScopeId(null))}
    />
  );

  // render

  if (noProject && noScope) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Home />
        <ToggleDock />
        <Separator />
        <ButtonDialogOnboardingSelectProject />
      </Box>
    );
    // } else if (noScope) {
    //   return (
    //     <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
    //       <Home />
    //       <Separator />
    //       <Project />
    //       <Separator />
    //       <ButtonDialogOnboardingSelectScope />
    //     </Box>
    //   );
  } else {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Home />
        <ToggleDock />
        <Separator />
        <Project />
        {/* <Separator />
        <Scope /> */}
      </Box>
    );
  }
}
