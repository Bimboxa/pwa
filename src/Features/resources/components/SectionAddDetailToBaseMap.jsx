import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "Features/listings/listingsSlice";
import {
  setNewAnnotation,
  patchNewAnnotation,
} from "Features/annotations/annotationsSlice";
import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";

import { alpha, Box, Button, Tooltip, Typography } from "@mui/material";
import { West } from "@mui/icons-material";

import { getDefaultsForShape } from "Features/annotations/constants/drawingShapeConfig";
import { getDrawingToolByKey } from "Features/mapEditor/constants/drawingTools.jsx";
import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";
import getPdfPageThumbnailDataUrl from "Features/detailFolio/utils/getPdfPageThumbnailDataUrl";

const INTERCEPTOR_KEY = "PDF_PAGE_DETAIL";

// Bottom section of the resource PDF viewer (Dessin + Fonds de plan
// modules): an always-visible "Ajouter au fond de plan" button arming the
// ONE_CLICK draw of a DETAIL annotation, with NO template (disabled only
// while no listing is selected). In the BASE_MAPS module only while "Afficher
// les annotations" is ON — otherwise the placed detail would be invisible in
// that module's editor.
// The armed newAnnotation carries a PDF_PAGE_DETAIL commitInterceptor with
// the viewed page context: the placement click either links the annotation
// to the page's existing detail baseMap, or opens the creation dialog first.
// Either way the commit finds or creates, in the selected listing, the DETAIL
// annotationTemplate named after that detail (see drawingCommitInterceptors).
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
  const detailS = "Détail";
  const noListingS = "Sélectionnez d'abord une liste d'annotations";

  // data

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const isDrawingModule = moduleKey === "MAP";
  const isBaseMapsModule = moduleKey === "BASE_MAPS";
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // helpers

  const rotation = effectiveRotation ?? 0;

  const detailColor = getDefaultsForShape("DETAIL")?.fillColor ?? "#999";

  const commitInterceptor = newAnnotation?.commitInterceptor;
  const armed =
    enabledDrawingMode === "ONE_CLICK" &&
    commitInterceptor?.key === INTERCEPTOR_KEY &&
    commitInterceptor?.context?.resourceId === resource?.id;

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

  async function handleAddClick() {
    if (armed) {
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
        // Template-less DETAIL draft: the template is resolved at commit.
        ...getNewAnnotationPropsFromAnnotationTemplate({
          drawingShape: "DETAIL",
        }),
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
  if (isBaseMapsModule && !showAnnotationsInBaseMaps) return null;

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1,
          py: 0.5,
        }}
      >
        <Tooltip title={selectedListingId ? "" : noListingS}>
          <Box component="span" sx={{ flexShrink: 0 }}>
            <Button
              size="small"
              variant={armed ? "contained" : "outlined"}
              color="secondary"
              disabled={!selectedListingId}
              onClick={handleAddClick}
              startIcon={<West fontSize="small" />}
              sx={{
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
          </Box>
        </Tooltip>
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
              color: detailColor,
              bgcolor: alpha(detailColor, 0.15),
            }}
          >
            <OneClickIcon fontSize="small" />
          </Box>
        )}
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
          {detailS}
        </Typography>
      </Box>
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
