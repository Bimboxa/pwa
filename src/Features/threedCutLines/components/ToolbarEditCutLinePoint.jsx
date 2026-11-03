import { useDispatch } from "react-redux";

import { Box, Button, Switch, Tooltip, Typography } from "@mui/material";

import db from "App/db/db";
import useSelectedPointsData from "Features/points/hooks/useSelectedPointsData";
import useUpdateSelectedPoints from "Features/points/hooks/useUpdateSelectedPoints";
import {
  setSelectedPointIds,
  setSubSelection,
} from "Features/selection/selectionSlice";

import encodeCutLineRefs from "../utils/encodeCutLineRefs";

// Point row of the floating toolbar for the sub-selected vertex of a CUT_LINE
// (ToolbarEditAnnotation): the « Stop » switch (the line ends at this point:
// what lies beyond it, towards the nearest end, is hidden and ignored by
// the meshing), the « Point prolongé » mention of a point the extension
// added, and the removal of the vertex (a line keeps at least 2 points).
export default function ToolbarEditCutLinePoint() {
  const dispatch = useDispatch();

  // strings

  const stopS = "Stop";
  const stopTooltipS =
    "Le trait de coupe s'arrête à ce point : ce qui est au-delà est masqué";
  const derivedS = "Point prolongé";
  const removeS = "Supprimer le point";

  // data

  const { annotation, selectedPoints } = useSelectedPointsData();
  const updateSelectedPoints = useUpdateSelectedPoints();

  // helpers

  const first = selectedPoints[0];
  const count = selectedPoints.length;
  const canRemove = count === 1 && (annotation?.points?.length ?? 0) > 2;

  // handlers

  function handleStopChange(e) {
    updateSelectedPoints({ stop: e.target.checked ? true : undefined });
  }

  async function handleRemove() {
    if (!first?.id || !annotation?.id) return;
    const raw = await db.annotations.get(annotation.id);
    if (!raw?.points || raw.points.length <= 2) return;
    const index = raw.points.findIndex((p) => p.id === first.id);
    if (index < 0) return;
    // Re-encode so offsetZ stays the lowest remaining vertex.
    const offsetZ = raw.offsetZ || 0;
    const kept = raw.points.filter((_, i) => i !== index);
    const encoded = encodeCutLineRefs(
      kept.map((ref) => ({
        x: 0,
        y: 0,
        offset: offsetZ + (ref.offsetBottom || 0),
        derived: ref.derived,
        stop: ref.stop,
      }))
    );
    const points = kept.map((ref, i) => ({
      ...ref,
      offsetBottom: encoded.points[i].offsetBottom,
    }));
    dispatch(setSelectedPointIds([]));
    dispatch(setSubSelection({ pointId: null, partType: null, partId: null }));
    await db.annotations.update(annotation.id, {
      points,
      offsetZ: encoded.offsetZ,
    });
  }

  // render

  if (!count) return null;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.25,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Tooltip title={stopTooltipS}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Switch
            size="small"
            checked={Boolean(first?.stop)}
            onChange={handleStopChange}
          />
          <Typography variant="body2">{stopS}</Typography>
        </Box>
      </Tooltip>
      {first?.derived && (
        <Typography variant="caption" color="text.secondary">
          {derivedS}
        </Typography>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {canRemove && (
        <Button size="small" color="inherit" onClick={handleRemove}>
          {removeS}
        </Button>
      )}
    </Box>
  );
}
