import { useState } from "react";

import { useSelector, useDispatch } from "react-redux";

import { setVertexSizeMultiplier } from "Features/mapEditor/mapEditorSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import { saveVertexSizeMultiplier } from "Features/mapEditor/services/editorSettingsLocalStorage";
import purgeDeletedAnnotationsService from "Features/annotations/services/purgeDeletedAnnotationsService";

import {
  Box,
  Card,
  Typography,
  IconButton,
  Tooltip,
  Button,
  CircularProgress,
} from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

// Reference (×1) is the current hardcoded vertex size (POINT_SIZE = 6 in
// NodePolylineStatic); the two larger options scale it up. boxSize is only the
// on-screen preview square inside each option button.
const VERTEX_SIZES = [
  { multiplier: 1, boxSize: 6 },
  { multiplier: 1.5, boxSize: 9 },
  { multiplier: 2, boxSize: 12 },
];

// 2D editor settings content, rendered by the right-panel SETTINGS tool
// (PanelEditorSettings) — the sole entry point since the bottom-toolbar
// toggle was removed. First option: vertex handle size used by
// NodePolylineStatic; then the deleted-annotations purge.
export default function SectionEditorSettings2d() {
  // data

  const dispatch = useDispatch();
  const vertexSizeMultiplier = useSelector(
    (s) => s.mapEditor.vertexSizeMultiplier
  );
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  // purge deleted annotations/points ("Purger les suppressions"): idle →
  // confirming → running → done result string.
  const [purgeState, setPurgeState] = useState("idle");
  const [purgeResult, setPurgeResult] = useState(null);

  // handlers

  async function handleConfirmPurge() {
    if (!projectId || !scopeId) return;
    setPurgeState("running");
    try {
      const res = await purgeDeletedAnnotationsService({ projectId, scopeId });
      // Healed (un-tombstoned) points change no row count and no indexed
      // field, so the reactivity contract (scoped counts + _dbWriteTick) can
      // miss them — force a re-read so repaired annotations reappear at once.
      if (res.healedPoints > 0) dispatch(triggerAnnotationsUpdate());
      setPurgeResult(res);
      setPurgeState("done");
    } catch (e) {
      console.error("[SectionEditorSettings2d] purge failed", e);
      setPurgeResult(null);
      setPurgeState("idle");
    }
  }

  function handleSelectVertexSize(multiplier) {
    dispatch(setVertexSizeMultiplier(multiplier));
    saveVertexSizeMultiplier(multiplier);
  }

  // render

  return (
    <Box sx={{ px: 2, py: 1.5, minWidth: 240 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {"Paramétrage de l'éditeur 2D"}
      </Typography>

      <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Vertex
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 0.25,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            Taille vertex
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {VERTEX_SIZES.map(({ multiplier, boxSize }) => {
              const isSelected = vertexSizeMultiplier === multiplier;
              return (
                <Tooltip key={multiplier} title={`×${multiplier}`}>
                  <span>
                    <IconButton
                      size="small"
                      onClick={() => handleSelectVertexSize(multiplier)}
                    >
                      <Box
                        sx={{
                          width: boxSize,
                          height: boxSize,
                          border: "2px solid",
                          borderColor: isSelected
                            ? "primary.main"
                            : "text.secondary",
                          bgcolor: isSelected ? "primary.main" : "transparent",
                          borderRadius: 0.5,
                        }}
                      />
                    </IconButton>
                  </span>
                </Tooltip>
              );
            })}
          </Box>
        </Box>
      </Card>

      <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
          Maintenance
        </Typography>

        {purgeState === "done" && purgeResult ? (
          <Typography variant="caption" color="success.main">
            {`Purge terminée : ${purgeResult.purgedAnnotations} annotation(s) et ${purgeResult.purgedPoints} point(s) supprimés.` +
              (purgeResult.healedPoints
                ? ` ${purgeResult.healedPoints} point(s) réparé(s).`
                : "")}
          </Typography>
        ) : purgeState === "confirming" ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Supprime définitivement les annotations effacées et les points
              orphelins du scope courant. Action irréversible.
            </Typography>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                color="error"
                variant="contained"
                onClick={handleConfirmPurge}
              >
                Confirmer
              </Button>
              <Button size="small" onClick={() => setPurgeState("idle")}>
                Annuler
              </Button>
            </Box>
          </Box>
        ) : (
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={
              purgeState === "running" ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <DeleteSweepIcon />
              )
            }
            disabled={purgeState === "running" || !projectId || !scopeId}
            onClick={() => setPurgeState("confirming")}
          >
            Purger les suppressions
          </Button>
        )}
      </Card>
    </Box>
  );
}
