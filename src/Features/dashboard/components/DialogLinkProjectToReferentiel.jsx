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

import DialogGeneric from "Features/layout/components/DialogGeneric";
import SearchBar from "Features/search/components/SearchBar";
import ToggleProjectType from "Features/projectSelector/components/ToggleProjectType";
import ChipProjectType from "./ChipProjectType";

import { PILL_SEARCH_SX, SEGMENT_TOGGLE_SX } from "../utils/dashboardStyles";

// Dialog to link a local project to a référentiel entity (chantier /
// opportunité), single view: search by num / name, click the reference
// to select it (highlighted), then confirm with the "Relier" button —
// which spins while the backend processes the link.

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
  const [selectedEntity, setSelectedEntity] = useState(null);
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

  // helpers

  const typeOptions =
    appConfig?.features?.projectSelector?.filterByType?.options;

  const items = (remoteProjects ?? []).filter(
    (mp) => !typeFilter || !mp.type || mp.type === typeFilter
  );

  function getEntityKey(entity) {
    return entity?.idMaster ?? entity?.clientRef;
  }

  const selectedKey = getEntityKey(selectedEntity);

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
    if (linking) return;
    setSearchText("");
    setTypeFilter(null);
    setSelectedEntity(null);
    setError(null);
    onClose();
  }

  function handleSearchTextChange(text) {
    // a new search invalidates the current selection
    setSelectedEntity(null);
    setError(null);
    setSearchText(text);
  }

  function handleSelectEntity(entity) {
    if (linking) return;
    setError(null);
    // clicking the selected row again deselects it
    setSelectedEntity(getEntityKey(entity) === selectedKey ? null : entity);
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
      setLinking(false);
      handleClose();
      if (onLinked) onLinked();
    } catch (e) {
      console.error("[DialogLinkProjectToReferentiel] link error", e);
      setError(getErrorMessage(e));
      setLinking(false);
    }
  }

  // render

  return (
    <DialogGeneric open={open} onClose={handleClose} title={titleS} width={440}>
      <Box
        sx={{
          px: 2,
          py: 1,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          minHeight: 420,
        }}
      >
        {typeOptions && (
          <Box sx={SEGMENT_TOGGLE_SX}>
            <ToggleProjectType
              value={typeFilter}
              valueOptions={typeOptions}
              onChange={setTypeFilter}
            />
          </Box>
        )}
        <Box sx={{ width: 1, ...PILL_SEARCH_SX }}>
          <SearchBar
            value={searchText}
            onChange={handleSearchTextChange}
            placeholder={searchS}
          />
        </Box>
        {error && <Alert severity="error">{error}</Alert>}

        {/* results list */}
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
                  key={getEntityKey(mp)}
                  selected={getEntityKey(mp) === selectedKey}
                  onClick={() => handleSelectEntity(mp)}
                  sx={{
                    borderRadius: 1,
                    "&.Mui-selected": {
                      bgcolor: (theme) => theme.palette.secondary.main + "14",
                      "&:hover": {
                        bgcolor: (theme) => theme.palette.secondary.main + "1f",
                      },
                    },
                  }}
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

        {/* footer: confirm */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            pb: 1,
          }}
        >
          {selectedEntity && (
            <Typography
              variant="caption"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              {`« ${projectName} » prendra le nom et le numéro de
              « ${selectedEntity.name} », et ses Krtos seront ré-associés.`}
            </Typography>
          )}
          <Button
            variant="contained"
            color="secondary"
            onClick={handleConfirm}
            disabled={!selectedEntity || linking}
            fullWidth
            sx={{ height: 42 }}
          >
            {linking ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              confirmS
            )}
          </Button>
        </Box>
      </Box>
    </DialogGeneric>
  );
}
