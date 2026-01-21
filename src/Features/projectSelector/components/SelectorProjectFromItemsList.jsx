import { useState } from "react";
import { useNavigate } from "react-router-dom";

import useProjectsItems from "../hooks/useProjectsItems";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ItemsListVariantSimple from "Features/itemsList/components/ItemsListVariantSimple";
import ToggleProjectType from "./ToggleProjectType";
import IconButtonFetchMasterProjects from "Features/masterProjects/components/IconButtonFetchMasterProjects";


export default function SelectorProjectFromItemsList({
  onClick,
  onCreateClick,
}) {
  const navigate = useNavigate();

  // data

  const items = useProjectsItems();
  const appConfig = useAppConfig();

  // state

  const [projectType, setProjectType] = useState(null);

  // helpers

  const filterByProjectType = appConfig?.features?.projectSelector?.filterByProjectType;
  const valueOptions = filterByProjectType?.options;


  // handlers

  function handleClick(project) {
    console.log("click", project);
    //navigate("/dashboard");
    if (onClick) {
      onClick(project);
    }
  }

  function handleCreateProject() {
    if (onCreateClick) {
      onCreateClick();
    }
  }

  return (
    <BoxFlexVStretch>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <ToggleProjectType
          value={projectType}
          valueOptions={valueOptions}
          onChange={setProjectType}
        />
        <IconButtonFetchMasterProjects />
      </Box>


      <ItemsListVariantSimple
        items={items}
        onClick={handleClick}
        searchKeys={["name"]}
        onCreateClick={handleCreateProject}
      />
    </BoxFlexVStretch>
  );
}
