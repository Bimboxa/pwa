import { useState } from "react";
import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";
import { Box, Button, Typography } from "@mui/material";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import getUserIdMaster from "Features/auth/utils/getUserIdMaster";
import {
  detectionArchiveKey,
  listDetectionDebug,
} from "../services/detectionDebugStore";
import ChatDetectionDebug from "./ChatDetectionDebug";

export default function ChatDetectionHistory() {
  const [open, setOpen] = useState(false);
  const profile = useSelector((s) => s.auth.userProfile);
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const baseMap = useMainBaseMap();
  const archiveKey = detectionArchiveKey(
    getUserIdMaster(profile),
    projectId,
    baseMap?.id
  );
  const state = useLiveQuery(
    async () => {
      if (!open || !archiveKey) return { rows: [] };
      try {
        return { rows: await listDetectionDebug(archiveKey) };
      } catch {
        return { rows: [], error: "Historique local indisponible." };
      }
    },
    [open, archiveKey],
    { rows: [] }
  );
  return (
    <Box sx={{ px: 1 }}>
      <Button
        size="small"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Historique des détections
      </Button>
      {open && (
        <Box sx={{ maxHeight: 350, overflow: "auto" }}>
          <Typography variant="caption" color="text.secondary">
            Les 30 dernières captures de ce plan, conservées dans ce navigateur.
            Effacer les données du navigateur les supprime.
          </Typography>
          {!archiveKey && (
            <Typography variant="caption" sx={{ display: "block" }}>
              Sélectionnez un plan et connectez-vous pour consulter
              l’historique.
            </Typography>
          )}
          {state.error && <Typography color="error">{state.error}</Typography>}
          {archiveKey && !state.error && state.rows.length === 0 && (
            <Typography variant="caption" sx={{ display: "block" }}>
              Aucune capture enregistrée.
            </Typography>
          )}
          {state.rows
            .filter((record) => record.archiveKey === archiveKey)
            .map((record) => (
              <ChatDetectionDebug key={record.id} record={record} />
            ))}
        </Box>
      )}
    </Box>
  );
}
