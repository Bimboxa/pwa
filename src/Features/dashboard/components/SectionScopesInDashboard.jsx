import { useState } from "react";

import { useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import useScopes from "Features/scopes/hooks/useScopes";
import useProjects from "Features/projects/hooks/useProjects";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import SearchBar from "Features/search/components/SearchBar";
import DatagridScopes from "Features/scopes/components/DatagridScopes";

import getFoundItems from "Features/search/getFoundItems";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

export default function SectionScopesInDashboard() {
  const dispatch = useDispatch();
  // data

  const { value: scopes } = useScopes({ withProject: true });
  const { value: projects } = useProjects();
  const appConfig = useAppConfig();

  // state

  const [searchText, setSearchText] = useState("");

  // helpers

  const searchS = appConfig?.strings.scope.search ?? "Rechercher un dossier";

  const scopesByProjectId = scopes?.reduce((ac, cur) => {
    ac[cur.projectId] = ac[cur.projectId] || [];
    ac[cur.projectId].push(cur);
    return ac;
  }, {})



  let items = scopes?.map((scope) => ({
    ...scope,
    scopeName: scope.name,
    scopeClientRef: scope.clientRef,
    scopeProjectName: scope.project?.name,
    scopeProjectClientRef: scope.project?.clientRef,
  }));

  projects.forEach(project => {
    if (!project || !scopesByProjectId) return;
    const scopes = scopesByProjectId[project.id];
    if (!scopes?.length > 0) {
      items.push({
        id: project.id,
        scopeId: null,
        projectId: project.id,
        scopeName: "Toutes les listes",
        scopeClientRef: "-",
        scopeProjectName: project.name,
        scopeProjectClientRef: project.clientRef,
      })
    }

  })

  const foundItems = getFoundItems({
    items: items,
    searchText,
    searchKeys: [
      "scopeName",
      "scopeClientRef",
      "scopeProjectName",
      "scopeProjectClientRef",
    ],
  });

  console.log("debug_foundItems", foundItems)

  // return
  return (
    <BoxFlexVStretch sx={{ p: 3 }}>
      <Box sx={{ width: 1, p: 1, display: "flex", alignItems: "center" }}>
        <SearchBar
          value={searchText}
          onChange={setSearchText}
          placeholder={searchS}
          onCreateClick={() => dispatch(setOpenScopeCreator(true))}
        />
      </Box>
      <BoxFlexVStretch sx={{ p: 1 }}>
        <DatagridScopes scopes={foundItems} />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
