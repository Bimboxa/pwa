import { useDispatch, useSelector } from "react-redux";

import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedScopeId } from "Features/scopes/scopesSlice";

import useSelectedProject from "Features/projects/hooks/useSelectedProject";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import { IconButton, Box } from "@mui/material";

import HomeIcon from "@mui/icons-material/Home";
import ButtonDialogOnboardingSelectProject from "Features/projects/components/ButtonDialogOnboardingSelectProject";

export default function TopBarBreadcrumbs() {
  const dispatch = useDispatch();

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

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
  }

  // components

  const Home = () => (
    <IconButton onClick={handleClickHome}>
      <HomeIcon />
    </IconButton>
  );

  const Project = () => <Box>{selectedProject?.name}</Box>;

  // render

  if (noProject && noScope) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Home />
        <ButtonDialogOnboardingSelectProject />
      </Box>
    );
  } else if (noScope) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Home />
        <Project />
      </Box>
    );
  } else {
    return <Box>salut</Box>;
  }
}
