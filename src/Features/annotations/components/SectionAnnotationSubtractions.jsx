import { useDispatch } from "react-redux";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

import { setToaster } from "Features/layout/layoutSlice";

import db, { withSystemWrite } from "App/db/db";

import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import ListAnnotationSubtractions from "./ListAnnotationSubtractions";

export default function SectionAnnotationSubtractions({ annotation }) {
  // data

  const dispatch = useDispatch();
  const { relsBySource, relsByTarget } = useAnnotationSubtractions();
  const rels = relsBySource.get(annotation?.id) ?? [];
  // reverse side: the annotations this one is carved out of, so a relation
  // created via the "À soustraire de" mode is readable and removable from both
  // ends.
  const reverseRels = relsByTarget.get(annotation?.id) ?? [];

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

  // render

  if (rels.length === 0 && reverseRels.length === 0) return null;

  return (
    <>
      {rels.length > 0 && (
        <Box
          sx={{
            width: 1,
            p: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
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
              Soustractions
            </Typography>
            <Tooltip title="Relancer la soustraction">
              <IconButton size="small" onClick={handleRefresh}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <ListAnnotationSubtractions annotationId={annotation?.id} />
        </Box>
      )}

      {reverseRels.length > 0 && (
        <Box
          sx={{
            width: 1,
            p: 1,
            display: "flex",
            flexDirection: "column",
            gap: 0.5,
          }}
        >
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Soustraite de
          </Typography>
          <ListAnnotationSubtractions
            annotationId={annotation?.id}
            direction="SOURCES"
          />
        </Box>
      )}
    </>
  );
}
