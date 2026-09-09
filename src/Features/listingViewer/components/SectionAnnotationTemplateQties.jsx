import { useMemo } from "react";

import { Box, Typography } from "@mui/material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";

// Quantities of a set of annotations rolled up per annotation template, the
// right-hand column of the SCOPE module recap for an annotation listing.
// `groupByListing` splits the rows per listing name (the aggregate view, when
// no listing is selected); the annotations must then carry `listingName`
// (useAnnotationsV2 withListingName).
//
// The rollup goes through computeAnnotationTemplateQties so the recap counts
// exactly like the rest of the app: mesh cells skipped, LINEAR_LAYOUT bar
// counts honored, developed lengths / surfaces preferred.
export default function SectionAnnotationTemplateQties({
  annotations,
  annotationTemplates,
  groupByListing = false,
}) {
  // strings

  const emptyS = "Aucun objet repéré";
  const noListingS = "Sans liste";

  // helpers

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  // [{key, listingName, templates: [{...template, mainQtyLabel}]}] — a single
  // unnamed group in flat mode, one group per listing name otherwise.
  const groups = useMemo(() => {
    if (!annotations?.length) return [];

    const toRows = (groupAnnotations) => {
      const qtiesById = computeAnnotationTemplateQties(
        groupAnnotations,
        annotationTemplateById
      );
      return Object.entries(qtiesById)
        .map(([templateId, stats]) => {
          const template = annotationTemplateById[templateId];
          if (!template) return null;
          return { ...template, mainQtyLabel: stats.mainQtyLabel };
        })
        .filter(Boolean)
        .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    };

    if (!groupByListing) {
      const templates = toRows(annotations);
      return templates.length ? [{ key: "ALL", templates }] : [];
    }

    const annotationsByListingName = {};
    annotations.forEach((annotation) => {
      const listingName = annotation.listingName || noListingS;
      if (!annotationsByListingName[listingName])
        annotationsByListingName[listingName] = [];
      annotationsByListingName[listingName].push(annotation);
    });

    return Object.entries(annotationsByListingName)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([listingName, groupAnnotations]) => ({
        key: listingName,
        listingName,
        templates: toRows(groupAnnotations),
      }))
      .filter((group) => group.templates.length > 0);
  }, [annotations, annotationTemplateById, groupByListing]);

  // render

  if (!groups.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyS}
      </Typography>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      {groups.map((group) => (
        <Box key={group.key}>
          {group.listingName && (
            <Typography variant="body2" sx={{ fontWeight: "bold", mb: 0.5 }}>
              {group.listingName}
            </Typography>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {group.templates.map((template) => (
              <Box
                key={template.id}
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <AnnotationTemplateIcon template={template} size={16} />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                  {template.label}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ fontFamily: "monospace", fontWeight: 500 }}
                >
                  {template.mainQtyLabel}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
