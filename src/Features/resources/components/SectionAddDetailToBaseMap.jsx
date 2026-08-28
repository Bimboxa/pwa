import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import {
  setNewAnnotation,
  patchNewAnnotation,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { alpha, Box, Button, Typography } from "@mui/material";
import { West } from "@mui/icons-material";

import useSelectedListing from "Features/listings/hooks/useSelectedListing";
import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import { resolveDrawingShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getPdfPageThumbnailDataUrl from "Features/detailFolio/utils/getPdfPageThumbnailDataUrl";

const INTERCEPTOR_KEY = "PDF_PAGE_DETAIL";

// Bottom section of the resource PDF viewer (Dessin + Fonds de plan
// modules): one row per DETAIL annotationTemplate of the selected listing,
// with an "Ajouter au fond de plan" button arming the ONE_CLICK draw of that
// template. In the BASE_MAPS module the listing must be isForBaseMaps —
// annotations of other listings are filtered out of that module's editor.
// The armed newAnnotation carries a PDF_PAGE_DETAIL commitInterceptor with
// the viewed page context: the placement click either links the annotation
// to the page's existing detail baseMap, or opens the creation dialog first
// (see drawingCommitInterceptors).
export default function SectionAddDetailToBaseMap({
  resource,
  pageNumber,
  effectiveRotation,
  pdfDocument,
}) {
  const dispatch = useDispatch();

  // strings

  const addS = "Ajouter au fond de plan";
  const armedS = "Cliquez sur le plan pour placer le détail.";

  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isDrawingModule = moduleKey === "MAP";
  const isBaseMapsModule = moduleKey === "BASE_MAPS";
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const { value: selectedListing } = useSelectedListing();
  const templates = useAnnotationTemplatesBySelectedListing({
    sortByLabel: true,
  });
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // helpers

  const rotation = effectiveRotation ?? 0;

  const detailTemplates = useMemo(
    () => (templates ?? []).filter((t) => resolveDrawingShape(t) === "DETAIL"),
    [templates]
  );

  const commitInterceptor = newAnnotation?.commitInterceptor;
  const armed =
    enabledDrawingMode === "ONE_CLICK" &&
    commitInterceptor?.key === INTERCEPTOR_KEY &&
    commitInterceptor?.context?.resourceId === resource?.id;

  const isArmedForTemplate = (template) =>
    armed && newAnnotation?.annotationTemplateId === template.id;

  const OneClickIcon = getDrawingToolByKey("ONE_CLICK")?.Icon;

  // Keep the armed context in sync with the viewed page: browsing to another
  // page or rotating after arming re-targets the placement (thumbnail
  // included).
  useEffect(() => {
    if (!armed || !pdfDocument) return;
    const context = commitInterceptor.context;
    if (context.pageNumber === pageNumber && context.rotation === rotation)
      return;
    let cancelled = false;
    (async () => {
      let thumbnail = null;
      try {
        thumbnail = await getPdfPageThumbnailDataUrl(
          pdfDocument,
          pageNumber,
          rotation
        );
      } catch {
        // keep a null thumbnail: the dialog renders without preview
      }
      if (cancelled) return;
      dispatch(
        patchNewAnnotation({
          commitInterceptor: {
            key: INTERCEPTOR_KEY,
            context: { ...context, pageNumber, rotation, thumbnail },
          },
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [armed, pageNumber, rotation, pdfDocument]);

  // handlers

  async function handleAddClick(template) {
    if (isArmedForTemplate(template)) {
      dispatch(setEnabledDrawingMode(null));
      return;
    }
    let thumbnail = null;
    try {
      thumbnail = await getPdfPageThumbnailDataUrl(
        pdfDocument,
        pageNumber,
        rotation
      );
    } catch {
      // keep a null thumbnail: the dialog renders without preview
    }
    dispatch(setSelectedListingId(selectedListingId));
    dispatch(
      setNewAnnotation({
        ...getNewAnnotationPropsFromAnnotationTemplate(template),
        commitInterceptor: {
          key: INTERCEPTOR_KEY,
          context: {
            resourceId: resource.id,
            resourceName: resource.name,
            pageNumber,
            rotation,
            thumbnail,
          },
        },
      })
    );
    dispatch(setEnabledDrawingMode("ONE_CLICK"));
  }

  // render

  if (!isDrawingModule && !isBaseMapsModule) return null;
  if (isBaseMapsModule && !selectedListing?.isForBaseMaps) return null;
  if (detailTemplates.length === 0) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: "background.default",
      }}
    >
      {detailTemplates.map((template) => {
        const templateColor =
          template.fillColor ?? template.strokeColor ?? "#999";
        const isArmed = isArmedForTemplate(template);
        return (
          <Box
            key={template.id}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 1,
              py: 0.5,
            }}
          >
            <Button
              size="small"
              variant={isArmed ? "contained" : "outlined"}
              color="secondary"
              onClick={() => handleAddClick(template)}
              startIcon={<West fontSize="small" />}
              sx={{
                flexShrink: 0,
                // Nudging arrow towards the map (left of the panel): hints
                // that the detail is placed onto the base map.
                "& .MuiButton-startIcon": {
                  animation: "detailNudgeLeft 1.4s ease-in-out infinite",
                },
                "@keyframes detailNudgeLeft": {
                  "0%, 100%": { transform: "translateX(0)" },
                  "50%": { transform: "translateX(-4px)" },
                },
                "@media (prefers-reduced-motion: reduce)": {
                  "& .MuiButton-startIcon": { animation: "none" },
                },
              }}
            >
              {addS}
            </Button>
            {OneClickIcon && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 1,
                  flexShrink: 0,
                  color: templateColor,
                  bgcolor: alpha(templateColor, 0.15),
                }}
              >
                <OneClickIcon fontSize="small" />
              </Box>
            )}
            <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
              {template.label}
            </Typography>
          </Box>
        );
      })}
      {armed && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", px: 1, pb: 0.5 }}
        >
          {armedS}
        </Typography>
      )}
    </Box>
  );
}
