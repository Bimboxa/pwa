import { useState } from "react";

import { Box, Typography, List, Divider, Button } from "@mui/material";
import { Add, TravelExplore, CloudOff } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import SearchBar from "Features/search/components/SearchBar";
import ToggleProjectType from "Features/projectSelector/components/ToggleProjectType";
import ButtonFetchMyKrtos from "./ButtonFetchMyKrtos";
import ListItemDashboardProject from "./ListItemDashboardProject";
import SectionCloudSearchResults from "./SectionCloudSearchResults";
import DialogCreateProject from "./DialogCreateProject";

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

  // strings

  const searchS =
    appConfig?.strings?.scope?.searchProject ?? "Rechercher un projet";
  const noProjectS =
    appConfig?.strings?.scope?.noProjectInstalled ?? "Aucun projet installé";
  const noProjectHintS =
    appConfig?.strings?.scope?.noProjectInstalledHint ??
    "Recherchez un projet ci-dessus pour l'ouvrir depuis le cloud, ou récupérez tous vos plans de repérage.";
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

  // render

  return (
    <Box
      sx={{
        flex: "1 1 50%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* toggle chantier/opportunité + search + create */}
      <Box sx={{ px: 2, pt: 12, pb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              flexShrink: 0,
              "& .MuiToggleButtonGroup-root": { bgcolor: "white" },
            }}
          >
            <ToggleProjectType
              value={typeFilter}
              valueOptions={typeOptions}
              onChange={onTypeFilterChange}
            />
          </Box>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              // full width even when not focused, so the placeholder is not truncated
              "& .MuiFormControl-root": { width: 1 },
              "& .MuiOutlinedInput-root": { bgcolor: "white" },
            }}
          >
            <SearchBar
              value={searchText}
              onChange={onSearchTextChange}
              placeholder={searchS}
            />
          </Box>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<Add />}
            onClick={handleCreateClick}
            sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            Nouveau projet
          </Button>
        </Box>
        {/* my krtos button */}
        <Box sx={{ mt: 8 }}>
          <ButtonFetchMyKrtos onClick={onFetchMyKrtos} loading={myKrtosLoading} />
        </Box>
      </Box>

      <Box sx={{ px: 2 }}>
        <Divider />
      </Box>

      {/* projects list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1 }}>
        {empty && hasSearch && (
          <Box sx={{ textAlign: "center", color: "text.secondary", mt: 6, px: 3 }}>
            <CloudOff sx={{ fontSize: "2.4rem", color: "#c7c7d6" }} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              {noProjectFoundS}
            </Typography>
          </Box>
        )}

        {empty && !hasSearch && (
          <Box sx={{ textAlign: "center", color: "text.secondary", mt: 5, px: 3 }}>
            <TravelExplore sx={{ fontSize: "2.6rem", color: "#c7c7d6" }} />
            <Typography sx={{ mt: 1.5, fontWeight: 600, color: "text.primary" }}>
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
          <List disablePadding>
            {items.map((item) => (
              <ListItemDashboardProject
                key={item.key}
                item={item}
                selected={item.key === selectedKey}
                installing={item.key === installingKey}
                onClick={() => onSelectItem(item)}
              />
            ))}
          </List>
        )}

        {hasSearch && (
          <SectionCloudSearchResults
            cloudItems={cloudItems}
            loading={remoteSearchLoading}
            selectedKey={selectedKey}
            installingKey={installingKey}
            onSelectItem={onSelectItem}
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
