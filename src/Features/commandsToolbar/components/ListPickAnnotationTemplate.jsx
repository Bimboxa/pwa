import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import SelectorAnnotationTemplateVariantDense from "Features/annotations/components/SelectorAnnotationTemplateVariantDense";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useListings from "Features/listings/hooks/useListings";
import sortAnnotationTemplatesByOrder from "Features/annotations/utils/sortAnnotationTemplatesByOrder";

// Templates in the display order of the annotations panel
// (PopperMapListings): listing after listing in the listings order, each
// listing's templates in their own order (orderIndex, groups consolidated).
function sortInPanelOrder(templates, listings) {
  if (!templates || !listings) return templates;
  return listings.flatMap((listing) =>
    sortAnnotationTemplatesByOrder(
      templates.filter((t) => t.listingId === listing.id)
    )
  );
}

// Template picker list of the commands that create annotations from a chosen
// template (Découper en segments, Contours, Fermer l'enveloppe, Transformer,
// Vectoriser, Angles rentrants, Calepiner…). Owns the templates + listings
// queries: render it only while its popup is open so the ~7 commands do not
// keep 14 live queries running in the toolbar.
// `filterTemplate(template, { listings })` keeps the eligible templates;
// `onChange(templateId, template)`; `getItemSuffix(template)` is the optional
// right-hand text of a row (SelectorAnnotationTemplateVariantDense).
// `panelOrder`: listings and templates in the display order of the
// annotations panel instead of the alphabetical order of the labels.
export default function ListPickAnnotationTemplate({
  filterTemplate,
  onChange,
  selectedAnnotationTemplateId = null,
  emptyText = "Aucun modèle éligible",
  getItemSuffix = null,
  panelOrder = false,
}) {
  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const allTemplates = useAnnotationTemplates({ sortByLabel: !panelOrder });
  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });

  // helpers

  const filteredTemplates = filterTemplate
    ? allTemplates?.filter((t) => filterTemplate(t, { listings }))
    : allTemplates;
  const templates = panelOrder
    ? sortInPanelOrder(filteredTemplates, listings)
    : filteredTemplates;

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
      getItemSuffix={getItemSuffix}
    />
  );
}
