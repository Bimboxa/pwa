import { useState } from "react";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useDashboardRemoteSearch from "../hooks/useDashboardRemoteSearch";
import useLinkProjectToReferentiel, {
  LINK_ERROR,
} from "Features/projects/hooks/useLinkProjectToReferentiel";

import {
  Box,
  Typography,
  Button,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
} from "@mui/material";
import { ArrowBackIos } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SearchBar from "Features/search/components/SearchBar";
import ToggleProjectType from "Features/projectSelector/components/ToggleProjectType";
import ChipProjectType from "./ChipProjectType";

// Two-step dialog to link a local project to a référentiel entity
// (chantier / opportunité): pick the entity (remote search, référentiel
// only), then confirm — the project's name and clientRef become those of
// the entity, and its Krtos are re-associated.

export default function DialogLinkProjectToReferentiel({
  open,
  onClose,
  projectId,
  projectName,
  onLinked,
}) {
  // data

  const appConfig = useAppConfig();
  const { link } = useLinkProjectToReferentiel();

  // state

  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState(null); // CHANTIER | OPPORTUNITE | null
  const [selectedEntity, setSelectedEntity] = useState(null); // step 2 when set
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState(null);

  const { remoteProjects, loading } = useDashboardRemoteSearch(
    searchText,
    typeFilter
  );

  // strings

  const titleS = "Relier à un chantier / opportunité";
  const searchS = "Rechercher un chantier / opportunité";
  const confirmS = "Relier";
  const backS = "Retour";

  // helpers

  const typeOptions =
    appConfig?.features?.projectSelector?.filterByType?.options;

  const items = (remoteProjects ?? []).filter(
    (mp) => !typeFilter || !mp.type || mp.type === typeFilter
  );

  function getErrorMessage(e) {
    if (
      e?.type === LINK_ERROR.CLIENT_REF_TAKEN ||
      e?.type === LINK_ERROR.ID_MASTER_TAKEN
    ) {
      const p = e.project;
      return `Un projet est déjà relié à cette entité (${p?.name ?? "?"}${
        p?.clientRef ? ` — N° ${p.clientRef}` : ""
      }). Ouvrez-le, ou détachez-le d'abord.`;
    }
    return "Une erreur est survenue pendant la liaison.";
  }

  // handlers

  function handleClose() {
    setSearchText("");
    setTypeFilter(null);
    setSelectedEntity(null);
    setError(null);
    onClose();
  }

  function handleSelectEntity(entity) {
    setError(null);
    setSelectedEntity(entity);
  }

  async function handleConfirm() {
    if (!selectedEntity || linking) return;
    try {
      setLinking(true);
      setError(null);
      await link({
        projectId,
        masterProject: {
          idMaster: selectedEntity.idMaster,
          name: selectedEntity.name,
          clientRef: selectedEntity.clientRef,
          type: selectedEntity.type,
        },
      });
      handleClose();
      if (onLinked) onLinked();
    } catch (e) {
      console.error("[DialogLinkProjectToReferentiel] link error", e);
      setError(getErrorMessage(e));
    } finally {
      setLinking(false);
    }
  }

  // render — step 2: confirmation

  if (selectedEntity) {
    return (
      <DialogGeneric
        open={open}
        onClose={handleClose}
        title={titleS}
        width={440}
      >
        <Box
          sx={{
            px: 3,
            py: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ChipProjectType type={selectedEntity.type} />
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {selectedEntity.name}
            </Typography>
          </Box>
          {selectedEntity.clientRef && (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              N° {selectedEntity.clientRef}
            </Typography>
          )}
          <Alert severity="info">
            {`Le projet « ${projectName} » sera relié à cette entité. Son nom et
            son numéro deviendront ceux de l'entité, et tous ses Krtos seront
            ré-associés.`}
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
            <Button
              startIcon={<ArrowBackIos />}
              onClick={() => setSelectedEntity(null)}
              disabled={linking}
            >
              {backS}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleConfirm}
              disabled={linking}
            >
              {linking ? <CircularProgress size={18} /> : confirmS}
            </Button>
          </Box>
        </Box>
      </DialogGeneric>
    );
  }

  // render — step 1: picker

  return (
    <DialogGeneric open={open} onClose={handleClose} title={titleS} width={440}>
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          minHeight: 380,
        }}
      >
        {typeOptions && (
          <ToggleProjectType
            value={typeFilter}
            valueOptions={typeOptions}
            onChange={setTypeFilter}
          />
        )}
        <SearchBar
          value={searchText}
          onChange={setSearchText}
          placeholder={searchS}
        />
        {error && <Alert severity="error">{error}</Alert>}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : items.length === 0 ? (
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center", py: 4 }}
            >
              {searchText?.trim().length >= 2
                ? "Aucun résultat"
                : "Recherchez une entité du référentiel"}
            </Typography>
          ) : (
            <List dense disablePadding>
              {items.map((mp) => (
                <ListItemButton
                  key={mp.idMaster ?? mp.clientRef}
                  onClick={() => handleSelectEntity(mp)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 1 }}
                      >
                        <Typography noWrap sx={{ fontWeight: 500 }}>
                          {mp.name}
                        </Typography>
                        <ChipProjectType type={mp.type} />
                      </Box>
                    }
                    secondary={[
                      mp.clientRef ? `N° ${mp.clientRef}` : null,
                      mp.address?.city,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </Box>
    </DialogGeneric>
  );
}
