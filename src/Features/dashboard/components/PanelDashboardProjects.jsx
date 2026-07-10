import { useDispatch } from "react-redux";

import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import { Box, Typography, List, Divider } from "@mui/material";
import { TravelExplore, CloudOff } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import SearchBar from "Features/search/components/SearchBar";
import ButtonFetchMyKrtos from "./ButtonFetchMyKrtos";
import SectionFavoriteKrtos from "./SectionFavoriteKrtos";
import ListItemDashboardProject from "./ListItemDashboardProject";
import SectionCloudSearchResults from "./SectionCloudSearchResults";

export default function PanelDashboardProjects({
  searchText,
  onSearchTextChange,
  items,
  cloudItems,
  selectedKey,
  installingKey,
  onSelectItem,
  favorites,
  onOpenFavorite,
  onUnfavorite,
  onFetchMyKrtos,
  myKrtosLoading,
  remoteSearchLoading,
}) {
  const dispatch = useDispatch();

  // data

  const appConfig = useAppConfig();

  // strings

  const searchS = appConfig?.strings?.scope?.search ?? "Rechercher un Krto";
  const noProjectS =
    appConfig?.strings?.scope?.noProjectInstalled ?? "Aucun projet installé";
  const noProjectFoundS =
    appConfig?.strings?.scope?.noProjectFound ??
    "Aucun projet trouvé pour cette recherche.";

  // helpers

  const hasSearch = Boolean(searchText?.trim());
  const empty = !items?.length && !cloudItems?.length && !remoteSearchLoading;

  // handlers

  function handleCreateClick() {
    dispatch(setOpenScopeCreator(true));
  }

  // render

  return (
    <Box
      sx={{
        width: 400,
        flex: "0 0 400px",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid",
        borderColor: "divider",
        minHeight: 0,
      }}
    >
      {/* search + create + my krtos */}
      <Box sx={{ p: 2, pb: 1 }}>
        <SearchBar
          value={searchText}
          onChange={onSearchTextChange}
          placeholder={searchS}
          onCreateClick={handleCreateClick}
        />
        <Box sx={{ mt: 1 }}>
          <ButtonFetchMyKrtos onClick={onFetchMyKrtos} loading={myKrtosLoading} />
        </Box>
      </Box>

      {/* favorites */}
      <SectionFavoriteKrtos
        favorites={favorites}
        onOpen={onOpenFavorite}
        onUnfavorite={onUnfavorite}
      />

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
              Recherchez un projet ci-dessus pour l’ouvrir depuis le cloud, ou
              récupérez tous vos Krtos.
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
    </Box>
  );
}
