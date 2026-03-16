import { useRef, useState, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  setSelectedViewerKey,
  setViewerReturnContext,
} from "Features/viewers/viewersSlice";
import {
  setSelectedMainBaseMapId,
  setSelectedBaseMapsListingId,
} from "Features/mapEditor/mapEditorSlice";
import { setSelectedListingId } from "Features/listings/listingsSlice";
import { setSelectedEntityId } from "Features/entities/entitiesSlice";
import {
  setSelectedItem,
  selectSelectedItem,
} from "Features/selection/selectionSlice";

import { Box, Typography, Button } from "@mui/material";

import NodeSvgImage from "Features/mapEditorGeneric/components/NodeSvgImage";
import NodeAnnotationStatic from "Features/mapEditorGeneric/components/NodeAnnotationStatic";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import SectionArticlesQties from "Features/articles/components/SectionArticlesQties";

import getItemsByKey from "Features/misc/utils/getItemsByKey";
import getAnnotationTemplateMainQtyLabel from "Features/annotations/utils/getAnnotationTemplateMainQtyLabel";

export default function SectionBaseMap({
  baseMap,
  listing,
  annotationTemplates,
  annotations = [],
  showAllListings = false,
  qtyMode,
}) {
  const dispatch = useDispatch();

  // data

  const selectedItem = useSelector(selectSelectedItem);

  // state

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // helpers

  const imageUrl = baseMap.getUrl?.() || baseMap.getThumbnail?.();
  const imageSize = baseMap.getImageSize?.() || baseMap.image?.imageSize;
  const meterByPx = baseMap.getMeterByPx?.();
  const imageWidth = imageSize?.width;
  const imageHeight = imageSize?.height;
  const containerK = imageWidth && containerWidth ? containerWidth / imageWidth : 1;

  const selectedEntityId =
    selectedItem?.type === "ENTITY" ? selectedItem?.entityId : null;

  const nonLabelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type !== "LABEL") ?? [],
    [annotations]
  );
  const labelAnnotations = useMemo(
    () => annotations?.filter((a) => a.type === "LABEL") ?? [],
    [annotations]
  );

  // helpers - template quantities (derived from resolved annotations)

  const annotationTemplateById = getItemsByKey(
    annotationTemplates ?? [],
    "id"
  );

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
  }, [annotations, showAllListings]);

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

  const hasAnnotations = showAllListings
    ? groupedByListing.length > 0
    : templatesWithQties.length > 0;

  // handlers

  function handleOpenInMapViewer() {
    dispatch(
      setViewerReturnContext({
        fromViewer: "LISTING",
        listingId: showAllListings ? null : listing?.id,
      })
    );
    if (!showAllListings && listing?.id) {
      dispatch(setSelectedListingId(listing.id));
    }
    dispatch(setSelectedBaseMapsListingId(baseMap.listingId));
    dispatch(setSelectedMainBaseMapId(baseMap.id));
    dispatch(setSelectedViewerKey("MAP"));
  }

  function handleSvgClick(e) {
    const hit = e.target.closest?.("[data-node-entity-id]");
    if (hit) {
      const entityId = hit.dataset.nodeEntityId;
      const listingId = hit.dataset.nodeListingId;
      if (entityId) {
        const newId = selectedEntityId === entityId ? null : entityId;
        dispatch(setSelectedEntityId(newId));
        dispatch(
          setSelectedItem(
            newId
              ? { type: "ENTITY", entityId: newId, listingId }
              : null
          )
        );
        return;
      }
    }
    // Click on empty area -> deselect
    dispatch(setSelectedEntityId(null));
    dispatch(setSelectedItem(null));
  }

  // render

  return (
    <Box sx={{ width: 1 }}>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        {baseMap.name}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, width: 1 }}>
      {/* BaseMap image with annotation overlay - 40% width */}
      <Box ref={containerRef} sx={{ width: "40%", flexShrink: 0 }}>
        {imageUrl && imageSize ? (
          <Box sx={{ position: "relative" }}>
            <svg
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              width="100%"
              style={{
                display: "block",
                borderRadius: 4,
                backgroundColor: "#f5f5f5",
                cursor: "pointer",
              }}
              preserveAspectRatio="xMidYMid meet"
              onClick={handleSvgClick}
            >
              <NodeSvgImage
                src={imageUrl}
                width={imageWidth}
                height={imageHeight}
              />
              {containerWidth > 0 &&
                nonLabelAnnotations.map((annotation) => (
                  <NodeAnnotationStatic
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={imageSize}
                    baseMapMeterByPx={meterByPx}
                    containerK={containerK}
                    selected={
                      !!annotation.entityId &&
                      annotation.entityId === selectedEntityId
                    }
                    printMode
                  />
                ))}
            </svg>
            {/* Labels in separate overflow-visible SVG */}
            {containerWidth > 0 && labelAnnotations.length > 0 && (
              <svg
                viewBox={`0 0 ${imageWidth} ${imageHeight}`}
                width="100%"
                style={{
                  display: "block",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  pointerEvents: "none",
                  overflow: "visible",
                }}
                preserveAspectRatio="xMidYMid meet"
              >
                {labelAnnotations.map((annotation) => (
                  <NodeAnnotationStatic
                    key={annotation.id}
                    annotation={annotation}
                    imageSize={imageSize}
                    baseMapMeterByPx={meterByPx}
                    containerK={containerK}
                    selected={
                      !!annotation.entityId &&
                      annotation.entityId === selectedEntityId
                    }
                    printMode
                  />
                ))}
              </svg>
            )}
          </Box>
        ) : (
          <Box
            sx={{
              width: 1,
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "grey.100",
              borderRadius: 1,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              No image
            </Typography>
          </Box>
        )}
      </Box>

      {/* Content - quantities */}
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
        {qtyMode === "ARTICLES" ? (
          <SectionArticlesQties annotations={annotations} />
        ) : hasAnnotations ? (
          showAllListings ? (
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
                        <AnnotationTemplateIcon
                          template={template}
                          size={16}
                        />
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
          ) : (
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
          )
        ) : (
          <Typography variant="body2" color="text.secondary">
            Aucun objet repéré
          </Typography>
        )}

        <Box sx={{ mt: "auto", pt: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenInMapViewer}
          >
            Modifier le repérage
          </Button>
        </Box>
      </Box>
      </Box>
    </Box>
  );
}
