import { useEffect, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { Box, Card, TextField, Typography } from "@mui/material";

import updateCircleSegmentation from "Features/threedEditor/services/updateCircleSegmentation";
import {
  DEFAULT_ARC_SEGMENTS_PER_CIRCLE,
  DEFAULT_REVOLUTION_SEGMENTS_PER_CIRCLE,
  MAX_ARC_SEGMENTS_PER_CIRCLE,
  MAX_REVOLUTION_SEGMENTS_PER_CIRCLE,
  MIN_SEGMENTS_PER_CIRCLE,
} from "Features/geometry/utils/circleSegmentation";

// One count field: typed freely, committed on blur / Enter (each commit
// rebuilds the curved 3D objects — not on every keystroke).
function FieldSegments({ label, value, max, onCommit }) {
  // state

  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  // handlers

  function commit() {
    const n = Math.round(parseFloat(draft));
    if (Number.isFinite(n) && n !== value) onCommit(n);
    else setDraft(String(value));
  }

  // render

  return (
    <TextField
      size="small"
      type="number"
      label={label}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.target.blur();
      }}
      slotProps={{
        htmlInput: { min: MIN_SEGMENTS_PER_CIRCLE, max, step: 1 },
      }}
      sx={{ flex: 1 }}
    />
  );
}

// "Courbes" card of the 3D view settings (PanelThreedProperties): chords per
// full circle of the 3D meshes — see geometry/utils/circleSegmentation.
export default function SectionCircleSegmentation3d() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Courbes";
  const descriptionS = `Nombre de cordes pour un cercle complet. « Arcs » : surfaces et lignes dessinées avec des arcs (cercle extrudé, mur courbe) — ${DEFAULT_ARC_SEGMENTS_PER_CIRCLE} par défaut. « Révolutions » : disques et solides de révolution — ${DEFAULT_REVOLUTION_SEGMENTS_PER_CIRCLE} par défaut. Les quantités des formes courbes sont calculées sur ce même découpage. Validez avec Entrée.`;
  const arcS = "Arcs";
  const revolutionS = "Révolutions";

  // data

  const { arc, revolution } = useSelector(
    (s) => s.threedEditor.circleSegmentation
  );

  // render

  return (
    <Card variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {titleS}
      </Typography>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: "block", mb: 1.5 }}
      >
        {descriptionS}
      </Typography>
      <Box sx={{ display: "flex", gap: 1 }}>
        <FieldSegments
          label={arcS}
          value={arc}
          max={MAX_ARC_SEGMENTS_PER_CIRCLE}
          onCommit={(n) => dispatch(updateCircleSegmentation({ arc: n }))}
        />
        <FieldSegments
          label={revolutionS}
          value={revolution}
          max={MAX_REVOLUTION_SEGMENTS_PER_CIRCLE}
          onCommit={(n) =>
            dispatch(updateCircleSegmentation({ revolution: n }))
          }
        />
      </Box>
    </Card>
  );
}
