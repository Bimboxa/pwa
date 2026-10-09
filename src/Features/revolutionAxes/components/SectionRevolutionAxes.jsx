import { useMemo, useState } from "react";

import { Box, List, Typography, useTheme } from "@mui/material";

import RowRevolutionAxis from "./RowRevolutionAxis";
import DialogAssociateSystemToAxis from "./DialogAssociateSystemToAxis";
import DialogCreateBlankBaseMap from "Features/baseMaps/components/DialogCreateBlankBaseMap";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";
import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import useRevolutionAxesOfBaseMap from "../hooks/useRevolutionAxesOfBaseMap";
import useStartRevolutionAxisTools from "../hooks/useStartRevolutionAxisTools";
import pickVerticalBaseMapListing from "../utils/pickVerticalBaseMapListing";
import getRevolutionAxisProcedures, {
  splitRevolutionAxisProcedures,
} from "../utils/getRevolutionAxisProcedures";

// "Axes de révolution" section of PopperMapListings — pinned right below the
// layers zone, under the panel header, as soon as the base map carries a
// revolution axis: the axes drawn on it (plan) or placed on it (vertical base
// map). One row per axis
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
  const theme = useTheme();

  // state

  // Axis waiting for the vertical base map being created (blank page dialog).
  const [axisToLink, setAxisToLink] = useState(null);
  // Axis whose system picker is open ("Associer un système…" of the row menu).
  const [axisToAssociate, setAxisToAssociate] = useState(null);

  // helpers

  const baseMapById = useMemo(() => {
    const acc = {};
    for (const bm of baseMaps ?? []) acc[bm.id] = bm;
    return acc;
  }, [baseMaps]);

  // Systems an axis can source without a template (registry
  // sourceAnnotationTypes + params dialog); each row splits them into the
  // ones associated to its axis and the ones still available.
  const procedures = useMemo(
    () =>
      getRevolutionAxisProcedures(appConfig?.automatedAnnotationsProcedures),
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
      {/* Same muted header as the "Calques" section right above: grey band,
          uppercase caption, inverted-T glyph (the axis placement mark). */}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          bgcolor: "panel.sectionBg",
          borderBottom: "1px solid",
          borderColor: "panel.border",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 20 20"
          style={{ flexShrink: 0 }}
        >
          <g
            stroke={theme.palette.panel.textMuted}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="10" y1="3" x2="10" y2="16" />
            <line x1="4" y1="16" x2="16" y2="16" />
          </g>
        </svg>
        <Typography
          variant="caption"
          sx={{
            color: "panel.textMuted",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontSize: "11px",
          }}
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
            onAssociateSystem={setAxisToAssociate}
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

      {axisToAssociate && (
        <DialogAssociateSystemToAxis
          axis={axisToAssociate}
          procedures={
            splitRevolutionAxisProcedures(axisToAssociate, procedures).available
          }
          onClose={() => setAxisToAssociate(null)}
        />
      )}
    </Box>
  );
}
