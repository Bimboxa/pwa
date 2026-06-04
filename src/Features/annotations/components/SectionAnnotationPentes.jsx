import { useDispatch } from "react-redux";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowForwardIos as ForwardIcon } from "@mui/icons-material";

import { setSubSelection } from "Features/selection/selectionSlice";

// Lists the slopes (guideLines carrying a slopePct) of an annotation. Each row
// shows the slope value and a forward arrow; clicking it sub-selects that
// guideLine (selectionSlice) so the guideLine properties panel opens.
export default function SectionAnnotationPentes({ annotation }) {
  // data

  const dispatch = useDispatch();

  // helpers

  // Keep the original index — the guideLine selection partId encodes it:
  // `${annotationId}::GUIDE_LINE::${index}`.
  const slopes = (annotation?.guideLines || [])
    .map((guideLine, index) => ({ guideLine, index }))
    .filter(
      ({ guideLine }) =>
        (guideLine?.points?.length ?? 0) >= 2 &&
        Number.isFinite(guideLine?.slopePct)
    );

  // handlers

  function handleSelect(index) {
    if (!annotation?.id) return;
    dispatch(
      setSubSelection({
        partId: `${annotation.id}::GUIDE_LINE::${index}`,
        partType: "GUIDE_LINE",
      })
    );
  }

  // render

  if (slopes.length === 0) return null;

  return (
    <Box
      sx={{ width: 1, p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        Pentes
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {slopes.map(({ guideLine, index }, i) => (
          <Box
            key={index}
            onClick={() => handleSelect(index)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "white",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              pl: 1,
              cursor: "pointer",
              "&:hover": { borderColor: "text.secondary" },
            }}
          >
            <Typography variant="caption" noWrap>
              {`Pente ${i + 1} : ${guideLine.slopePct} %`}
            </Typography>
            <IconButton size="small" onClick={() => handleSelect(index)}>
              <ForwardIcon sx={{ fontSize: 14 }} color="action" />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
