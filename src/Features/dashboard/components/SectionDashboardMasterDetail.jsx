import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedProjectKeyInDashboard } from "../dashboardSlice";

import useDashboardRemoteSearch from "../hooks/useDashboardRemoteSearch";
import useDashboardProjectItems from "../hooks/useDashboardProjectItems";
import useFavoriteKrtoItems from "../hooks/useFavoriteKrtoItems";
import useScopeFavorites from "Features/scopeFavorites/hooks/useScopeFavorites";
import useScopeConfigurationsByUser from "Features/remoteScopeConfigurations/hooks/useScopeConfigurationsByUser";
import useCreateProject from "Features/projects/hooks/useCreateProject";

import db from "App/db/db";

import { Box } from "@mui/material";

import PanelDashboardProjects from "./PanelDashboardProjects";
import PanelDashboardProjectDetail from "./PanelDashboardProjectDetail";

export default function SectionDashboardMasterDetail() {
  const dispatch = useDispatch();

  // data

  const getScopeConfigurationsByUser = useScopeConfigurationsByUser();
  const createProject = useCreateProject();
  const { removeFavorite } = useScopeFavorites();
  const favoriteItems = useFavoriteKrtoItems();

  const selectedKey = useSelector(
    (s) => s.dashboard.selectedProjectKeyInDashboard
  );

  // state

  const [searchText, setSearchText] = useState("");
  const [myKrtosLoading, setMyKrtosLoading] = useState(false);
  const [installingKey, setInstallingKey] = useState(null);

  // items

  const { remoteProjects, remoteScopeConfigs, loading: remoteSearchLoading } =
    useDashboardRemoteSearch(searchText);

  const { items, cloudItems, selectedItem } = useDashboardProjectItems({
    searchText,
    remoteProjects,
    remoteScopeConfigs,
  });

  // handlers

  async function handleSelectItem(item) {
    if (item.isLocal) {
      dispatch(setSelectedProjectKeyInDashboard(item.key));
      return;
    }

    // remote project — install it locally (Dexie), then select it
    try {
      setInstallingKey(item.key);

      let project = item.clientRef
        ? await db.projects.where("clientRef").equals(item.clientRef).first()
        : null;

      if (!project) {
        project = await createProject({
          name: item.name,
          clientRef: item.clientRef,
          type: item.type,
          idMaster: item.idMaster,
        });
      }

      if (project) {
        dispatch(setSelectedProjectKeyInDashboard(`local_${project.id}`));
        setSearchText("");
      }
    } catch (error) {
      console.error("[dashboard] install project error", error);
    } finally {
      setInstallingKey(null);
    }
  }

  function handleOpenFavorite(favorite) {
    const targetKey = favorite.projectKey;
    const item =
      items.find((i) => i.key === targetKey) ??
      cloudItems.find((i) => i.key === targetKey);
    if (item) {
      handleSelectItem(item);
    } else if (favorite.isLocal) {
      dispatch(setSelectedProjectKeyInDashboard(targetKey));
    }
  }

  function handleUnfavorite(favorite) {
    removeFavorite(favorite.scopeId);
  }

  async function handleFetchMyKrtos() {
    try {
      setMyKrtosLoading(true);
      await getScopeConfigurationsByUser();
    } catch (error) {
      // endpoint may not be live yet — degrade silently
      console.error("[dashboard] fetch my krtos error", error);
    } finally {
      setMyKrtosLoading(false);
    }
  }

  // render

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        minHeight: 0,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <PanelDashboardProjects
        searchText={searchText}
        onSearchTextChange={setSearchText}
        items={items}
        cloudItems={cloudItems}
        selectedKey={selectedKey}
        installingKey={installingKey}
        onSelectItem={handleSelectItem}
        favorites={favoriteItems}
        onOpenFavorite={handleOpenFavorite}
        onUnfavorite={handleUnfavorite}
        onFetchMyKrtos={handleFetchMyKrtos}
        myKrtosLoading={myKrtosLoading}
        remoteSearchLoading={remoteSearchLoading}
      />
      <PanelDashboardProjectDetail item={selectedItem} />
    </Box>
  );
}
