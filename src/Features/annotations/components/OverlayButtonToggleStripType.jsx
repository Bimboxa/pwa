import { IconButton, Tooltip } from "@mui/material";
import { Cached as CachedIcon } from "@mui/icons-material";

import useToggleAnnotationStripType from "../hooks/useToggleAnnotationStripType";

// "Basculer ligne ↔ bande (mur)" button of the quick-action row rendered above
// the selected open POLYLINE / STRIP (NodeSegmentLengthsStatic overlay, before
// "Plus d'outils"). Same action as the IconButtonToggleStripType entry of the
// "Plus d'outils" menu: cycles POLYLINE -> STRIP (side A) -> STRIP (side B) ->
// POLYLINE while keeping the band visually fixed (useToggleAnnotationStripType).
// `annotation` is the resolved (pixel-space) annotation of the host node, which
// is what the hook expects.
export default function OverlayButtonToggleStripType({
  annotation,
  overlayColor = "#2196f3",
}) {
  const toggleStripType = useToggleAnnotationStripType();

  // handlers

  async function handleClick() {
    if (!annotation?.id) return;
    await toggleStripType(annotation);
  }

  // render

  return (
    <Tooltip placement="top" arrow title="Basculer ligne ↔ bande (mur)">
      <IconButton
        size="small"
        onClick={handleClick}
        sx={{
          bgcolor: "rgba(255,255,255,0.9)",
          border: `1px solid ${overlayColor}`,
          color: "text.disabled",
          "&:hover": { bgcolor: "white", color: overlayColor },
          p: 0.5,
        }}
      >
        <CachedIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
}
