import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSoloAnnotationTemplateId } from "Features/annotations/annotationsSlice";

import { Box, IconButton, Typography } from "@mui/material";
import { FilterAlt, FilterAltOutlined } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import LeftDrawerPanelHeader from "Features/leftPanel/components/LeftDrawerPanelHeader";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListings from "Features/listings/hooks/useListings";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";
import computeAnnotationTemplateQties from "Features/annotations/utils/computeAnnotationTemplateQties";
import getItemsByKey from "Features/misc/utils/getItemsByKey";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// One quantity: same font / color as the measurements row of
// ToolbarEditAnnotation (AnnotationMeasurements); zero values stay visible
// but dimmed.
function QtyLabel({ value, unit, decimals = 2 }) {
  const isZero = !Number.isFinite(value) || value === 0;
  const label = isZero ? `0 ${unit}` : `${value.toFixed(decimals)} ${unit}`;
  return (
    <Typography
      variant="caption"
      sx={{
        fontFamily: "monospace",
        fontWeight: 500,
        color: isZero ? "text.disabled" : "warning.main",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </Typography>
  );
}

// One template row (2 lines): icon + label + FOCUS toggle on top, the 3
// quantities below. The focus shows only this template's annotations —
// hidden in 2D, dimmed in 3D, like the zone solo of the ZONES module.
function TemplateRecapRow({ template, qties, spriteImage }) {
  const dispatch = useDispatch();

  // data

  const soloTemplateId = useSelector(
    (s) => s.annotations.soloAnnotationTemplateId
  );

  // helpers

  const isSolo = soloTemplateId === template.id;
  const isHidden = Boolean(template.hidden);

  // handlers

  function handleSoloClick() {
    dispatch(setSoloAnnotationTemplateId(isSolo ? null : template.id));
  }

  // render

  return (
    <Box
      sx={{
        pl: 2,
        pr: 0.5,
        py: 0.75,
        "&:hover": { bgcolor: "action.hover" },
        "&:hover .template-focus": { visibility: "visible" },
        "&:not(:last-child)": {
          borderBottom: "1px solid",
          borderColor: "divider",
        },
      }}
    >
      {/* Line 1 - icon + label + focus */}
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            mr: 1,
            flexShrink: 0,
            opacity: isHidden ? 0.4 : 1,
            filter: isHidden ? "grayscale(100%)" : "none",
          }}
        >
          <AnnotationTemplateIcon
            template={template}
            size={18}
            spriteImage={spriteImage}
          />
        </Box>
        <Typography
          variant="body2"
          color={isHidden ? "text.disabled" : "text.primary"}
          sx={{
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            userSelect: "none",
          }}
        >
          {template.label}
        </Typography>
        <IconButton
          className="template-focus"
          size="small"
          onClick={handleSoloClick}
          title={isSolo ? "Tout afficher" : "Afficher uniquement ce type"}
          color={isSolo ? "primary" : "default"}
          sx={{ ml: 0.25, visibility: isSolo ? "visible" : "hidden" }}
        >
          {isSolo ? (
            <FilterAlt sx={{ fontSize: 16 }} />
          ) : (
            <FilterAltOutlined sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>

      {/* Line 2 - quantities (right-aligned, toolbar measurements style) */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 1,
          pr: 1,
        }}
      >
        <QtyLabel value={qties?.unit ?? 0} unit="u" decimals={0} />
        <QtyLabel value={qties?.length ?? 0} unit="ml" />
        <QtyLabel value={qties?.surface ?? 0} unit="m²" />
      </Box>
    </Box>
  );
}

// Templates of one listing, grouped by groupLabel, filtered to the templates
// that have an annotation on the displayed base maps.
function ListingRecapSection({
  listing,
  visibleTemplateIds,
  qtiesById,
  spriteImage,
}) {
  // data

  const allTemplates = useAnnotationTemplates({
    filterByListingId: listing.id,
    sortByOrder: true,
  });

  // helpers

  const templates = useMemo(
    () => (allTemplates ?? []).filter((t) => visibleTemplateIds.has(t.id)),
    [allTemplates, visibleTemplateIds]
  );

  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(templates),
    [templates]
  );

  // render

  if (templates.length === 0) return null;

  return (
    <Box sx={{ mb: 1 }}>
      <Typography
        variant="body2"
        sx={{ fontWeight: "bold", pl: 1, pr: 1, py: 0.25 }}
        noWrap
      >
        {listing.name}
      </Typography>

      {/* White card under the item rows */}
      <Box
        sx={{
          bgcolor: "background.paper",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {groupedItems?.map((item, idx) => {
          if (item.isGroupDivider || item?.isDivider) return null;
          if (item.isGroupHeader) {
            return (
              <Typography
                key={`group-${item.groupLabel}-${idx}`}
                variant="caption"
                sx={{
                  display: "block",
                  pl: 2,
                  pt: 0.5,
                  pb: 0.25,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  fontWeight: 600,
                  fontSize: "0.7rem",
                  letterSpacing: 0.5,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {item.groupLabel}
              </Typography>
            );
          }
          return (
            <TemplateRecapRow
              key={item.id}
              template={item}
              qties={qtiesById?.[item.id]}
              spriteImage={spriteImage}
            />
          );
        })}
      </Box>
    </Box>
  );
}

// Dessin module left drawer: recap of the displayed annotations grouped by
// listing then annotation template, with the u / ml / m² quantities and a
// FOCUS toggle per template. Scope: the main base map in the 2D editor; the
// base maps whose annotations are enabled in the 3D chips band when the
// module displays the 3D editor (same legend scope as PanelPovFilters).
export default function PanelAnnotationsRecap() {
  // strings

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

  const isThreed = isThreedFamilyViewerKey(effectiveViewerKey);
  const baseMap = useMainBaseMap();
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();
  const spriteImage = useAnnotationSpriteImage();
  const annotationTemplates = useAnnotationTemplates();

  // `ignoreSolo` keeps the rows and quantities stable while a template is
  // focused; `keepHiddenTemplates` keeps eye-hidden template rows listed
  // (greyed); `withQties` computes each annotation's qties with its own base
  // map's meterByPx (multi-baseMap 3D scope).
  const annotations = useAnnotationsV2({
    caller: "PanelAnnotationsRecap",
    filterByMainBaseMap: true,
    filterBySelectedScope: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    excludeIsForBaseMapsListings: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    withQties: true,
    ...(isThreed
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

  // helpers - recap scope (annotations of the displayed base maps)

  const recapAnnotations = useMemo(() => {
    let arr = annotations ?? [];
    if (isThreed && hideMainAnnotationsIn3d)
      arr = arr.filter((a) => a.baseMapId !== baseMap?.id);
    return arr;
  }, [annotations, isThreed, hideMainAnnotationsIn3d, baseMap?.id]);

  const annotationTemplateById = useMemo(
    () => getItemsByKey(annotationTemplates ?? [], "id"),
    [annotationTemplates]
  );

  const qtiesById = useMemo(
    () =>
      computeAnnotationTemplateQties(recapAnnotations, annotationTemplateById),
    [recapAnnotations, annotationTemplateById]
  );

  const visibleTemplateIds = useMemo(
    () =>
      new Set(
        recapAnnotations
          .filter((a) => a.annotationTemplateId)
          .map((a) => a.annotationTemplateId)
      ),
    [recapAnnotations]
  );
  const visibleListingIds = useMemo(
    () => new Set(recapAnnotations.map((a) => a.listingId).filter(Boolean)),
    [recapAnnotations]
  );

  const displayedListings = useMemo(
    () => (listings ?? []).filter((l) => visibleListingIds.has(l.id)),
    [listings, visibleListingIds]
  );

  // render

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: 1,
        minHeight: 0,
        bgcolor: "background.default",
      }}
    >
      <LeftDrawerPanelHeader title="Annotations" />
      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", pb: 1 }}>
        {displayedListings.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            {emptyS}
          </Typography>
        )}
        {displayedListings.map((listing) => (
          <ListingRecapSection
            key={listing.id}
            listing={listing}
            visibleTemplateIds={visibleTemplateIds}
            qtiesById={qtiesById}
            spriteImage={spriteImage}
          />
        ))}
      </Box>
    </Box>
  );
}
