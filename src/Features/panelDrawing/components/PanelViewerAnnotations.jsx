import { useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import ChipsViewerScope from "./ChipsViewerScope";
import SectionViewerListing from "./SectionViewerListing";
import PanelTemplateAnnotations from "./PanelTemplateAnnotations";
import PanelTemplateProperties from "./PanelTemplateProperties";
import PanelAnnotationDetail from "./PanelAnnotationDetail";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListings from "Features/listings/hooks/useListings";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// PanelViewerAnnotations — left panel of the Viewer module: every listing of
// the repérage as a collapsible section over its read-only template rows
// (eye + quantities + detail navigation — no drawing). Shares the detail
// subviews (template annotations / properties / one annotation) with the
// Dessin panel.
// ---------------------------------------------------------------------------

export default function PanelViewerAnnotations() {
  // strings

  const descriptionS =
    "Toutes les listes du repérage, en lecture seule : contrôlez les " +
    "quantités et l'affichage de chaque modèle.";
  const emptyS = "Aucune annotation sur les fonds de plan affichés.";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );

  // Scope chip: the active base map only, or the whole repérage.
  const viewerScope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);
  const isAllScope = viewerScope === "ALL";

  // Detail view: template whose detail is open + subview.
  const detailTemplateId = useSelector((s) => s.panelDrawing.detailTemplateId);
  const detailView = useSelector((s) => s.panelDrawing.detailView);
  const detailAnnotationId = useSelector(
    (s) => s.panelDrawing.detailAnnotationId
  );

  const isThreedEditor = isThreedFamilyViewerKey(effectiveViewerKey);
  const baseMap = useMainBaseMap();
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  // Same scope as the Dessin panel / recap: `ignoreSolo` keeps quantities
  // stable while a template is focused, `keepHiddenTemplates` keeps
  // eye-hidden rows listed (greyed), `withQties` computes each annotation's
  // qties with its own base map's meterByPx.
  // "Tous" scope: every annotation of the repérage (all base maps — withQties
  // computes each one with its own base map's meterByPx), no 3D mirroring.
  const annotations = useAnnotationsV2({
    caller: "PanelViewerAnnotations",
    filterByMainBaseMap: !isAllScope,
    filterBySelectedScope: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    excludeIsForBaseMapsListings: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    withQties: true,
    ...(isThreedEditor && !isAllScope
      ? {
          extraBaseMapIds,
          excludeProfileTemplates: true,
          excludeListingsIds: hiddenListingsIds,
        }
      : {}),
  });

  const { value: listings } = useListings({
    filterByScopeId: selectedScopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });

  // helpers - quantities + legend scope

  const scopedAnnotations = useMemo(() => {
    let arr = annotations ?? [];
    if (isThreedEditor && !isAllScope && hideMainAnnotationsIn3d)
      arr = arr.filter((a) => a.baseMapId !== baseMap?.id);
    return arr;
  }, [
    annotations,
    isThreedEditor,
    isAllScope,
    hideMainAnnotationsIn3d,
    baseMap?.id,
  ]);

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const qtiesById = useMemo(
    () =>
      computeAnnotationTemplateQties(scopedAnnotations, annotationTemplateById),
    [scopedAnnotations, annotationTemplateById]
  );

  // Legend scope: only templates with an annotation on the displayed base
  // maps (same rule as PanelAnnotationsRecap).
  const visibleTemplateIds = useMemo(
    () =>
      new Set(
        scopedAnnotations
          .filter((a) => a.annotationTemplateId)
          .map((a) => a.annotationTemplateId)
      ),
    [scopedAnnotations]
  );
  const visibleListingIds = useMemo(
    () => new Set(scopedAnnotations.map((a) => a.listingId).filter(Boolean)),
    [scopedAnnotations]
  );

  const displayedListings = useMemo(
    () => (listings ?? []).filter((l) => visibleListingIds.has(l.id)),
    [listings, visibleListingIds]
  );

  // helpers - detail view (shared with the Dessin panel; stale ids fall back
  // to the sections list)

  const detailTemplate = detailTemplateId
    ? annotationTemplateById?.[detailTemplateId]
    : null;
  const detailListing = detailTemplate
    ? (listings ?? []).find((l) => l.id === detailTemplate.listingId)
    : null;
  const detailAnnotations = useMemo(
    () =>
      detailTemplate
        ? scopedAnnotations
            .filter((a) => a.annotationTemplateId === detailTemplate.id)
            .sort((a, b) =>
              (a.createdAt ?? "").localeCompare(b.createdAt ?? "")
            )
        : [],
    [scopedAnnotations, detailTemplate]
  );
  const detailAnnotationIndex = detailAnnotationId
    ? detailAnnotations.findIndex((a) => a.id === detailAnnotationId)
    : -1;

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
        borderRight: "1px solid",
        borderColor: "divider",
      }}
    >
      {detailTemplate &&
      detailView === "ANNOTATION" &&
      detailAnnotationIndex !== -1 ? (
        <PanelAnnotationDetail
          template={detailTemplate}
          annotations={detailAnnotations}
          annotationIndex={detailAnnotationIndex}
        />
      ) : detailTemplate && detailView === "PROPERTIES" ? (
        <PanelTemplateProperties
          template={detailTemplate}
          annotationsCount={detailAnnotations.length}
        />
      ) : detailTemplate ? (
        <PanelTemplateAnnotations
          template={detailTemplate}
          listing={detailListing}
          annotations={detailAnnotations}
          templateQties={qtiesById?.[detailTemplate.id]}
          spriteImage={spriteImage}
        />
      ) : (
        <>
          <LeftDrawerPanelHeader title="Annotations" />
          <Typography
            variant="caption"
            sx={{ px: 2, pb: 1, color: "text.secondary" }}
          >
            {descriptionS}
          </Typography>

          <ChipsViewerScope
            baseMapName={baseMap?.name ?? baseMap?.label ?? "Fond de plan"}
          />

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
            {displayedListings.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
                {emptyS}
              </Typography>
            )}
            {displayedListings.map((listing) => (
              <SectionViewerListing
                key={listing.id}
                listing={listing}
                visibleTemplateIds={visibleTemplateIds}
                qtiesById={qtiesById}
                spriteImage={spriteImage}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
