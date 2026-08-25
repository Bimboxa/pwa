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
 * Reusable list of the annotations at the other end of a subtraction relation,
 * in either direction. Each row shows the other annotation's label/type and an
 * "x" to remove the relation.
 *
 * direction "TARGETS" (default): what is subtracted FROM `annotationId`.
 * direction "SOURCES": which annotations `annotationId` is carved OUT OF.
 *
 * Used in the properties panel (SectionAnnotationSubtractions) and in both
 * subtraction pick-mode helpers (PopperSubtractHelper).
 */
export default function ListAnnotationSubtractions({
  annotationId,
  emptyLabel,
  direction = "TARGETS",
}) {
  // data

  const { relsBySource, relsByTarget } = useAnnotationSubtractions();
  const rels =
    (direction === "SOURCES"
      ? relsByTarget.get(annotationId)
      : relsBySource.get(annotationId)) ?? [];

  // id of the OTHER annotation of each relation, whichever direction we read
  const otherIds = rels.map((r) =>
    direction === "SOURCES" ? r.sourceAnnotationId : r.targetAnnotationId
  );

  const others = useLiveQuery(async () => {
    if (otherIds.length === 0) return [];
    const found = await db.annotations.bulkGet(otherIds);
    return found.filter((a) => a && !a.deletedAt);
  }, [otherIds.join(",")]);

  const annotationTemplates = useAnnotationTemplates();
  const templatesMap = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );
  const othersById = useMemo(() => getItemsByKey(others ?? [], "id"), [others]);

  // helpers

  function getAnnotationLabel(annotationId) {
    const other = othersById[annotationId];
    if (!other) return "—";
    const templateName = templatesMap[other.annotationTemplateId]?.name;
    return templateName || other.type || "Annotation";
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
      {rels.map((rel, index) => (
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
            {getAnnotationLabel(otherIds[index])}
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
