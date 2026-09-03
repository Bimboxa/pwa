import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import hasProcedureParams from "../utils/hasProcedureParams";

import { Box } from "@mui/material";
import { lighten } from "@mui/material/styles";

import RowProcedureLauncher from "./RowProcedureLauncher";
import SectionProcedureParams from "./SectionProcedureParams";

/**
 * Toolbar rows (between quantities and actions) for an annotation whose template
 * is linked to one or several ANNOTATIONS_CREATOR procedures. One band per
 * procedure: an optional parameters row (lighter tint of the launch band, so it
 * reads as attached to it) on top of the launch band itself — left = procedure
 * name, right = play / reset / refresh applied to this single annotation as
 * source.
 */
export default function RowProcedureActionAuto({ annotation }) {
  // data

  const appConfig = useAppConfig();
  const procedures = appConfig?.automatedAnnotationsProcedures ?? [];

  const linkedProcedures = (annotation?.annotationTemplate?.procedureKeys ?? [])
    .map((key) => procedures.find((p) => p.key === key))
    .filter((p) => p?.type === "ANNOTATIONS_CREATOR");

  // render

  if (linkedProcedures.length === 0) return null;

  return (
    <>
      {linkedProcedures.map((procedure) => {
        // An output of this procedure redirects to its source: play / reset /
        // refresh on a generated row (e.g. the CHATEAU_EAU_V1 "Ligne" riding
        // the Axe template) must operate on the annotation it was created
        // from, not relaunch the procedure with itself as source.
        const sourceId =
          annotation?.autoCreatedByProcedureKey === procedure.key &&
          annotation?.autoCreatedFrom
            ? annotation.autoCreatedFrom
            : annotation?.id;
        return (
          <Box key={procedure.key}>
            {hasProcedureParams(procedure) && (
              <SectionProcedureParams
                procedure={procedure}
                row
                hideHelperText
                sx={{
                  px: 1.25,
                  py: 0.25,
                  bgcolor: (theme) =>
                    lighten(theme.palette.secondary.main, 0.93),
                }}
              />
            )}

            <RowProcedureLauncher
              procedure={procedure}
              baseMapId={annotation?.baseMapId}
              sourceAnnotationIds={[sourceId]}
              sx={{ borderBottom: "1px solid", borderColor: "divider" }}
            />
          </Box>
        );
      })}
    </>
  );
}
