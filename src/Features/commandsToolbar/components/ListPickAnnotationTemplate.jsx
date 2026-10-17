import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "Features/annotations/components/SelectorAnnotationTemplateVariantDense";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";

// Template picker list of the commands that create annotations from a chosen
// template (Découper en segments, Contours, Fermer l'enveloppe, Transformer,
// Vectoriser, Angles rentrants, Calepiner…). Owns the templates + listings
// queries: render it only while its popup is open so the ~7 commands do not
// keep 14 live queries running in the toolbar.
// `filterTemplate(template, { listings })` keeps the eligible templates;
// `onChange(templateId, template)`.
export default function ListPickAnnotationTemplate({
  filterTemplate,
  onChange,
  selectedAnnotationTemplateId = null,
  emptyText = "Aucun modèle éligible",
}) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: true });
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  // helpers

  const templates = filterTemplate
    ? allTemplates?.filter((t) => filterTemplate(t, { listings }))
    : allTemplates;

  // handlers

  function handleChange(templateId) {
    onChange?.(
      templateId,
      allTemplates?.find((t) => t.id === templateId)
    );
  }

  // render

  if (allTemplates && !templates?.length) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {emptyText}
        </Typography>
      </Box>
    );
  }

  return (
    <SelectorAnnotationTemplateVariantDense
      selectedAnnotationTemplateId={selectedAnnotationTemplateId}
      onChange={handleChange}
      annotationTemplates={templates}
      listings={listings}
    />
  );
}
