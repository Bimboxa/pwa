import { useMemo } from "react";

import { Box } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useRevolutionAxisPlacements from "Features/annotations/hooks/useRevolutionAxisPlacements";
import RowRevolutionAxisBanner from "./RowRevolutionAxisBanner";

// Banners of the axes posed on the current VERTICAL base map (eye + delete of
// the placement), paired with the plan axis they instantiate (the label comes
// from there). Rendered for ALL placements regardless of template, so legacy
// pre-template placements stay manageable from the panel too.
export default function RowsRevolutionAxisPlacementBanners() {
  // data

  const baseMap = useMainBaseMap();
  const isVertical = baseMap?.orientation === "VERTICAL";
  const revolutionAxes = useRevolutionAxes();
  const placements = useRevolutionAxisPlacements(baseMap?.id);

  // helpers

  const posedAxes = useMemo(
    () =>
      placements.map((placement) => ({
        placement,
        axis: revolutionAxes.find((a) => a.id === placement.revolutionAxisId),
      })),
    [placements, revolutionAxes]
  );

  // render

  if (!isVertical || posedAxes.length === 0) return null;

  return (
    <Box>
      {posedAxes.map(({ placement, axis }) => (
        <RowRevolutionAxisBanner
          key={placement.id}
          placement={placement}
          axis={axis}
        />
      ))}
    </Box>
  );
}
