import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import useAnnotationTemplatesBySelectedListing from "../hooks/useAnnotationTemplatesBySelectedListing";

import {
  selectSelectedItem,
  triggerSelectionBack,
  setSelectedItem,
  setSelectedItems,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

import { Box, Typography, IconButton, Tooltip, Tabs, Tab } from "@mui/material";
import { ArrowBack as Back, SelectAll } from "@mui/icons-material";

import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import useUpdateAnnotationTemplate from "../hooks/useUpdateAnnotationTemplate";
import useAnnotationsV2 from "../hooks/useAnnotationsV2";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonMoreActionsAnnotationTemplate from "./IconButtonMoreActionsAnnotationTemplate";

export default function PanelAnnotationTemplateProperties() {
  const dispatch = useDispatch();

  // state

  const [tab, setTab] = useState("MAIN");

  // strings

  const title = "Modèle d'annotation";

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();

  const selectedItem = useSelector(selectSelectedItem);

  const selectedAnnotationTemplate = annotationTemplates?.find(
    (a) => a.id === selectedItem?.id
  );

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";

  const allAnnotations = useAnnotationsV2({
    caller: "PanelAnnotationTemplateProperties",
    excludeListingsIds: hiddenListingsIds,
    hideBaseMapAnnotations,
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: viewerKey === "MAP",
    onlyIsForBaseMapsListings: viewerKey === "BASE_MAPS",
  });

  // helper

  const label = selectedAnnotationTemplate?.label ?? "-?-";

  const matchingAnnotations =
    allAnnotations?.filter(
      (a) => a.annotationTemplateId === selectedAnnotationTemplate?.id
    ) ?? [];
  const matchCount = matchingAnnotations.length;

  // handler

  function handleChange(newAnnotationTemplate) {
    console.log("newAnnotationTemplate", newAnnotationTemplate);
    updateAnnotationTemplate(newAnnotationTemplate);
  }

  // Duplicating from here: the selection moves to the duplicate.
  function handleDuplicated(createdTemplate) {
    dispatch(
      setSelectedItem({ id: createdTemplate.id, type: "ANNOTATION_TEMPLATE" })
    );
  }

  function handleSelectAll() {
    const items = matchingAnnotations.map((a) => ({
      id: a.id,
      nodeId: a.id,
      type: "NODE",
      nodeType: a.type,
      entityId: a.entityId,
      listingId: a.listingId,
      annotationTemplateId: a.annotationTemplateId,
      pointId: null,
      partId: null,
      partType: null,
    }));

    dispatch(setSelectedItems(items));

    if (items.length === 1) {
      dispatch(setShowAnnotationsProperties(true));
    }
  }

  // render

  return (
    <BoxFlexVStretch sx={{}}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <IconButton onClick={() => dispatch(triggerSelectionBack())}>
            <Back />
          </IconButton>

          <Box sx={{ ml: 1 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                fontSize: (theme) => theme.typography.caption.fontSize,
              }}
            >
              Modèle d'annotation
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: "bold" }}>
              {label}
            </Typography>
          </Box>
        </Box>

        <IconButtonMoreActionsAnnotationTemplate
          annotationTemplate={selectedAnnotationTemplate}
          onDuplicated={handleDuplicated}
        />
      </Box>

      {matchCount > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 1.5,
            py: 0.5,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            {matchCount} annotation{matchCount > 1 ? "s" : ""}
          </Typography>
          <Tooltip title="Sélectionner les annotations">
            <IconButton size="small" onClick={handleSelectAll}>
              <SelectAll fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label="Principal" value="MAIN" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab label="Avancé" value="ADVANCED" sx={{ minHeight: 36, py: 0.5 }} />
      </Tabs>

      <BoxFlexVStretch sx={{ overflow: "auto" }}>
        <FormAnnotationTemplateVariantBlock
          annotationTemplate={selectedAnnotationTemplate}
          onChange={handleChange}
          tab={tab}
        />
      </BoxFlexVStretch>
    </BoxFlexVStretch>
  );
}
