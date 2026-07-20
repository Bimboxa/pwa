import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import { setSelectedItems } from "Features/selection/selectionSlice";

import { Box, Typography } from "@mui/material";

import db from "App/db/db";

import useAnnotationOpenings from "Features/annotations/hooks/useAnnotationOpenings";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationOpeningQties from "Features/annotations/utils/getAnnotationOpeningQties";

/**
 * Openings ↔ host links of the selected annotation, in the properties panel.
 *
 * - Host wall: lists the openings glued on it (template name + W × H) with
 *   the total surface deducted from the host quantities.
 * - Opening: shows the host wall it is glued on.
 *
 * Clicking a row selects the related annotation on the map.
 */
export default function SectionAnnotationOpenings({ annotation }) {
  // data

  const dispatch = useDispatch();
  const { rowsByHostId, rowByOpeningId } = useAnnotationOpenings();

  const hostRels = rowsByHostId.get(annotation?.id) ?? [];
  const openingRel = rowByOpeningId.get(annotation?.id);

  const relatedIds = useMemo(() => {
    const ids = hostRels.map((r) => r.openingAnnotationId);
    if (openingRel) ids.push(openingRel.hostAnnotationId);
    return ids;
  }, [hostRels, openingRel]);

  const relatedAnnotations = useLiveQuery(async () => {
    if (relatedIds.length === 0) return [];
    const found = await db.annotations.bulkGet(relatedIds);
    return found.filter((a) => a && !a.deletedAt);
  }, [relatedIds.join(",")]);

  const annotationTemplates = useAnnotationTemplates();
  const templatesMap = useMemo(
    () => getItemsByKey(annotationTemplates, "id"),
    [annotationTemplates]
  );
  const relatedById = useMemo(
    () => getItemsByKey(relatedAnnotations ?? [], "id"),
    [relatedAnnotations]
  );

  // helpers

  function getLabel(relatedId) {
    const related = relatedById[relatedId];
    if (!related) return "—";
    const templateName = templatesMap[related.annotationTemplateId]?.name;
    return templateName || related.label || related.type || "Annotation";
  }

  function getDims(relatedId) {
    const related = relatedById[relatedId];
    const w = Number(related?.width);
    const h = Number(related?.height);
    if (!(w > 0) || !(h > 0)) return null;
    return `${w.toFixed(2)} × ${h.toFixed(2)} m`;
  }

  const openings = hostRels.map((r) => relatedById[r.openingAnnotationId]).filter(Boolean);
  const openQ = getAnnotationOpeningQties({ host: annotation, openings });

  // handlers

  function handleSelect(relatedId) {
    const related = relatedById[relatedId];
    if (!related) return;
    dispatch(
      setSelectedItems([
        {
          id: related.id,
          nodeId: related.id,
          type: "NODE",
          nodeType: "ANNOTATION",
          annotationType: related.type,
          entityId: related.entityId,
          listingId: related.listingId,
          annotationTemplateId: related.annotationTemplateId,
          pointId: null,
          partId: null,
          partType: null,
        },
      ])
    );
  }

  // render

  if (hostRels.length === 0 && !openingRel) return null;

  const renderRow = (key, relatedId) => (
    <Box
      key={key}
      onClick={() => handleSelect(relatedId)}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        px: 1,
        py: 0.5,
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      <Typography variant="caption" noWrap>
        {getLabel(relatedId)}
      </Typography>
      {getDims(relatedId) && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          {getDims(relatedId)}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box
      sx={{ width: 1, p: 1, display: "flex", flexDirection: "column", gap: 0.5 }}
    >
      {hostRels.length > 0 && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600 }}
            >
              Ouvertures ({hostRels.length})
            </Typography>
            {openQ?.deductedM2 > 0 && (
              <Typography variant="caption" color="text.secondary">
                − {openQ.deductedM2.toFixed(2)} m²
              </Typography>
            )}
          </Box>
          {hostRels.map((rel) => renderRow(rel.id, rel.openingAnnotationId))}
        </>
      )}

      {openingRel && (
        <>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 600 }}
          >
            Hôte
          </Typography>
          {renderRow(openingRel.id, openingRel.hostAnnotationId)}
        </>
      )}
    </Box>
  );
}
