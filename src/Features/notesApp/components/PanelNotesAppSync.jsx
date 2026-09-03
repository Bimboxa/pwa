import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import { Box, Divider, Typography } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import HeaderTitleClose from "Features/layout/components/HeaderTitleClose";
import ButtonInPanel from "Features/layout/components/ButtonInPanel";

import useNotesAppConfig from "../hooks/useNotesAppConfig";
import useNotesAppSession from "../hooks/useNotesAppSession";
import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import useSyncNotesAppScope from "../hooks/useSyncNotesAppScope";

import SectionNotesAppConnection from "./SectionNotesAppConnection";
import SectionNotesAppProjectLink from "./SectionNotesAppProjectLink";
import SectionNotesAppListingsMapping from "./SectionNotesAppListingsMapping";

// The "Sync" right-panel tool: connection to notes-app (Krnet), "dossier"
// (remote project) linked to the selected scope, listings mapping table and
// the pull button.
export default function PanelNotesAppSync() {
  const dispatch = useDispatch();

  // data

  const config = useNotesAppConfig();
  const appName = config?.name ?? "Krnet";
  const { session } = useNotesAppSession();
  const { scope, link } = useNotesAppScopeLink();
  const syncSelectedScope = useSyncNotesAppScope();
  const syncStatus = useSelector((s) => s.notesApp.syncStatus);

  // strings

  const titleS = `Données ${appName}`;
  const noScopeS = "Sélectionnez une mission pour lier ses données.";
  const fetchS = "Récupérer les données";
  const syncS = "Synchroniser";

  // helpers

  const syncing = syncStatus?.status === "syncing";
  const lastSyncAtS = link?.lastSyncAt
    ? new Date(link.lastSyncAt).toLocaleString("fr-FR")
    : null;

  // handlers

  function handleClose() {
    dispatch(setSelectedMenuItemKey(null));
  }

  async function handleSync() {
    if (syncing) return;
    await syncSelectedScope();
  }

  // render

  return (
    <BoxFlexVStretch>
      <HeaderTitleClose title={titleS} onClose={handleClose} />

      <SectionNotesAppConnection appName={appName} />

      {session && !scope?.id && (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
          {noScopeS}
        </Typography>
      )}

      {session && scope?.id && (
        <>
          <Divider />
          <SectionNotesAppProjectLink appName={appName} />
        </>
      )}

      {session && scope?.id && link?.projectId && (
        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: "auto" }}>
          <SectionNotesAppListingsMapping appName={appName} />
        </Box>
      )}

      {session && scope?.id && link?.projectId && (
        <Box>
          {syncing && syncStatus?.step && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1, display: "block" }}
            >
              {`Synchronisation... (${syncStatus.step})`}
            </Typography>
          )}
          {!syncing && lastSyncAtS && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1, display: "block" }}
            >
              {`Dernière synchro : ${lastSyncAtS}`}
            </Typography>
          )}
          <ButtonInPanel
            label={link?.lastSyncAt ? syncS : fetchS}
            onClick={handleSync}
            loading={syncing}
            disabled={syncing}
          />
        </Box>
      )}
    </BoxFlexVStretch>
  );
}
