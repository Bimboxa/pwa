import { useState } from "react";

import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

import { setSelectedScopeId } from "Features/scopes/scopesSlice";
import { setSelectedProjectId } from "Features/projects/projectsSlice";
import { setOpenScopeCreator } from "Features/scopeCreator/scopeCreatorSlice";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useScopeFavorites from "Features/scopeFavorites/hooks/useScopeFavorites";
import getPresetScopeLabel from "../utils/getPresetScopeLabel";

import { Box, Typography, Button } from "@mui/material";
import { Add, TouchApp, GridOn } from "@mui/icons-material";

import HeaderDashboardProject from "./HeaderDashboardProject";
import ListItemDashboardScope from "./ListItemDashboardScope";
import DialogDeleteScope from "Features/scopes/components/DialogDeleteScope";

export default function PanelDashboardProjectDetail({ item }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // data

  const appConfig = useAppConfig();
  const { isFavorite, toggleFavorite } = useScopeFavorites();

  // state

  const [deleteScopeId, setDeleteScopeId] = useState(null);

  // strings

  const krtoS = appConfig?.strings?.scope?.nameSingular ?? "Krto";
  const newKrtoS = appConfig?.strings?.scope?.new ?? "Nouveau Krto";

  // helpers

  const rows = item
    ? [
        ...item.scopes.map((scope) => ({
          scopeId: scope.id,
          name: scope.name,
          type: getPresetScopeLabel(appConfig, scope.presetScopeKey),
          isLocal: true,
          isFavorite: isFavorite(scope.id),
        })),
        ...item.remoteConfigs.map((config) => ({
          scopeId: config.scopeId,
          name: config.scopeName,
          type: null,
          isLocal: false,
          isFavorite: isFavorite(config.scopeId),
        })),
      ]
    : [];

  const count = rows.length;

  // handlers

  function handleToggleFavorite(row) {
    toggleFavorite({
      scopeId: row.scopeId,
      scopeName: row.name,
      projectName: item?.name,
      projectClientRef: item?.clientRef,
      projectType: item?.type,
    });
  }

  function handleOpen(row) {
    if (row.isLocal) {
      dispatch(setSelectedScopeId(row.scopeId));
      dispatch(setSelectedProjectId(item.projectId));
      navigate("/");
    } else {
      // remote scope — install & open via the existing loader flow
      navigate(`/scopes/${row.scopeId}`);
    }
  }

  function handleNewKrto() {
    if (!item?.projectId) return;
    dispatch(setSelectedProjectId(item.projectId));
    dispatch(setOpenScopeCreator(true));
  }

  // render — no selection

  if (!item) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "text.secondary",
          bgcolor: "#fbfbfd",
        }}
      >
        <TouchApp sx={{ fontSize: "3rem", color: "#d0d0dd" }} />
        <Typography sx={{ mt: 1.5, fontWeight: 600, color: "text.primary" }}>
          Sélectionnez un projet
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          Ses {krtoS}s s’afficheront ici.
        </Typography>
      </Box>
    );
  }

  // render

  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        bgcolor: "#fbfbfd",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <HeaderDashboardProject item={item} />

      {/* krtos bar */}
      <Box
        sx={{
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography variant="h6">{krtoS}s</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {count} élément{count > 1 ? "s" : ""}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="secondary"
          startIcon={<Add />}
          onClick={handleNewKrto}
          disabled={!item.projectId}
        >
          {newKrtoS}
        </Button>
      </Box>

      {/* krtos list */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, pb: 3 }}>
        {count === 0 ? (
          <Box
            sx={{
              border: "1.5px dashed #dcdce6",
              borderRadius: 3,
              py: 7,
              textAlign: "center",
              color: "text.secondary",
              bgcolor: "white",
            }}
          >
            <GridOn sx={{ fontSize: "2.4rem", color: "#d0d0dd" }} />
            <Typography sx={{ mt: 1.5, fontWeight: 600, color: "text.primary" }}>
              Aucun {krtoS} dans ce projet
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              Créez le premier {krtoS} pour commencer le repérage.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Add />}
              onClick={handleNewKrto}
              disabled={!item.projectId}
              sx={{ mt: 2 }}
            >
              Créer le premier {krtoS}
            </Button>
          </Box>
        ) : (
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "white",
            }}
          >
            {rows.map((row) => (
              <ListItemDashboardScope
                key={row.scopeId}
                row={row}
                onToggleFavorite={handleToggleFavorite}
                onOpen={handleOpen}
                onDelete={(r) => setDeleteScopeId(r.scopeId)}
              />
            ))}
          </Box>
        )}
      </Box>

      <DialogDeleteScope
        open={Boolean(deleteScopeId)}
        onClose={() => setDeleteScopeId(null)}
        scopeId={deleteScopeId}
      />
    </Box>
  );
}
