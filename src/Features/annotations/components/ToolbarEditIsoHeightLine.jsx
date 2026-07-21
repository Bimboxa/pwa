import { useDispatch } from "react-redux";

import { setSubSelection } from "Features/selection/selectionSlice";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import DeleteOutline from "@mui/icons-material/DeleteOutline";

import useSelectedIsoHeightLineData from "Features/annotations/hooks/useSelectedIsoHeightLineData";
import useUpdateIsoHeightLine from "Features/annotations/hooks/useUpdateIsoHeightLine";
import useDeleteIsoHeightLine from "Features/annotations/hooks/useDeleteIsoHeightLine";

import FieldAnnotationHeight from "./FieldAnnotationHeight";

// Inline editor for the currently sub-selected isoHeightLine ("Courbe de
// niveau"). An iso line has a single height (meters, offsetTop semantics vs
// the polygon's offsetZ): every point of the line sits at that height. Same
// field UI as the guideLine edit row.
export default function ToolbarEditIsoHeightLine({ accentColor }) {
  const dispatch = useDispatch();

  // data

  const { annotation, index, height, hasIsoHeightLine } =
    useSelectedIsoHeightLineData();
  const updateIsoHeightLine = useUpdateIsoHeightLine();
  const deleteIsoHeightLine = useDeleteIsoHeightLine();

  // Stable synthetic id so FieldAnnotationHeight's sync effect tracks the
  // selected iso line and re-syncs when its height changes externally.
  const lineId = `${annotation?.id}::ISO::${index}`;

  // handlers

  function handleHeightChange(o) {
    updateIsoHeightLine(index, { height: Number(o.isoHeight) || 0 });
  }

  async function handleDelete() {
    await deleteIsoHeightLine({ annotationId: annotation?.id, index });
    dispatch(setSubSelection({ partId: null, partType: null }));
  }

  // render

  if (!annotation || !hasIsoHeightLine) return null;

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
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Courbe de niveau
      </Typography>
      <FieldAnnotationHeight
        annotation={{ id: lineId, isoHeight: height }}
        field="isoHeight"
        label="Hauteur"
        unit="m"
        onChange={handleHeightChange}
      />
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Supprimer la courbe de niveau">
        <IconButton
          size="small"
          onClick={handleDelete}
          sx={{
            color: "text.disabled",
            "&:hover": {
              color: accentColor || "text.primary",
              bgcolor: (accentColor || "#000") + "18",
            },
          }}
        >
          <DeleteOutline fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
