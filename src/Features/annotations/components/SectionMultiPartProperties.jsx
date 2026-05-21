import { useDispatch, useSelector } from "react-redux";

import {
  selectSelectedPartIds,
  selectSelectedPointIds,
  setSelectedPartIds,
  setSelectedPointIds,
  toggleSelectedPartId,
  toggleSelectedPointId,
  clearSelectedPartIds,
  clearSelectedPointIds,
} from "Features/selection/selectionSlice";

import { Box, Stack, Typography, Chip, Button, Divider } from "@mui/material";

export default function SectionMultiPartProperties({ part }) {
  const dispatch = useDispatch();
  const pointIds = useSelector(selectSelectedPointIds);
  const partIds = useSelector(selectSelectedPartIds);

  if (!part || part.kind !== "MIXED") return null;

  const handleRemovePoint = (pointId) => {
    dispatch(toggleSelectedPointId(pointId));
  };

  const handleRemovePart = (partId) => {
    dispatch(toggleSelectedPartId(partId));
  };

  const handleClearGroup = (groupKind) => {
    if (groupKind === "POINTS") {
      dispatch(clearSelectedPointIds());
    } else if (groupKind === "SEGMENTS") {
      // Drop only segment / cut_seg parts; keep whole-cut entries.
      const next = partIds.filter((id) => {
        const t = id.split("::")[1];
        return t !== "SEG" && t !== "CUT_SEG";
      });
      dispatch(setSelectedPartIds(next));
    } else if (groupKind === "CUTS") {
      const next = partIds.filter((id) => id.split("::")[1] !== "CUT");
      dispatch(setSelectedPartIds(next));
    }
  };

  const handleClearAll = () => {
    dispatch(setSelectedPointIds([]));
    dispatch(setSelectedPartIds([]));
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {part.label}
          </Typography>
          <Button size="small" onClick={handleClearAll}>
            Tout effacer
          </Button>
        </Stack>

        {part.groups.map((group, gi) => (
          <Box key={group.kind}>
            {gi > 0 && <Divider sx={{ mb: 1.5 }} />}
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 1 }}
            >
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {group.captionFr}
                {group.count > 1 ? "s" : ""} ({group.count})
              </Typography>
              <Button
                size="small"
                onClick={() => handleClearGroup(group.kind)}
                sx={{ fontSize: "0.7rem", minWidth: 0 }}
              >
                Vider
              </Button>
            </Stack>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {group.items.map((item) => (
                <Chip
                  key={item.id}
                  size="small"
                  label={item.label}
                  onDelete={() =>
                    group.kind === "POINTS"
                      ? handleRemovePoint(item.id)
                      : handleRemovePart(item.id)
                  }
                />
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
