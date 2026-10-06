import { useMemo, useState } from "react";

import { Box, List, Typography } from "@mui/material";

import RowRevolutionAxis from "./RowRevolutionAxis";
import DialogCreateBlankBaseMap from "Features/baseMaps/components/DialogCreateBlankBaseMap";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import useRevolutionAxesOfBaseMap from "../hooks/useRevolutionAxesOfBaseMap";
import useStartRevolutionAxisTools from "../hooks/useStartRevolutionAxisTools";
import pickVerticalBaseMapListing from "../utils/pickVerticalBaseMapListing";

// "Axes de révolution" section of PopperMapListings — rendered right below
// the layers zone as soon as the base map carries a revolution axis: the axes
// drawn on it (plan) or placed on it (vertical base map). One row per axis
// (RowRevolutionAxis): navigation to the perpendicular base map the profiles
// are drawn on, eye / solo of everything linked to the axis, 3D half-view.
export default function SectionRevolutionAxes({ baseMap, spriteImage }) {
  // strings

  const titleS = "Axes de révolution";

  // data

  const items = useRevolutionAxesOfBaseMap(baseMap?.id);
  const hasItems = items.length > 0;
  const { value: baseMaps } = useBaseMaps({ includeDetails: true });
  const { groups: verticalBaseMapGroups } = useVerticalBaseMapsByListing();
  const baseMapListings = useProjectBaseMapListings({ excludeDisabled: true });
  const appConfig = useAppConfig();
  const { startPlaceAxis } = useStartRevolutionAxisTools();

  // state

  // Axis waiting for the vertical base map being created (blank page dialog).
  const [axisToLink, setAxisToLink] = useState(null);

  // helpers

  const baseMapById = useMemo(() => {
    const acc = {};
    for (const bm of baseMaps ?? []) acc[bm.id] = bm;
    return acc;
  }, [baseMaps]);

  // Procedures an axis can source without a template (registry
  // sourceAnnotationTypes) and that open a params dialog.
  const procedures = useMemo(
    () =>
      (appConfig?.automatedAnnotationsProcedures ?? []).filter(
        (p) =>
          p?.type === "ANNOTATIONS_CREATOR" &&
          p.paramsDialog &&
          (p.sourceAnnotationTypes ?? []).includes("REVOLUTION_AXIS")
      ),
    [appConfig?.automatedAnnotationsProcedures]
  );

  // Listing of a created vertical base map (shared rule with the overlay's
  // automatic A3 page): the first listing that already holds vertical base
  // maps, else the plan's own listing.
  const createListing = useMemo(
    () =>
      pickVerticalBaseMapListing({
        listings: baseMapListings,
        verticalBaseMapGroups,
        planListingId: baseMap?.listingId,
      }),
    [baseMapListings, verticalBaseMapGroups, baseMap?.listingId]
  );

  // handlers

  // The dialog selects the created base map (selectOnCreate): arming the
  // placement click right after links the axis to it.
  const handleBaseMapCreated = (entity) => {
    const axis = axisToLink;
    setAxisToLink(null);
    if (entity?.id && axis) startPlaceAxis(axis);
  };

  // render

  if (!hasItems) return null;

  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "panel.border" }}>
      {/* Same typography as the "Coupes / élévations liées" section header. */}
      <Box sx={{ px: 1, py: 0.75, bgcolor: "secondary.main" }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, color: "secondary.contrastText" }}
        >
          {titleS}
        </Typography>
      </Box>
      <List dense disablePadding>
        {items.map(({ axis, placements, linkedCount }) => (
          <RowRevolutionAxis
            key={axis.id}
            axis={axis}
            placements={placements}
            linkedCount={linkedCount}
            baseMap={baseMap}
            baseMapById={baseMapById}
            verticalBaseMapGroups={verticalBaseMapGroups}
            procedures={procedures}
            spriteImage={spriteImage}
            onCreateBaseMap={setAxisToLink}
          />
        ))}
      </List>

      <DialogCreateBlankBaseMap
        open={Boolean(axisToLink)}
        onClose={() => setAxisToLink(null)}
        listing={createListing}
        defaultOrientation="VERTICAL"
        onCreated={handleBaseMapCreated}
      />
    </Box>
  );
}
