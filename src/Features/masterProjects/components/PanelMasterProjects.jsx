import useMasterProjects from "../hooks/useMasterProjects";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedProjectId } from "Features/projects/projectsSlice";

import { Typography } from "@mui/material";

import PanelVariantMap from "Features/layout/components/PanelVariantMap";
import ListMasterProjects from "./ListMasterProjects";
import SectionCreateMasterProject from "./SectionCreateMasterProject";

export default function PanelMasterProjects({ gmap, gmapContainer }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // strings

  const title = "Chantiers";

  // data

  const masterProjects = useMasterProjects();

  // handlers

  function handleClick(project) {
    dispatch(setSelectedProjectId(project.id));
    navigate("/");
  }

  // render

  return (
    <PanelVariantMap>
      <Typography sx={{ p: 2 }} variant="h4">
        {title}
      </Typography>
      <ListMasterProjects projects={masterProjects} onClick={handleClick} />
      <SectionCreateMasterProject gmap={gmap} gmapContainer={gmapContainer} />
    </PanelVariantMap>
  );
}
