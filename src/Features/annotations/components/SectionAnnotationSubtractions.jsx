import { useState } from "react";

import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Button,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

import db, { withSystemWrite } from "App/db/db";

import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import useBaseMap from "Features/baseMaps/hooks/useBaseMap";
import ListAnnotationSubtractions from "./ListAnnotationSubtractions";

import bakeAnnotationSubtractionsService, {
  getBakeSubtractionMessage,
  isAnnotationSubtractionBakeable,
} from "Features/annotationMesh3d/services/bakeAnnotationSubtractionsService";

// « Soustraction » section of the annotation properties panel: the
// annotations subtracted from this one (live relations, recomputed at every
// build) with « Soustraire définitivement », which bakes them into the host
// geometry (the host becomes a 3D mesh, the cutters are kept), and the
// annotations this one is subtracted from. Self-hiding without relation.
export default function SectionAnnotationSubtractions({ annotation }) {
  // strings

  const titleS = "Soustraction";
  const targetsS = "Annotations soustraites";
  const sourcesS = "Soustraite de";
  const bakeS = "Soustraire définitivement";
  const bakeHelpS =
    "Grave les trous dans la géométrie de l'annotation (convertie en mesh 3D) : ils restent même si les annotations soustraites sont supprimées.";
  const notBakeableS =
    "Cette annotation ne peut pas être soustraite définitivement";
  const doneS = "Soustraction définitive appliquée (Ctrl+Z pour annuler)";

  // data

  const dispatch = useDispatch();
  const { relsBySource, relsByTarget } = useAnnotationSubtractions();
  const rels = relsBySource.get(annotation?.id) ?? [];
  // reverse side: the annotations this one is carved out of, so a relation
  // created via the "À soustraire de" mode is readable and removable from both
  // ends.
  const reverseRels = relsByTarget.get(annotation?.id) ?? [];
  const baseMap = useBaseMap({
    id: rels.length ? annotation?.baseMapId : null,
  });

  // state

  const [baking, setBaking] = useState(false);

  // helpers

  const bakeable = isAnnotationSubtractionBakeable(annotation);
  const targets = annotation?.subtractionTargets ?? [];

  // handlers

  async function handleRefresh() {
    // Force a recompute of the annotations pipeline (3D carve + quantities),
    // e.g. after the height of a subtracted annotation was changed. The
    // useAnnotationsV2 liveQuery observes db.annotations natively, so a
    // touch-write on the source row is what re-triggers it (a pure Redux
    // dispatch would no longer refresh anything). withSystemWrite lets the
    // recompute work on annotations owned by another user.
    await withSystemWrite(() =>
      db.annotations.update(annotation.id, {
        updatedAt: new Date().toISOString(),
      })
    );
    dispatch(
      setToaster({ message: "Soustraction recalculée", severity: "info" })
    );
  }

  async function handleBake() {
    if (!baseMap) return;
    setBaking(true);
    try {
      const result = await bakeAnnotationSubtractionsService({
        host: annotation,
        targets,
        baseMapsById: { [baseMap.id]: baseMap },
        dispatch,
      });
      dispatch(
        setToaster(
          result.status === "done"
            ? { message: doneS, severity: "success" }
            : {
                message: getBakeSubtractionMessage(result.reason),
                severity: "warning",
              }
        )
      );
    } finally {
      setBaking(false);
    }
  }

  // render

  if (rels.length === 0 && reverseRels.length === 0) return null;

  return (
    <Box
      sx={{
        p: 2,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
        {titleS}
      </Typography>

      {rels.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              {targetsS}
            </Typography>
            <Tooltip title="Relancer la soustraction">
              <IconButton size="small" onClick={handleRefresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <ListAnnotationSubtractions annotationId={annotation?.id} />

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            {bakeHelpS}
          </Typography>
          <Tooltip title={bakeable ? "" : notBakeableS}>
            <Box component="span" sx={{ alignSelf: "flex-start" }}>
              <Button
                variant="outlined"
                size="small"
                onClick={handleBake}
                disabled={!bakeable || baking || !baseMap || !targets.length}
                startIcon={
                  baking ? <CircularProgress size={14} color="inherit" /> : null
                }
                sx={{ textTransform: "none" }}
              >
                {bakeS}
              </Button>
            </Box>
          </Tooltip>
        </Box>
      )}

      {reverseRels.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {sourcesS}
          </Typography>
          <ListAnnotationSubtractions
            annotationId={annotation?.id}
            direction="SOURCES"
          />
        </Box>
      )}
    </Box>
  );
}
