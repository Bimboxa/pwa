import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import db from "App/db/db";

import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import removeAnnotationSubtraction from "Features/annotations/services/removeAnnotationSubtraction";

/**
 * Reusable list of the annotations subtracted from a given source annotation.
 * Each row shows the target's label/type and an "x" to remove the relation.
 * Used both in the properties panel (SectionAnnotationSubtractions) and in the
 * subtraction pick-mode helper (PopperSubtractHelper).
 */
export default function ListAnnotationSubtractions({ annotationId, emptyLabel }) {
  // data

  const { relsBySource } = useAnnotationSubtractions();
  const rels = relsBySource.get(annotationId) ?? [];

  const targetIds = rels.map((r) => r.targetAnnotationId);

  const targets = useLiveQuery(async () => {
    if (targetIds.length === 0) return [];
    const found = await db.annotations.bulkGet(targetIds);
    return found.filter((a) => a && !a.deletedAt);
  }, [targetIds.join(",")]);

  const annotationTemplates = useAnnotationTemplates();
  const templatesMap = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );
  const targetsById = useMemo(
    () => getItemsByKey(targets ?? [], "id"),
    [targets]
  );

  // helpers

  function getTargetLabel(targetId) {
    const target = targetsById[targetId];
    if (!target) return "—";
    const templateName = templatesMap[target.annotationTemplateId]?.name;
    return templateName || target.type || "Annotation";
  }

  // handlers

  async function handleRemove(relId) {
    await removeAnnotationSubtraction(relId);
  }

  // render

  if (rels.length === 0) {
    return emptyLabel ? (
      <Typography variant="caption" color="text.secondary">
        {emptyLabel}
      </Typography>
    ) : null;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {rels.map((rel) => (
        <Box
          key={rel.id}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            pl: 1,
          }}
        >
          <Typography variant="caption" noWrap>
            {getTargetLabel(rel.targetAnnotationId)}
          </Typography>
          <Tooltip title="Retirer la soustraction">
            <IconButton size="small" onClick={() => handleRemove(rel.id)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
    </Box>
  );
}
