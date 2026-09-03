import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";

import hasProcedureParams from "../utils/hasProcedureParams";

import { Paper, Box, Typography, Divider } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import RowProcedureLauncher from "./RowProcedureLauncher";
import SectionProcedureParams from "./SectionProcedureParams";

/**
 * Content of the "Auto" popper shown on a listing template linked to one or
 * several ANNOTATIONS_CREATOR procedures. One section per procedure: lists the
 * annotation templates it creates (resolved from createdMappingCategories),
 * exposes the procedure parameters (same section as the "Dessin auto" panel)
 * and play / reset / refresh applied to all annotations of the source template.
 */
export default function ProcedurePopperContent({
  procedures,
  sourceTemplate,
  baseMapId,
}) {
  // data

  const allTemplates = useAnnotationTemplatesByProject();

  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // all annotations of the source template on this base map (procedure source),
  // shared by every section. A REVOLUTION_AXIS_PLACEMENT stands for its plan
  // axis: launching from the vertical map must source the AXIS row (params,
  // autoCreatedFrom tag and the dialog all live on it).
  const sourceAnnotations = useLiveQuery(async () => {
    if (!sourceTemplate?.id || !baseMapId) return [];
    const arr = await db.annotations
      .where("annotationTemplateId")
      .equals(sourceTemplate.id)
      .toArray();
    return arr.filter((a) => !a.deletedAt && a.baseMapId === baseMapId);
  }, [sourceTemplate?.id, baseMapId, annotationsUpdatedAt]);

  // helpers

  // A procedure's own outputs are results, not sources — e.g. the
  // CHATEAU_EAU_V1 "Ligne" datum rides the Axe template and must not relaunch
  // the procedure as its own source (it would also break the single-source
  // params dialog by inflating the id set).
  function getSourceAnnotationIds(procedure) {
    return [
      ...new Set(
        (sourceAnnotations ?? [])
          .filter((a) => a.autoCreatedByProcedureKey !== procedure.key)
          .map((a) =>
            a.type === "REVOLUTION_AXIS_PLACEMENT" ? a.revolutionAxisId : a.id
          )
          .filter(Boolean)
      ),
    ];
  }

  function getCreatedTemplates(procedure) {
    const createdTags = procedure?.createdMappingCategories ?? [];
    const seen = new Set();
    const createdTemplates = [];
    // Procedures create annotations with the templates of the source
    // template's own listing — never resolve a tag from another listing.
    const listingTemplates = (allTemplates ?? []).filter(
      (t) => t.listingId === sourceTemplate?.listingId
    );
    for (const tag of createdTags) {
      const template = listingTemplates.find((t) =>
        t.mappingCategories?.includes(tag)
      );
      if (template && !seen.has(template.id)) {
        seen.add(template.id);
        createdTemplates.push(template);
      }
    }
    return createdTemplates;
  }

  // render

  return (
    <Paper sx={{ p: 1, maxWidth: 300, boxShadow: 3 }}>
      {procedures.map((procedure, index) => {
        const createdTemplates = getCreatedTemplates(procedure);
        return (
          <Box key={procedure.key}>
            {index > 0 && <Divider sx={{ my: 1, mx: -1 }} />}

            <Typography variant="caption" color="text.secondary">
              Création automatique des annotations suivantes :
            </Typography>

            <Box
              sx={{
                mt: 0.5,
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
              }}
            >
              {createdTemplates.map((template) => (
                <Box
                  key={template.id}
                  sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
                >
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AnnotationTemplateIcon template={template} size={16} />
                  </Box>
                  <Typography variant="body2" noWrap>
                    {template.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            {hasProcedureParams(procedure) && (
              <>
                <Divider sx={{ mt: 1, mx: -1 }} />
                <SectionProcedureParams
                  procedure={procedure}
                  dense
                  sx={{ mt: 1 }}
                />
              </>
            )}

            <RowProcedureLauncher
              procedure={procedure}
              baseMapId={baseMapId}
              sourceAnnotationIds={getSourceAnnotationIds(procedure)}
              sx={{
                mt: 1,
                mx: -1,
                ...(index === procedures.length - 1 ? { mb: -1 } : {}),
                px: 1,
                py: 0.75,
                ...(index === procedures.length - 1
                  ? {
                      borderBottomLeftRadius: (theme) =>
                        theme.shape.borderRadius,
                      borderBottomRightRadius: (theme) =>
                        theme.shape.borderRadius,
                    }
                  : {}),
              }}
            />
          </Box>
        );
      })}
    </Paper>
  );
}
