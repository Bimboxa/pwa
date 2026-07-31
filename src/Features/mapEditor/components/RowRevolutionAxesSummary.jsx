import { useMemo, useState } from "react";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { RotateRight, Visibility, VisibilityOff } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useRevolutionAxisPlacements from "Features/annotations/hooks/useRevolutionAxisPlacements";
import useUpdateAnnotations from "Features/annotations/hooks/useUpdateAnnotations";

// Summary row for the revolution axes VISIBLE ON THE CURRENT BASE MAP, shown
// above the listings. Axes are project-level geometry with no listing of their
// own, so they would otherwise have nowhere to be listed or toggled.
//
// "Drawn on this base map" covers both faces of the model: the axis itself on a
// plan, and its placement on an elevation — either way it is one axis drawing on
// the map in front of the user.
//
// Renders nothing when the base map carries none.
export default function RowRevolutionAxesSummary() {
  // data

  const baseMap = useMainBaseMap();
  const revolutionAxes = useRevolutionAxes();
  const placements = useRevolutionAxisPlacements(baseMap?.id);
  const updateAnnotations = useUpdateAnnotations();

  // state

  const [isHovered, setIsHovered] = useState(false);

  // helpers

  const items = useMemo(() => {
    if (!baseMap?.id) return [];
    const axesHere = revolutionAxes.filter((a) => a.baseMapId === baseMap.id);
    return [...axesHere, ...placements];
  }, [revolutionAxes, placements, baseMap?.id]);

  // The eye reflects the group: lit while at least one is shown.
  const allHidden = items.length > 0 && items.every((a) => a.hidden);

  // handlers

  async function handleToggleVisibility(e) {
    e.stopPropagation();
    await updateAnnotations(
      items.map((a) => ({ id: a.id, hidden: !allHidden }))
    );
  }

  // render

  if (items.length === 0) return null;

  return (
    <Box
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1,
        py: 0.75,
        bgcolor: "panel.sectionBg",
        borderTop: "1px solid",
        borderColor: "panel.border",
        opacity: allHidden ? 0.5 : 1,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        <RotateRight sx={{ fontSize: 18, color: "panel.textLight" }} />
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 600, color: "panel.textPrimary" }}
        >
          Axes de révolution
        </Typography>
      </Box>

      {/* Count by default, eye on hover — same swap as the listing rows. */}
      <Box
        sx={{ position: "relative", minWidth: 24, height: 24, flexShrink: 0 }}
      >
        <Typography
          variant="caption"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            fontSize: "11px",
            fontWeight: 600,
            fontFamily: "monospace",
            color: "secondary.main",
            visibility: isHovered ? "hidden" : "visible",
          }}
        >
          {items.length}
        </Typography>
        <Tooltip
          title={allHidden ? "Afficher les axes" : "Masquer les axes"}
          arrow
        >
          <IconButton
            size="small"
            onClick={handleToggleVisibility}
            sx={{
              position: "absolute",
              inset: 0,
              p: 0,
              visibility: isHovered ? "visible" : "hidden",
            }}
          >
            {allHidden ? (
              <VisibilityOff sx={{ fontSize: 18 }} />
            ) : (
              <Visibility sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
