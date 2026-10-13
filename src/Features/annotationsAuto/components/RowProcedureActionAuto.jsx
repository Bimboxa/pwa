import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingProcedureSourceIds from "../hooks/useListingProcedureSourceIds";

import hasProcedureParams from "../utils/hasProcedureParams";
import getProceduresForAnnotation from "../utils/getProceduresForAnnotation";

import { Box } from "@mui/material";
import { lighten } from "@mui/material/styles";

import RowProcedureLauncher from "./RowProcedureLauncher";
import SectionProcedureParams from "./SectionProcedureParams";

/**
 * Toolbar rows (between quantities and actions) for an annotation that can
 * source one or several ANNOTATIONS_CREATOR procedures — linked by its
 * template, by its listing (source mapping categories) or by its type
 * (getProceduresForAnnotation). One band per
 * procedure: an optional parameters row (lighter tint of the launch band, so it
 * reads as attached to it) on top of the launch band itself — left = procedure
 * name, right = play / reset / refresh applied to this single annotation as
 * source.
 *
 * `onlyProcedureKeys` (optional) restricts the bands to a subset of the
 * linked procedures — the revolution-axis toolbar shows the systems
 * ASSOCIATED to the axis only (SectionRevolutionAxisSystems).
 */
export default function RowProcedureActionAuto({
  annotation,
  onlyProcedureKeys = null,
}) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  // listing-level links (listing.procedureKeys + sourceMappingCategories)
  const listingId = annotation?.listingId;
  const listing = useLiveQuery(
    () => (listingId ? db.listings.get(listingId) : null),
    [listingId]
  );

  const linkedProcedures = getProceduresForAnnotation(annotation, procedures, {
    listing,
  }).filter((p) => !onlyProcedureKeys || onlyProcedureKeys.includes(p.key));

  // render

  if (linkedProcedures.length === 0) return null;

  return (
    <>
      {linkedProcedures.map((procedure) => (
        <RowProcedureActionAutoBand
          key={procedure.key}
          annotation={annotation}
          procedure={procedure}
        />
      ))}
    </>
  );
}

// One procedure band. Sources of the launch:
//  - by default this single annotation — or, for an output of this
//    procedure, its source: play / reset / refresh on a generated row (e.g.
//    the CHATEAU_EAU_V1 "Ligne" riding the Axe template) must operate on the
//    annotation it was created from, not relaunch the procedure with itself
//    as source;
//  - for a procedure flagged `sourcesFromListing` (registry), EVERY source
//    of its listing on this base map (useListingProcedureSourceIds — the
//    same set as the listing « Dessin auto » band): the run needs the whole
//    set (e.g. the six château d'eau walls) and reset / refresh must sweep
//    the outputs tagged with any of them.
function RowProcedureActionAutoBand({ annotation, procedure }) {
  // data

  const fromListing = procedure.sourcesFromListing === true;
  const getListingSourceIds = useListingProcedureSourceIds({
    listingId: annotation?.listingId,
    baseMapId: annotation?.baseMapId,
    enabled: fromListing,
  });

  // helpers

  const ownSourceId =
    annotation?.autoCreatedByProcedureKey === procedure.key &&
    annotation?.autoCreatedFrom
      ? annotation.autoCreatedFrom
      : annotation?.id;
  const listingSourceIds = fromListing ? getListingSourceIds(procedure) : [];
  const sourceAnnotationIds =
    fromListing && listingSourceIds.length > 0
      ? listingSourceIds
      : [ownSourceId];

  // render

  return (
    <Box>
      {hasProcedureParams(procedure) && (
        <SectionProcedureParams
          procedure={procedure}
          row
          hideHelperText
          sx={{
            px: 1.25,
            py: 0.25,
            bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.93),
          }}
        />
      )}

      <RowProcedureLauncher
        procedure={procedure}
        baseMapId={annotation?.baseMapId}
        sourceAnnotationIds={sourceAnnotationIds}
        sx={{ borderBottom: "1px solid", borderColor: "divider" }}
      />
    </Box>
  );
}
