import { useState } from "react";

import { Box, Typography, Button } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Add, TravelExplore, CloudOff } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import SearchBar from "Features/search/components/SearchBar";
import ToggleProjectType from "Features/projectSelector/components/ToggleProjectType";
import ButtonFetchMyKrtos from "./ButtonFetchMyKrtos";
import ButtonLoadKrtoFile from "Features/krtoFile/components/ButtonLoadKrtoFile";
import TableDashboardProjects from "./TableDashboardProjects";
import SectionCloudSearchResults from "./SectionCloudSearchResults";
import DialogCreateProject from "./DialogCreateProject";

import {
  ICON_FADED,
  PILL_TEXT,
  PILL_BUTTON_SX,
  PILL_SEARCH_SX,
  SEGMENT_TOGGLE_SX,
  fadeUp,
} from "../utils/dashboardStyles";

export default function PanelDashboardProjects({
  searchText,
  onSearchTextChange,
  typeFilter,
  onTypeFilterChange,
  items,
  cloudItems,
  selectedKey,
  installingKey,
  onSelectItem,
  onFetchMyKrtos,
  myKrtosLoading,
  remoteSearchLoading,
}) {
  // data

  const appConfig = useAppConfig();

  // state

  const [openCreateProject, setOpenCreateProject] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState(() => new Set());

  // strings

  const searchS =
    appConfig?.strings?.scope?.searchProject ?? "Rechercher un projet";
  const createProjectS =
    appConfig?.strings?.project?.createInDashboard ?? "Nouveau projet";
  const noProjectS =
    appConfig?.strings?.scope?.noProjectInstalled ?? "Aucun projet installé";
  const noProjectHintS =
    appConfig?.strings?.scope?.noProjectInstalledHint ??
    "Recherchez un projet ci-dessus pour l'ouvrir depuis le cloud, ou récupérez tous vos dossiers.";
  const noProjectFoundS =
    appConfig?.strings?.scope?.noProjectFound ??
    "Aucun projet trouvé pour cette recherche.";

  // helpers

  const typeOptions =
    appConfig?.features?.projectSelector?.filterByType?.options ?? [];

  const hasSearch = Boolean(searchText?.trim());
  const empty = !items?.length && !cloudItems?.length && !remoteSearchLoading;

  // handlers

  function handleCreateClick() {
    setOpenCreateProject(true);
  }

  function handleToggleExpand(item) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(item.key)) next.delete(item.key);
      else next.add(item.key);
      return next;
    });
  }

  // render

  return (
    <Box
      sx={{
        flex: "1 1 50%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        position: "relative",
      }}
    >
      {/* line 1: search + create (pill style, model 2a) */}
      <Box
        sx={{
          px: 4,
          pt: 12,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          ...fadeUp(0.05),
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, ...PILL_SEARCH_SX }}>
          <SearchBar
            value={searchText}
            onChange={onSearchTextChange}
            placeholder={searchS}
          />
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<Add />}
          onClick={handleCreateClick}
          sx={{
            flexShrink: 0,
            whiteSpace: "nowrap",
            borderRadius: 999,
            height: 48,
            px: 3,
            color: PILL_TEXT,
            bgcolor: alpha("#ffffff", 0.7),
            borderColor: (theme) => alpha(theme.palette.secondary.main, 0.45),
            "& .MuiButton-startIcon": { color: "secondary.main" },
            transition: "all .2s",
            "&:hover": {
              color: "secondary.main",
              borderColor: "secondary.main",
              bgcolor: (theme) => alpha(theme.palette.secondary.main, 0.06),
            },
          }}
        >
          {createProjectS}
        </Button>
      </Box>

      {/* line 2: list header with filters (left) and actions (right) */}
      <Box
        sx={{
          px: 4,
          mt: 8,
          pb: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          ...fadeUp(0.15),
        }}
      >
        <Box sx={{ flexShrink: 0, ...SEGMENT_TOGGLE_SX }}>
          <ToggleProjectType
            value={typeFilter}
            valueOptions={typeOptions}
            onChange={onTypeFilterChange}
          />
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <ButtonLoadKrtoFile
            variant="outlined"
            size="small"
            sx={{
              ...PILL_BUTTON_SX,
              height: 30,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          />
          <ButtonFetchMyKrtos
            onClick={onFetchMyKrtos}
            loading={myKrtosLoading}
          />
        </Box>
      </Box>

      {/* projects list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3.5, py: 1 }}>
        {empty && hasSearch && (
          <Box
            sx={{ textAlign: "center", color: "text.secondary", mt: 6, px: 3 }}
          >
            <CloudOff sx={{ fontSize: "2.4rem", color: ICON_FADED }} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {noProjectFoundS}
            </Typography>
          </Box>
        )}

        {empty && !hasSearch && (
          <Box
            sx={{ textAlign: "center", color: "text.secondary", mt: 5, px: 3 }}
          >
            <TravelExplore sx={{ fontSize: "2.6rem", color: ICON_FADED }} />
            <Typography
              sx={{ mt: 1.5, fontWeight: 600, color: "text.primary" }}
            >
              {noProjectS}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              {noProjectHintS}
            </Typography>
            <Box sx={{ mt: 2 }}>
              <ButtonFetchMyKrtos
                onClick={onFetchMyKrtos}
                loading={myKrtosLoading}
                variant="contained"
              />
            </Box>
          </Box>
        )}

        {items?.length > 0 && (
          <Box sx={{ py: 0.5 }}>
            <TableDashboardProjects
              items={items}
              selectedKey={selectedKey}
              installingKey={installingKey}
              expandedKeys={expandedKeys}
              onSelectItem={onSelectItem}
              onToggleExpand={handleToggleExpand}
            />
          </Box>
        )}

        {hasSearch && (
          <SectionCloudSearchResults
            cloudItems={cloudItems}
            loading={remoteSearchLoading}
            selectedKey={selectedKey}
            installingKey={installingKey}
            expandedKeys={expandedKeys}
            onSelectItem={onSelectItem}
            onToggleExpand={handleToggleExpand}
          />
        )}
      </Box>

      <DialogCreateProject
        open={openCreateProject}
        onClose={() => setOpenCreateProject(false)}
      />
    </Box>
  );
}
