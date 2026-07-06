import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useAnnotationTemplatesByProject from "Features/annotations/hooks/useAnnotationTemplatesByProject";

import { Paper, Box, Typography, Divider } from "@mui/material";
import { lighten } from "@mui/material/styles";

import { AutoFixHigh } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import ProcedureActionButtons from "./ProcedureActionButtons";

/**
 * Content of the "Auto" popper shown on a listing template linked to one or
 * several ANNOTATIONS_CREATOR procedures. One section per procedure: lists the
 * annotation templates it creates (resolved from createdMappingCategories) and
 * exposes play / reset / refresh applied to all annotations of the source
 * template.
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
  // shared by every section
  const sourceAnnotationIds = useLiveQuery(async () => {
    if (!sourceTemplate?.id || !baseMapId) return [];
    const arr = await db.annotations
      .where("annotationTemplateId")
      .equals(sourceTemplate.id)
      .toArray();
    return arr
      .filter((a) => !a.deletedAt && a.baseMapId === baseMapId)
      .map((a) => a.id);
  }, [sourceTemplate?.id, baseMapId, annotationsUpdatedAt]);

  // helpers

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

            <Box
              sx={{
                mt: 1,
                mx: -1,
                ...(index === procedures.length - 1 ? { mb: -1 } : {}),
                px: 1,
                py: 0.75,
                gap: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                bgcolor: (theme) => lighten(theme.palette.secondary.main, 0.85),
                ...(index === procedures.length - 1
                  ? {
                      borderBottomLeftRadius: (theme) =>
                        theme.shape.borderRadius,
                      borderBottomRightRadius: (theme) =>
                        theme.shape.borderRadius,
                    }
                  : {}),
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  minWidth: 0,
                }}
              >
                <AutoFixHigh sx={{ fontSize: 16, color: "text.secondary" }} />
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {procedure.label}
                </Typography>
              </Box>

              <ProcedureActionButtons
                procedureKey={procedure.key}
                baseMapId={baseMapId}
                sourceAnnotationIds={sourceAnnotationIds ?? []}
              />
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}
