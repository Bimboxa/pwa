import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import useProjects from "Features/projects/hooks/useProjects";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import DatagridProjects from "Features/projects/components/DatagridProjects";
import SectionSelectProject from "Features/projectSelector/components/SectionSelectProject";
import DialogGeneric from "Features/layout/components/DialogGeneric";

import getFoundItems from "Features/search/getFoundItems";

export default function SectionProjectsInDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const { value: projects } = useProjects();
  const appConfig = useAppConfig();

  // state

  const [searchText, setSearchText] = useState("");
  const [open, setOpen] = useState(false);

  // helpers

  const searchS = appConfig?.strings.project.search ?? "Rechercher un dossier";

  const items = projects?.map((project) => ({
    ...project,
    projectName: project.name,
    projectClientRef: project.clientRef,
  }));

  const foundItems = getFoundItems({
    items: items,
    searchText,
    searchKeys: ["projectName", "projectClientRef"],
  });

  // handlers

  function handleNewProjectClick() {
    setOpen(true);
  }

  function handleProjectSelected(project) {
    console.log("selected project", project);
    setOpen(false);
    if (project) {
      dispatch(setSelectedProjectId(project?.id));
      navigate("/");
    }
  }

  // return
  return (
    <>
      <BoxFlexVStretch sx={{ p: 3 }}>
        <Box sx={{ width: 1, p: 1, display: "flex", alignItems: "center" }}>
          <SearchBar
            value={searchText}
            onChange={setSearchText}
            placeholder={searchS}
            onCreateClick={handleNewProjectClick}
          />
        </Box>
        <BoxFlexVStretch sx={{ p: 1 }}>
          <DatagridProjects projects={foundItems} />
        </BoxFlexVStretch>
      </BoxFlexVStretch>

      {open && (
        <DialogGeneric
          open={open}
          onClose={() => setOpen(false)}
          width="300px"
          vh="70"
        >
          <SectionSelectProject onProjectSelected={handleProjectSelected} />
        </DialogGeneric>
      )}
    </>
  );
}
