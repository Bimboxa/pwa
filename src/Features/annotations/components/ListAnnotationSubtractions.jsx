import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";

import { Box, Typography, IconButton, Tooltip } from "@mui/material";
import { Close as CloseIcon } from "@mui/icons-material";

import db from "App/db/db";

import useAnnotationSubtractions from "Features/annotations/hooks/useAnnotationSubtractions";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import { getAnnotationOwnLabel } from "Features/annotations/utils/getAnnotationLabelDisplay";
import getItemsByKey from "Features/misc/utils/getItemsByKey";

import removeAnnotationSubtraction from "Features/annotations/services/removeAnnotationSubtraction";

/**
 * Reusable list of the annotations at the other end of a subtraction relation,
 * in either direction. Each row shows the symbol of the other annotation's
 * template (pattern + color), the annotation's own label (template label, then
 * type, as fallbacks) and an "x" to remove the relation.
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
  const spriteImage = useAnnotationSpriteImage();

  // helpers

  // Row model of the OTHER annotation: its own label first (the template
  // label, then the type, only as fallbacks) and the style source of its
  // symbol (the template, or the row itself for a templateless annotation).
  function getRowProps(annotationId) {
    const other = othersById[annotationId];
    if (!other) return { label: "—", iconSource: null };
    const template = templatesMap[other.annotationTemplateId];
    return {
      label:
        getAnnotationOwnLabel(other) ||
        template?.label ||
        other.type ||
        "Annotation",
      iconSource: template ?? other,
    };
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
      {rels.map((rel, index) => {
        const { label, iconSource } = getRowProps(otherIds[index]);
        return (
          <Box
            key={rel.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              pl: 1,
            }}
          >
            {iconSource && (
              <Box
                sx={{ display: "flex", alignItems: "center", flexShrink: 0 }}
              >
                <AnnotationTemplateIcon
                  template={iconSource}
                  size={16}
                  spriteImage={spriteImage}
                />
              </Box>
            )}
            <Typography variant="caption" noWrap sx={{ flex: 1, minWidth: 0 }}>
              {label}
            </Typography>
            <Tooltip title="Retirer la soustraction">
              <IconButton size="small" onClick={() => handleRemove(rel.id)}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
}
