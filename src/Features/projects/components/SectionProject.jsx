import {useDispatch} from "react-redux";

import {
  setNewProject,
  setEditedProject,
  setIsEditingProject,
} from "../projectsSlice";

import useIsMobile from "Features/layout/hooks/useIsMobile";
import useProject from "../hooks/useProject";

import {Box} from "@mui/material";

import FormProject from "./FormProject";
import SectionProjectBottomActions from "./SectionProjectBottomActions";

export default function SectionProject({options, onSaved}) {
  const dispatch = useDispatch();

  // data

  const {value: project, loading} = useProject(options);
  const isMobile = useIsMobile();

  // helpers

  const width = isMobile ? 1 : "400px";

  // handlers

  function handleChange(project) {
    if (!project.id) {
      dispatch(setNewProject(project));
    } else {
      dispatch(setEditedProject(project));
      dispatch(setIsEditingProject(true));
    }
  }

  return (
    <Box sx={{width}}>
      {!loading && <FormProject project={project} onChange={handleChange} />}
      <SectionProjectBottomActions
        forceNew={options.forceNew}
        onSaved={onSaved}
      />
    </Box>
  );
}
