import { useState } from "react";
import { useNavigate } from "react-router-dom";

import useProjectsItems from "../hooks/useProjectsItems";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useInitFetchMasterProjects from "Features/masterProjects/hooks/useInitFetchMasterProjects";

import { Box, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ItemsListVariantSimple from "Features/itemsList/components/ItemsListVariantSimple";
import ToggleProjectType from "./ToggleProjectType";
import IconButtonFetchMasterProjects from "Features/masterProjects/components/IconButtonFetchMasterProjects";


export default function SelectorProjectFromItemsList({
  onClick,
  onCreateClick,
}) {

  // effect - init

  useInitFetchMasterProjects();

  // data

  let items = useProjectsItems();
  const appConfig = useAppConfig();

  // state

  const [projectType, setProjectType] = useState(null);


  // helpers

  if (projectType) items = items.filter((item) => item.type === projectType);

  // helpers

  const filterByType = appConfig?.features?.projectSelector?.filterByType;
  const valueOptions = filterByType?.options;


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
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", p: 1, position: "relative", py: 3 }}>
        <ToggleProjectType
          value={projectType}
          valueOptions={valueOptions}
          onChange={setProjectType}
        />
        <Box sx={{ position: "absolute", right: "8px", top: "0", bottom: "0", display: "flex", alignItems: "center" }}>
          <IconButtonFetchMasterProjects filterByProjectType={projectType} />
        </Box>

      </Box>


      <ItemsListVariantSimple
        items={items}
        onClick={handleClick}
        searchKeys={["name", "clientRef", "primaryText", "secondaryText"]}
        onCreateClick={handleCreateProject}
        maxItems={50}
      />
      <Box sx={{ p: 1, display: "flex", justifyContent: "flex-end" }}>
        <Typography sx={{ fontSize: "12px", color: "text.secondary" }}>{`x ${items?.length}`}</Typography>
      </Box>
    </BoxFlexVStretch>
  );
}
