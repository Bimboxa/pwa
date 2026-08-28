import { useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, Typography } from "@mui/material";

import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import WarningBaseMapNotToScale from "Features/mapEditor/components/WarningBaseMapNotToScale";
import FieldActiveListing from "./FieldActiveListing";
import ChipsViewerScope from "./ChipsViewerScope";
import ListPanelDrawingTemplates from "./ListPanelDrawingTemplates";
import SectionPanelDrawingTools from "./SectionPanelDrawingTools";
import SectionPanelDrawingHelper from "./SectionPanelDrawingHelper";
import SectionPanelPasteHelper from "./SectionPanelPasteHelper";
import PanelTemplateAnnotations from "./PanelTemplateAnnotations";
import PanelTemplateProperties from "./PanelTemplateProperties";
import PanelAnnotationDetail from "./PanelAnnotationDetail";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListings from "Features/listings/hooks/useListings";
import useFreeAnnotationTemplates from "Features/mapEditor/hooks/useFreeAnnotationTemplates";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// ---------------------------------------------------------------------------
// PanelDrawing — interactive left panel of the Dessin module (#310): listing
// selector, template rows with the split draw button, and the drawing tools.
// Replaces the floating PopperMapListings in this module; while a drawing
// mode is armed the panel content swaps to the drawing helper.
// ---------------------------------------------------------------------------

export default function PanelDrawing() {
  // strings

  const descriptionS =
    "Repérez les ouvrages du plan avec les modèles de la liste active : " +
    "chaque tracé alimente ses quantités.";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);
  const pasteClipboard = useSelector((s) => s.mapEditor.pasteClipboard);
  // Helper swaps (paste / drawing) only in DOCKED mode: in drawer mode the
  // popper is the visible surface and shows its own floating helpers
  // (mounting a second drawing helper here would duplicate the loupe
  // container).
  const leftPanelDocked = useSelector((s) => s.leftPanel.leftPanelDocked);
  const effectiveViewerKey = useSelector(selectEffectiveViewerKey);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  // Coming from the LISTING module: the panel scopes to that listing only
  // (same rule as PopperMapListings).
  const viewerReturnContext = useSelector((s) => s.viewers.viewerReturnContext);

  // Detail view (#311): template whose detail is open + subview
  // (annotations list, template properties or one annotation).
  const detailTemplateId = useSelector((s) => s.panelDrawing.detailTemplateId);
  const detailView = useSelector((s) => s.panelDrawing.detailView);
  const detailAnnotationId = useSelector(
    (s) => s.panelDrawing.detailAnnotationId
  );

  const isThreedEditor = isThreedFamilyViewerKey(effectiveViewerKey);
  // Scope chips (active base map / "Tous", shared with the Viewer panel):
  // "Tous" widens the annotations set to the whole repérage.
  const viewerScope = useSelector((s) => s.panelDrawing.viewerAnnotationsScope);
  const isAllScope = viewerScope === "ALL";
  const baseMap = useMainBaseMap();
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();
  const annotationTemplates = useAnnotationTemplates();
  const spriteImage = useAnnotationSpriteImage();

  // Same scope as PanelAnnotationsRecap: `ignoreSolo` keeps quantities stable
  // while a template is focused, `keepHiddenTemplates` keeps eye-hidden rows
  // countable, `withQties` computes each annotation's qties with its own base
  // map's meterByPx.
  const annotations = useAnnotationsV2({
    caller: "PanelDrawing",
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

  // Ensure the system listing ("Générique") + its Ligne/Polygone templates
  // exist for this scope (idempotent) — the popper used to mount this and is
  // hidden in the Dessin module.
  useFreeAnnotationTemplates();

  // helpers - listings (rank order from the selector; the system "Générique"
  // listing stays pinned first only while it has no rank — a drag reorder in
  // FieldActiveListing gives every listing a rank, which then wins)

  const comesFromListing = viewerReturnContext?.fromViewer === "LISTING";
  const returnListingId = viewerReturnContext?.listingId;

  const displayedListings = useMemo(() => {
    const pinnedSystemListings =
      listings?.filter((l) => l.isFreeAnnotationsListing && l.rank == null) ??
      [];
    const otherListings =
      listings?.filter(
        (l) => !(l.isFreeAnnotationsListing && l.rank == null)
      ) ?? [];
    const ordered = [...pinnedSystemListings, ...otherListings];
    if (comesFromListing && returnListingId)
      return ordered.filter((l) => l.id === returnListingId);
    return ordered;
  }, [listings, comesFromListing, returnListingId]);

  const activeListing =
    displayedListings.find((l) => l.id === selectedListingId) ??
    displayedListings[0] ??
    null;

  // helpers - quantities

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

  // Annotations count per listing for the selector chips — same scope as the
  // panel quantities (mesh cells excluded, like computeAnnotationTemplateQties).
  const countsByListingId = useMemo(() => {
    const counts = {};
    for (const a of scopedAnnotations) {
      if (a.isMeshCell || !a.listingId) continue;
      counts[a.listingId] = (counts[a.listingId] ?? 0) + 1;
    }
    return counts;
  }, [scopedAnnotations]);

  // helpers - detail view (#311). A stale id (deleted template, scope
  // change) simply resolves to nothing and the main list renders.

  const detailTemplate = detailTemplateId
    ? annotationTemplateById?.[detailTemplateId]
    : null;
  const detailListing = detailTemplate
    ? (listings ?? []).find((l) => l.id === detailTemplate.listingId)
    : null;
  // Draw order — shared by the annotations subview (row numbering) and the
  // annotation subview (prev / next arrows).
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
      {pasteClipboard && leftPanelDocked ? (
        <>
          <LeftDrawerPanelHeader title="Dessin d'annotations" />
          <SectionPanelPasteHelper />
        </>
      ) : enabledDrawingMode && leftPanelDocked ? (
        <>
          <LeftDrawerPanelHeader title="Dessin d'annotations" />
          <SectionPanelDrawingHelper />
        </>
      ) : detailTemplate &&
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
          <LeftDrawerPanelHeader title="Dessin d'annotations" />
          <Typography
            variant="caption"
            sx={{ px: 2, pb: 1, color: "text.secondary" }}
          >
            {descriptionS}
          </Typography>

          {baseMap && !baseMap.meterByPx && (
            <WarningBaseMapNotToScale sx={{ mx: 1.5, mt: 0 }} />
          )}

          <FieldActiveListing
            listings={displayedListings}
            activeListing={activeListing}
            countsByListingId={countsByListingId}
          />

          {activeListing && (
            <ChipsViewerScope
              baseMapName={baseMap?.name ?? baseMap?.label ?? "Fond de plan"}
            />
          )}

          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
            {activeListing && (
              <ListPanelDrawingTemplates
                listingId={activeListing.id}
                qtiesById={qtiesById}
              />
            )}
          </Box>

          {/* Cut / split tools — 2D drawing modes only */}
          {!isThreedEditor && <SectionPanelDrawingTools />}
        </>
      )}
    </Box>
  );
}
