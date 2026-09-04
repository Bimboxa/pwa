import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import { CloudUpload, Map as MapIcon } from "@mui/icons-material";

import db from "App/db/db";

import useNotesAppScopeLink from "../hooks/useNotesAppScopeLink";
import pushNotesAppBaseMap from "../services/pushNotesAppBaseMap";

// Base maps of the project listed in the Sync panel, one small push button
// per row: sends the ACTIVE version's image to Krnet (storage upload +
// base_maps upsert). Pulled plans (idMaster set) show as linked; a
// Bimboxa-authored plan gets linked on its first push.
export default function SectionNotesAppBaseMapsSync() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Fonds de plan → Krnet";
  const helperS = "Envoie l'image de la version active";
  const emptyS = "Aucun fond de plan dans le dossier.";
  const linkedS = "Lié à Krnet";
  const notLinkedS = "Non lié";

  // data

  const { link } = useNotesAppScopeLink();
  const projectId = useSelector((s) => s.projects.selectedProjectId);

  const baseMaps = useLiveQuery(async () => {
    if (!projectId) return [];
    const rows = await db.baseMaps.where("projectId").equals(projectId).toArray();
    return rows
      .filter((b) => !b.deletedAt && !b.isDetail && !b.isPhoto)
      .sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  }, [projectId]);

  // state

  const [pushingIds, setPushingIds] = useState([]);

  // handlers

  async function handlePush(baseMap) {
    if (pushingIds.includes(baseMap.id)) return;
    setPushingIds((ids) => [...ids, baseMap.id]);
    try {
      await pushNotesAppBaseMap({
        baseMap,
        notesAppProjectId: link?.projectId,
      });
      dispatch(
        setToaster({ message: `"${baseMap.name}" envoyé vers Krnet` })
      );
    } catch (e) {
      console.error("[notesApp] base map push failed", e);
      const message =
        e?.code === "NOTES_APP_NOT_SIGNED_IN"
          ? "Connectez-vous à Krnet pour envoyer"
          : `Echec de l'envoi : ${e.message ?? e}`;
      dispatch(setToaster({ message, isError: true }));
    } finally {
      setPushingIds((ids) => ids.filter((id) => id !== baseMap.id));
    }
  }

  // render

  if (!link?.projectId) return null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Box sx={{ px: 1, pt: 1, display: "flex", alignItems: "baseline", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {titleS}
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {helperS}
        </Typography>
      </Box>

      {baseMaps?.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ px: 1, py: 0.5 }}>
          {emptyS}
        </Typography>
      )}

      <Box sx={{ px: 1, py: 0.5 }}>
        {(baseMaps ?? []).map((baseMap) => {
          const pushing = pushingIds.includes(baseMap.id);
          const linked = Boolean(baseMap.idMaster);
          return (
            <Box
              key={baseMap.id}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                py: 0.25,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  minWidth: 0,
                }}
              >
                <MapIcon fontSize="small" color="action" />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" noWrap>
                    {baseMap.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {linked ? linkedS : notLinkedS}
                  </Typography>
                </Box>
              </Box>
              {pushing ? (
                <CircularProgress size={18} sx={{ m: 1 }} />
              ) : (
                <IconButton
                  size="small"
                  onClick={() => handlePush(baseMap)}
                  title={helperS}
                >
                  <CloudUpload fontSize="small" />
                </IconButton>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
