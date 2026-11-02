import { useState } from "react";
import PropTypes from "prop-types";
import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setToaster } from "Features/layout/layoutSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";

import db from "App/db/db";
import {
  refreshSweepAlongLineService,
  SWEEP_ERROR_MESSAGES,
} from "../services/sweepAlongLineService";

// Row of ToolbarEditAnnotation shown for an annotation created by « Extruder
// le long d'une ligne » (annotation.sweepSources): names its guide and its
// profile, and « Actualiser la 3D » rebuilds the ring from the guide and
// re-applies the profile (refreshSweepAlongLineService). Disabled when the
// guide was deleted (the profile alone may be missing: the ring is still
// refreshed).
export default function RowSweepSourcesRefresh({ annotation }) {
  const dispatch = useDispatch();

  // strings

  const captionS = "Extrudé le long d'une ligne";
  const refreshS = "Actualiser la 3D (recalculer depuis le guide et le profil)";
  const guideMissingS = "Le guide a été supprimé : impossible d'actualiser";
  const doneS = "Annotation actualisée depuis ses sources";
  const profileMissingS =
    "Tracé actualisé depuis le guide ; le profil n'existe plus, la section est conservée";

  // data

  const sources = annotation?.sweepSources;
  const guideId = sources?.guideAnnotationId ?? null;
  const profileId = sources?.profileAnnotationId ?? null;
  const guide = useLiveQuery(
    () => (guideId ? db.annotations.get(guideId) : null),
    [guideId]
  );
  const profile = useLiveQuery(
    () => (profileId ? db.annotations.get(profileId) : null),
    [profileId]
  );

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  const guideOk = Boolean(guide && !guide.deletedAt);
  const profileOk = Boolean(profile && !profile.deletedAt);
  const labelOf = (a, fallback) => a?.label || fallback;
  const sourcesS = `Guide : ${
    guideOk ? labelOf(guide, "ligne sans nom") : "supprimé"
  } · Profil : ${profileOk ? labelOf(profile, "ligne sans nom") : "supprimé"}`;

  // handlers

  async function handleRefresh() {
    if (!annotation?.id || busy) return;
    setBusy(true);
    try {
      const result = await refreshSweepAlongLineService({
        annotationId: annotation.id,
        dispatch,
      });
      if (result?.error) {
        dispatch(
          setToaster({
            message:
              SWEEP_ERROR_MESSAGES[result.error] ?? "Actualisation impossible",
            severity: "warning",
          })
        );
        return;
      }
      dispatch(
        setToaster({
          message: result.mode ? doneS : profileMissingS,
          severity: result.mode ? "success" : "info",
        })
      );
    } catch (e) {
      console.error("[sweepAlongLine] refresh", e);
      dispatch(
        setToaster({ message: "Actualisation impossible", severity: "error" })
      );
    } finally {
      setBusy(false);
    }
  }

  // render

  if (!sources) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Tooltip title={sourcesS}>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", fontStyle: "italic" }}
        >
          {captionS}
        </Typography>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <Tooltip title={guideOk ? refreshS : guideMissingS}>
        <span>
          <IconButton
            size="small"
            onClick={handleRefresh}
            disabled={!guideOk || busy}
            sx={{
              color: "text.disabled",
              "&:hover": { bgcolor: "action.hover", color: "text.primary" },
            }}
          >
            <RefreshIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}

RowSweepSourcesRefresh.propTypes = {
  annotation: PropTypes.shape({
    id: PropTypes.string,
    sweepSources: PropTypes.shape({
      guideAnnotationId: PropTypes.string,
      profileAnnotationId: PropTypes.string,
    }),
  }),
};
