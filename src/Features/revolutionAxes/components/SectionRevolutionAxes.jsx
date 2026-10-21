import { useMemo, useState } from "react";

import { Box, List, Typography, useTheme } from "@mui/material";

import RowRevolutionAxis from "./RowRevolutionAxis";
import DialogProcedureAxisLaunch from "./DialogProcedureAxisLaunch";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useVerticalBaseMapsByListing from "Features/baseMapLinks/hooks/useVerticalBaseMapsByListing";
import useCreateRevolutionAxisBaseMap from "../hooks/useCreateRevolutionAxisBaseMap";
import useRevolutionAxesOfBaseMap from "../hooks/useRevolutionAxesOfBaseMap";
import getRevolutionAxisProcedures, {
  getAxisSystemListingId,
} from "../utils/getRevolutionAxisProcedures";

// "Axes de révolution" section of PopperMapListings and of the docked Dessin
// panel — pinned at the top of the annotations side, right under the
// header and above the listings block, as soon as the base map carries a
// revolution axis: the axes drawn on it (plan) or placed on it (vertical
// base map). One row per axis
// (RowRevolutionAxis): navigation to the perpendicular base map the profiles
// are drawn on, eye / solo of everything linked to the axis, 3D half-view.
// "Créer un fond de plan…" of a row creates the automatic A3 coupe page of the
// axis (same hook as the "Fond de plan" button of the axis overlay): page
// sized to the axis, axis posed at its base point, page selected.
// `hideHeader`: rows only, with `card` the rows sit in a white rounded
// outlined card, inset in the grey panel with a small inner padding (the
// two hosts above); without, the rows are separated by a top border.
export default function SectionRevolutionAxes({
  baseMap,
  spriteImage,
  hideHeader = false,
  card = false,
}) {
  // strings

  const titleS = "Axes de révolution";

  // data

  const items = useRevolutionAxesOfBaseMap(baseMap?.id);
  const hasItems = items.length > 0;
  const { value: baseMaps } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });
  const { groups: verticalBaseMapGroups } = useVerticalBaseMapsByListing();
  const appConfig = useAppConfig();
  const { createForAxis, creating } = useCreateRevolutionAxisBaseMap();
  const theme = useTheme();

  // state

  // { axis, procedure } whose launch dialog is open (row menu relaunch).
  const [launch, setLaunch] = useState(null);

  // helpers

  const baseMapById = useMemo(() => {
    const acc = {};
    for (const bm of baseMaps ?? []) acc[bm.id] = bm;
    return acc;
  }, [baseMaps]);

  // Systems an axis can source without a template (registry
  // sourceAnnotationTypes + params dialog); each row lists the ones launched
  // on its axis from a listing (association mark).
  const procedures = useMemo(
    () =>
      getRevolutionAxisProcedures(appConfig?.automatedAnnotationsProcedures),
    [appConfig?.automatedAnnotationsProcedures]
  );

  // render

  if (!hasItems) return null;

  return (
    <Box
      sx={{
        ...(card
          ? {
              mx: 1,
              my: 1,
              py: 0.5,
              overflow: "hidden",
              bgcolor: "background.paper",
              border: "1px solid",
              borderRadius: 2,
            }
          : hideHeader
            ? { borderTop: "1px solid" }
            : { borderBottom: "1px solid" }),
        borderColor: "panel.border",
      }}
    >
      {/* Same muted header as the "Calques" section: grey band, uppercase
          caption, inverted-T glyph (the axis placement mark). */}
      {!hideHeader && (
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
      )}
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
            creatingBaseMap={creating}
            onCreateBaseMap={createForAxis}
            onLaunchProcedure={(axis, procedure) =>
              setLaunch({ axis, procedure })
            }
          />
        ))}
      </List>

      {launch && (
        <DialogProcedureAxisLaunch
          open
          procedure={launch.procedure}
          listingId={getAxisSystemListingId(launch.axis, launch.procedure.key)}
          initialAxisId={launch.axis.id}
          onClose={() => setLaunch(null)}
        />
      )}
    </Box>
  );
}
