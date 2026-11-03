import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSweepProfileAnnotationId } from "Features/mapEditor/mapEditorSlice";

import { Paper, Box, Typography, Button } from "@mui/material";

import IconExtrudeAlongLine from "Features/icons/IconExtrudeAlongLine";

import db from "App/db/db";
import {
  getSweepMode,
  SWEEP_MODE_ELEVATION,
} from "Features/annotations/services/sweepAlongLineService";
import getBaseMapDisplayName from "Features/baseMaps/utils/getBaseMapDisplayName";

// Floating helper shown while the « Extruder le long d'une ligne » pick mode
// is armed (mapEditor.sweepProfileAnnotationId): the armed profile, the
// instruction to click the guide, how the profile will be registered, the
// base map the result is created on, and the Escape shortcut. Mirrors
// PopperSubtractHelper (same mount points: the PopperMapListings chain, the
// docked Dessin panel, the 3D viewers).
//
// `targetBaseMapId`: the base map the swept annotation lands on (the 3D
// viewer passes its drawing base map); defaults to the main base map of the
// Dessin module, which is where the 2D pick creates it.
export default function PopperSweepAlongLineHelper({ targetBaseMapId = null }) {
  const dispatch = useDispatch();

  // data

  const profileAnnotationId = useSelector(
    (s) => s.mapEditor.sweepProfileAnnotationId
  );
  const mainBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const resolvedTargetBaseMapId = targetBaseMapId ?? mainBaseMapId ?? null;
  const targetBaseMap = useLiveQuery(
    () =>
      resolvedTargetBaseMapId ? db.baseMaps.get(resolvedTargetBaseMapId) : null,
    [resolvedTargetBaseMapId]
  );
  const profile = useLiveQuery(
    () =>
      profileAnnotationId ? db.annotations.get(profileAnnotationId) : null,
    [profileAnnotationId]
  );
  const template = useLiveQuery(
    () =>
      profile?.annotationTemplateId
        ? db.annotationTemplates.get(profile.annotationTemplateId)
        : null,
    [profile?.annotationTemplateId]
  );

  // strings

  const title = "Extruder le long d'une ligne";
  const instruction =
    "Cliquez sur la ligne ou la surface qui servira de guide : une nouvelle annotation est créée, le profil sélectionné balayé le long de ce guide.";
  const profileLabel = profile?.label || template?.label || "Ligne sans nom";
  const modeS =
    profile && getSweepMode(profile) === SWEEP_MODE_ELEVATION
      ? "Le profil a un point de référence : il est lu comme un dessin d'élévation (X = largeur, Y = hauteur) et posé sur le guide."
      : "Sans point de référence, l'extrusion passe par le profil tel qu'il est dessiné, même depuis un autre fond de plan.";
  const targetLabelS = "Créée sur le fond de plan";
  const targetName = targetBaseMap
    ? getBaseMapDisplayName(targetBaseMap)
    : { label: "fond de plan du guide", isPlaceholder: true };
  const cancelS = "Annuler";

  // handlers

  function handleCancel() {
    dispatch(setSweepProfileAnnotationId(null));
  }

  // render

  if (!profileAnnotationId) return null;

  return (
    <Paper
      elevation={4}
      data-capture-hide
      sx={{
        position: "absolute",
        top: 50,
        left: 50,
        zIndex: 10,
        width: 290,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: "grey.900",
          color: "common.white",
          borderTopLeftRadius: (t) => t.shape.borderRadius,
          borderTopRightRadius: (t) => t.shape.borderRadius,
        }}
      >
        <IconExtrudeAlongLine fontSize="small" />
        <Typography variant="subtitle2">{title}</Typography>
      </Box>

      <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Profil
          </Typography>
          <Typography variant="body2">{profileLabel}</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary">
          {instruction}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          {modeS}
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            {targetLabelS}
          </Typography>
          <Typography
            variant="body2"
            sx={{ fontStyle: targetName.isPlaceholder ? "italic" : "normal" }}
          >
            {targetName.label}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              px: 0.75,
              py: 0.25,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 0.5,
              fontSize: "0.7rem",
              fontWeight: 600,
              lineHeight: 1.4,
            }}
          >
            Esc
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            Quitter le mode
          </Typography>
          <Button size="small" color="inherit" onClick={handleCancel}>
            {cancelS}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

PopperSweepAlongLineHelper.propTypes = {
  targetBaseMapId: PropTypes.string,
};
