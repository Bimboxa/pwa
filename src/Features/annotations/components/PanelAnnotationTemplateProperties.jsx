import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import useAnnotationTemplates from "../hooks/useAnnotationTemplates";

import {
  selectSelectedItem,
  triggerSelectionBack,
  setSelectedItem,
  setSelectedItems,
  setShowAnnotationsProperties,
} from "Features/selection/selectionSlice";

import { Box, Typography, IconButton, Tabs, Tab } from "@mui/material";
import { ArrowBack as Back } from "@mui/icons-material";

import FormAnnotationTemplateVariantBlock from "./FormAnnotationTemplateVariantBlock";
import useUpdateAnnotationTemplate from "../hooks/useUpdateAnnotationTemplate";
import useAnnotationsV2 from "../hooks/useAnnotationsV2";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import { selectBaseMapsGridScopeOpen } from "Features/baseMapsGrid/utils/selectBaseMapsGridPinned";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconButtonMoreActionsAnnotationTemplate from "./IconButtonMoreActionsAnnotationTemplate";
import SectionAnnotationTemplateKeyQties from "./SectionAnnotationTemplateKeyQties";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";
import computeAnnotationTemplateQties from "../utils/computeAnnotationTemplateQties";
import mergePaintedQtiesIntoTemplateQties from "../utils/mergePaintedQtiesIntoTemplateQties";

export default function PanelAnnotationTemplateProperties() {
  const dispatch = useDispatch();

  // state

  const [tab, setTab] = useState("MAIN");

  // strings

  const title = "Modèle d'annotation";

  // data

  // Project-wide: the selected template may belong to a visible listing that
  // is not the active one (back from an annotation of another listing).
  const annotationTemplates = useAnnotationTemplates();

  const selectedItem = useSelector(selectSelectedItem);

  const selectedAnnotationTemplate = annotationTemplates?.find(
    (a) => a.id === selectedItem?.id
  );

  const updateAnnotationTemplate = useUpdateAnnotationTemplate();

  const hiddenListingsIds = useSelector((s) => s.listings.hiddenListingsIds);
  const openedPanel = useSelector((s) => s.listings.openedPanel);
  const hideBaseMapAnnotations = openedPanel !== "BASE_MAP_DETAIL";

  // Base maps shown beside the main one, mirrored from PopperMapListings so
  // the counts match the legend: the sheets of the SCOPE grid while it is
  // displayed, else the extra base maps of the 3D scene.
  const baseMap = useMainBaseMap();
  const isScopeGridOpen = useSelector(selectBaseMapsGridScopeOpen);
  const scopeSheetIds = useSelector(
    (s) => s.baseMapsGrid.scopeSheets.baseMapIds
  );
  const extraBaseMapIdsIn3d = useExtraBaseMapIdsIn3d();
  const extraBaseMapIds = useMemo(() => {
    if (!isScopeGridOpen) return extraBaseMapIdsIn3d;
    return scopeSheetIds.filter((id) => id !== baseMap?.id);
  }, [isScopeGridOpen, extraBaseMapIdsIn3d, scopeSheetIds, baseMap?.id]);

  // Same scope for the annotations and the painted parts (« Pinceau »), so
  // the key quantities below cover one consistent set. `withQties` computes
  // each annotation's qties with its own base map's meterByPx.
  const scopeOptions = {
    excludeListingsIds: hiddenListingsIds,
    filterByMainBaseMap: true,
    extraBaseMapIds,
    filterBySelectedScope: true,
  };

  const allAnnotations = useAnnotationsV2({
    caller: "PanelAnnotationTemplateProperties",
    hideBaseMapAnnotations,
    withQties: true,
    ...scopeOptions,
  });

  const painted = usePaintedPartsQties(scopeOptions);

  // helper

  const label = selectedAnnotationTemplate?.label ?? "-?-";

  const matchingAnnotations = useMemo(
    () =>
      allAnnotations?.filter(
        (a) => a.annotationTemplateId === selectedAnnotationTemplate?.id
      ) ?? [],
    [allAnnotations, selectedAnnotationTemplate?.id]
  );

  // Key quantities of the template: same aggregates as the Dessin / Viewer
  // panels (mesh cells and foreign footprints excluded, painted parts added).
  const qties = useMemo(() => {
    const templateId = selectedAnnotationTemplate?.id;
    if (!templateId) return null;
    const templateById = { [templateId]: selectedAnnotationTemplate };
    const base = computeAnnotationTemplateQties(
      matchingAnnotations,
      templateById
    );
    const merged = mergePaintedQtiesIntoTemplateQties(
      base,
      painted?.qtiesByTemplateId,
      templateById
    );
    return merged?.[templateId] ?? null;
  }, [matchingAnnotations, selectedAnnotationTemplate, painted]);

  const matchCount = qties?.count ?? 0;
  const showKeyQties = matchCount > 0 || (qties?.paintedListedCount ?? 0) > 0;

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

      {showKeyQties && (
        <SectionAnnotationTemplateKeyQties
          annotationTemplate={selectedAnnotationTemplate}
          qties={qties}
          count={matchCount}
          onSelectAll={handleSelectAll}
        />
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
