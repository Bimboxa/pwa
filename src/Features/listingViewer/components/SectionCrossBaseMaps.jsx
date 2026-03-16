import { useState, useMemo } from "react";

import { Box, Typography, Button } from "@mui/material";
import { TableChart } from "@mui/icons-material";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import SectionArticlesQties from "Features/articles/components/SectionArticlesQties";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";

export default function SectionCrossBaseMaps({
  listing,
  showAllListings,
  annotations,
  annotationTemplates,
  qtyMode,
  onQtyModeChange,
}) {
  // state

  const [openDialog, setOpenDialog] = useState(false);

  // helpers

  const title = showAllListings ? "Tous les objets" : listing?.name;
  const annotationCount = annotations?.length ?? 0;
  const isArticlesMode = qtyMode === "ARTICLES";

  const annotationTemplateById = getItemsByKey(
    annotationTemplates ?? [],
    "id"
  );

  // helpers - grouped by listing (for showAllListings mode)

  const groupedByListing = useMemo(() => {
    if (!showAllListings || !annotations?.length) return [];
    const listingMap = {};
    for (const annotation of annotations) {
      const templateId = annotation.annotationTemplateId;
      if (!templateId) continue;
      const listingName = annotation.listingName || "Sans liste";
      if (!listingMap[listingName]) listingMap[listingName] = {};
      if (!listingMap[listingName][templateId]) {
        listingMap[listingName][templateId] = {
          count: 0,
          length: 0,
          surface: 0,
          unit: 0,
        };
      }
      const stats = listingMap[listingName][templateId];
      stats.count += 1;
      stats.unit = stats.count;
      if (annotation.qties?.enabled) {
        if (Number.isFinite(annotation.qties.length))
          stats.length += annotation.qties.length;
        if (Number.isFinite(annotation.qties.surface))
          stats.surface += annotation.qties.surface;
      }
    }
    return Object.entries(listingMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([listingName, qtiesById]) => ({
        listingName,
        templates: Object.entries(qtiesById)
          .map(([templateId, stats]) => {
            const template = annotationTemplateById[templateId];
            if (!template) return null;
            return {
              ...template,
              mainQtyLabel: getAnnotationTemplateMainQtyLabel(template, stats),
            };
          })
          .filter(Boolean)
          .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? "")),
      }));
  }, [showAllListings, annotations, annotationTemplateById]);

  // helpers - flat list (for single listing mode)

  const templateQties = useMemo(() => {
    if (showAllListings || !annotations?.length) return {};
    const qtiesById = {};
    for (const annotation of annotations) {
      const templateId = annotation.annotationTemplateId;
      if (!templateId) continue;
      if (!qtiesById[templateId]) {
        qtiesById[templateId] = { count: 0, length: 0, surface: 0, unit: 0 };
      }
      const stats = qtiesById[templateId];
      stats.count += 1;
      stats.unit = stats.count;
      if (annotation.qties?.enabled) {
        if (Number.isFinite(annotation.qties.length))
          stats.length += annotation.qties.length;
        if (Number.isFinite(annotation.qties.surface))
          stats.surface += annotation.qties.surface;
      }
    }
    return qtiesById;
  }, [showAllListings, annotations]);

  const templatesWithQties = Object.entries(templateQties)
    .map(([templateId, stats]) => {
      const template = annotationTemplateById[templateId];
      if (!template) return null;
      return {
        ...template,
        mainQtyLabel: getAnnotationTemplateMainQtyLabel(template, stats),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));

  const hasAnnotations = showAllListings
    ? groupedByListing.length > 0
    : templatesWithQties.length > 0;

  // handlers

  function handleOpenDialog() {
    setOpenDialog(true);
  }

  function handleCloseDialog() {
    setOpenDialog(false);
  }

  function handleQtyModeChange(newValue) {
    if (newValue) onQtyModeChange(newValue);
  }

  // render - annotations recap

  function renderAnnotationsRecap() {
    if (!hasAnnotations) {
      return (
        <Typography variant="body2" color="text.secondary">
          Aucun objet repéré
        </Typography>
      );
    }
    if (showAllListings) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {groupedByListing.map((group) => (
            <Box key={group.listingName}>
              <Typography
                variant="body2"
                sx={{ fontWeight: "bold", mb: 0.5 }}
              >
                {group.listingName}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.25,
                }}
              >
                {group.templates.map((template) => (
                  <Box
                    key={template.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
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
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {templatesWithQties.map((template) => (
          <Box
            key={template.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <AnnotationTemplateIcon template={template} size={16} />
            <Typography variant="body2" noWrap sx={{ flex: 1 }}>
              {template.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ fontFamily: "monospace", fontWeight: 500 }}>
              {template.mainQtyLabel}
            </Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", gap: 2, width: 1 }}>
      {/* Left column */}
      <Box
        sx={{
          width: "40%",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 1,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: "bold", mb: 1 }}>
          {title}
        </Typography>
        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          }}
        >
          <Typography variant="h3" sx={{ fontWeight: "bold" }}>
            {annotationCount}
            <Typography
              component="span"
              variant="subtitle1"
              color="text.secondary"
              sx={{ ml: 1 }}
            >
              annotations
            </Typography>
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<TableChart />}
            onClick={handleOpenDialog}
          >
            Voir les données
          </Button>
        </Box>
      </Box>

      {/* Right column */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          pl: "24px",
          pr: "24px",
        }}
      >
        <Box sx={{ mb: 2 }}>
          <ToggleSingleSelectorGeneric
            options={[
              { key: "ANNOTATIONS", label: "Repérages" },
              { key: "ARTICLES", label: "Ouvrages" },
            ]}
            selectedKey={qtyMode}
            onChange={handleQtyModeChange}
          />
        </Box>

        {isArticlesMode ? (
          <SectionArticlesQties annotations={annotations} />
        ) : (
          renderAnnotationsRecap()
        )}
      </Box>

      {/* Dialog with DataGrid */}
      <DialogGeneric
        title={title}
        open={openDialog}
        onClose={handleCloseDialog}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations
            annotations={annotations}
            showListingName={showAllListings}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </Box>
  );
}
