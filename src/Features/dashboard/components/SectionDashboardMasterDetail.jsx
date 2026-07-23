import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setSelectedProjectKeyInDashboard } from "../dashboardSlice";

import useDashboardRemoteSearch from "../hooks/useDashboardRemoteSearch";
import useDashboardProjectItems from "../hooks/useDashboardProjectItems";
import useFavoriteKrtoItems from "../hooks/useFavoriteKrtoItems";
import useScopeFavorites from "Features/scopeFavorites/hooks/useScopeFavorites";
import useScopeConfigurationsByUser from "Features/remoteScopeConfigurations/hooks/useScopeConfigurationsByUser";
import useCreateProject from "Features/projects/hooks/useCreateProject";

import db from "App/db/db";

import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

import PanelDashboardProjects from "./PanelDashboardProjects";
import PanelDashboardProjectDetail from "./PanelDashboardProjectDetail";
import SectionFavoriteKrtos from "./SectionFavoriteKrtos";
import SectionDailyScopes from "./SectionDailyScopes";

import {
  PAGE_BG,
  CARD_BORDER,
  AMBER_GLOW,
  glow,
} from "../utils/dashboardStyles";

export default function SectionDashboardMasterDetail() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const getScopeConfigurationsByUser = useScopeConfigurationsByUser();
  const createProject = useCreateProject();
  const { removeFavorite, fetchFavorites } = useScopeFavorites();
  const favoriteItems = useFavoriteKrtoItems();

  const selectedKey = useSelector(
    (s) => s.dashboard.selectedProjectKeyInDashboard
  );

  // state

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(null); // CHANTIER | OPPORTUNITE | null
  const [myKrtosLoading, setMyKrtosLoading] = useState(false);
  const [installingKey, setInstallingKey] = useState(null);
  const [favoritesRefreshing, setFavoritesRefreshing] = useState(false);

  // items

  const { remoteProjects, remoteScopeConfigs, loading: remoteSearchLoading } =
    useDashboardRemoteSearch(searchText, typeFilter);

  const { items, cloudItems, selectedItem } = useDashboardProjectItems({
    searchText,
    typeFilter,
    remoteProjects,
    remoteScopeConfigs,
  });

  // handlers

  async function handleSelectItem(item, options) {
    // clicking the selected row again deselects it
    const toggle = !options?.noToggle;
    if (toggle && item.key === selectedKey) {
      dispatch(setSelectedProjectKeyInDashboard(null));
      return;
    }

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
      handleSelectItem(item, { noToggle: true });
    } else if (favorite.isLocal) {
      dispatch(setSelectedProjectKeyInDashboard(targetKey));
    }
  }

  // opens the krto directly from the favorite vignette (mirrors the
  // project-detail scope row "Ouvrir" action)
  function handleOpenKrto(favorite) {
    if (favorite.isLocal) {
      dispatch(setSelectedScopeId(favorite.scopeId));
      if (favorite.projectId != null) {
        dispatch(setSelectedProjectId(favorite.projectId));
      }
      navigate("/");
    } else {
      // remote krto — install & open via the existing loader route
      navigate(`/scopes/${favorite.scopeId}`);
    }
  }

  function handleUnfavorite(favorite) {
    removeFavorite(favorite.scopeId);
  }

  async function handleRefreshFavorites() {
    setFavoritesRefreshing(true);
    await fetchFavorites();
    setFavoritesRefreshing(false);
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
        position: "relative",
        overflow: "hidden",
        bgcolor: PAGE_BG,
      }}
    >
      {/* warm gradient band + orange glows (model 2a) */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 340,
          pointerEvents: "none",
          background: (theme) =>
            `linear-gradient(180deg, ${alpha(
              theme.palette.secondary.main,
              0.1
            )} 0%, ${alpha(theme.palette.secondary.main, 0.03)} 70%, ${alpha(
              theme.palette.secondary.main,
              0
            )} 100%)`,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: -120,
          right: -80,
          width: 520,
          height: 520,
          borderRadius: "50%",
          pointerEvents: "none",
          background: (theme) =>
            `radial-gradient(circle, ${alpha(
              theme.palette.secondary.main,
              0.14
            )} 0%, ${alpha(theme.palette.secondary.main, 0)} 70%)`,
          ...glow,
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: -60,
          left: "22%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          pointerEvents: "none",
          background: `radial-gradient(circle, ${alpha(
            AMBER_GLOW,
            0.12
          )} 0%, ${alpha(AMBER_GLOW, 0)} 70%)`,
        }}
      />
      <PanelDashboardProjects
        searchText={searchText}
        onSearchTextChange={setSearchText}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        items={items}
        cloudItems={cloudItems}
        selectedKey={selectedKey}
        installingKey={installingKey}
        onSelectItem={handleSelectItem}
        onFetchMyKrtos={handleFetchMyKrtos}
        myKrtosLoading={myKrtosLoading}
        remoteSearchLoading={remoteSearchLoading}
      />
      {/* right side: favorites on top, then project detail (inset panel) or
          the "daily scopes" placeholder when no project is selected */}
      <Box
        sx={{
          flex: "1 1 50%",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          p: 2,
          px: 4,
          pt: 6,
          position: "relative",
          overflowY: "auto",
        }}
      >
        {selectedItem ? (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              minHeight: 0,
              bgcolor: "white",
              border: `1px solid ${CARD_BORDER}`,
              borderRadius: 4,
              boxShadow: "0 2px 10px rgba(28,27,26,.06)",
              overflow: "hidden",
              p: 1,
            }}
          >
            <PanelDashboardProjectDetail item={selectedItem} />
          </Box>
        ) : (
          <>
            <SectionFavoriteKrtos
              favorites={favoriteItems}
              onOpen={handleOpenFavorite}
              onOpenKrto={handleOpenKrto}
              onUnfavorite={handleUnfavorite}
              onRefresh={handleRefreshFavorites}
              refreshing={favoritesRefreshing}
            />
            <SectionDailyScopes />
          </>
        )}
      </Box>
    </Box>
  );
}
