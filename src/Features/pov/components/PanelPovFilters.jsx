import { useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, IconButton, Typography } from "@mui/material";
import { Visibility, VisibilityOff } from "@mui/icons-material";

import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useUpdateAnnotationTemplates from "Features/annotations/hooks/useUpdateAnnotationTemplates";
import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useListings from "Features/listings/hooks/useListings";
import groupAnnotationTemplatesByGroupLabel from "Features/annotations/utils/groupAnnotationTemplatesByGroupLabel";

// One template row: icon + label + visibility eye (no SOLO, no tools —
// lean read-only variant of PopperMapListings' AnnotationTemplateRow).
function TemplateFilterRow({ template, spriteImage, onToggleHidden }) {
  const isHidden = Boolean(template.hidden);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        pl: 2,
        pr: 1,
        py: 0.25,
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
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
        size="small"
        onClick={() => onToggleHidden(template)}
        title={isHidden ? "Afficher" : "Masquer"}
      >
        {isHidden ? (
          <VisibilityOff sx={{ fontSize: 16 }} />
        ) : (
          <Visibility sx={{ fontSize: 16 }} />
        )}
      </IconButton>
    </Box>
  );
}

// Templates of one listing, grouped by groupLabel, filtered to the templates
// that have an annotation on the displayed base maps.
function ListingFilterSection({ listing, visibleTemplateIds, spriteImage }) {
  // data

  const allTemplates = useAnnotationTemplates({
    filterByListingId: listing.id,
    sortByOrder: true,
  });
  const updateAnnotationTemplates = useUpdateAnnotationTemplates();

  // helpers

  const templates = useMemo(
    () => (allTemplates ?? []).filter((t) => visibleTemplateIds.has(t.id)),
    [allTemplates, visibleTemplateIds]
  );

  const groupedItems = useMemo(
    () => groupAnnotationTemplatesByGroupLabel(templates),
    [templates]
  );

  // The listing eye mirrors the template eyes: off when every template of the
  // listing is hidden (same rule as PopperMapListings' ListingRow).
  const isHidden = templates.length > 0 && templates.every((t) => t.hidden);

  // handlers

  async function handleToggleTemplateHidden(template) {
    await updateAnnotationTemplates([
      { id: template.id, hidden: !template.hidden },
    ]);
  }

  async function handleToggleListingVisibility() {
    const targetHidden = !isHidden;
    const updates = templates
      .filter((t) => Boolean(t.hidden) !== targetHidden)
      .map((t) => ({ id: t.id, hidden: targetHidden }));
    await updateAnnotationTemplates(updates);
  }

  // render

  if (templates.length === 0) return null;

  return (
    <Box sx={{ mb: 1 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 1,
          pr: 1,
          py: 0.25,
        }}
      >
        <Typography
          variant="body2"
          sx={{ fontWeight: "bold", flex: 1, minWidth: 0 }}
          noWrap
        >
          {listing.name}
        </Typography>
        <IconButton
          size="small"
          onClick={handleToggleListingVisibility}
          title={isHidden ? "Tout afficher" : "Tout masquer"}
        >
          {isHidden ? (
            <VisibilityOff sx={{ fontSize: 16 }} />
          ) : (
            <Visibility sx={{ fontSize: 16 }} />
          )}
        </IconButton>
      </Box>

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
              }}
            >
              {item.groupLabel}
            </Typography>
          );
        }
        return (
          <TemplateFilterRow
            key={item.id}
            template={item}
            spriteImage={spriteImage}
            onToggleHidden={handleToggleTemplateHidden}
          />
        );
      })}
    </Box>
  );
}

// "Filtres" tab of the POV drawer: annotation templates grouped by listing
// with a visibility eye, scoped to the templates having annotations on the
// displayed base maps (main + 3D extra base maps when POV shows the 3D
// editor) — same legend scope as PopperMapListings in SELECT / 3D mode.
export default function PanelPovFilters() {
  // strings

  const emptyS = "Aucune annotation sur les fonds de plan affichés.";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const povViewerMode = useSelector((s) => s.pov.viewerMode);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );

  const isThreed = povViewerMode === "THREED";
  const baseMap = useMainBaseMap();
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();
  const spriteImage = useAnnotationSpriteImage();

  // Same options as PopperMapListings' legend source: keep eye-hidden
  // templates so their rows stay listed (greyed) and can be re-enabled.
  const allAnnotationsInclHidden = useAnnotationsV2({
    caller: "PanelPovFilters",
    filterByMainBaseMap: true,
    hideBaseMapAnnotations: true,
    excludeBgAnnotations: true,
    excludeIsForBaseMapsListings: true,
    ignoreSolo: true,
    keepHiddenTemplates: true,
    ...(isThreed
      ? {
          extraBaseMapIds,
          filterBySelectedScope: true,
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

  // helpers - legend scope (annotations of the displayed base maps)

  const legendAnnotations = useMemo(() => {
    let arr = allAnnotationsInclHidden ?? [];
    if (isThreed && hideMainAnnotationsIn3d)
      arr = arr.filter((a) => a.baseMapId !== baseMap?.id);
    return arr;
  }, [allAnnotationsInclHidden, isThreed, hideMainAnnotationsIn3d, baseMap?.id]);

  const visibleTemplateIds = useMemo(
    () =>
      new Set(
        legendAnnotations
          .filter((a) => a.annotationTemplateId)
          .map((a) => a.annotationTemplateId)
      ),
    [legendAnnotations]
  );
  const visibleListingIds = useMemo(
    () => new Set(legendAnnotations.map((a) => a.listingId).filter(Boolean)),
    [legendAnnotations]
  );

  const displayedListings = useMemo(
    () =>
      (listings ?? []).filter(
        (l) => !l.isFreeAnnotationsListing && visibleListingIds.has(l.id)
      ),
    [listings, visibleListingIds]
  );

  // render

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", py: 1 }}>
      {displayedListings.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
          {emptyS}
        </Typography>
      )}
      {displayedListings.map((listing) => (
        <ListingFilterSection
          key={listing.id}
          listing={listing}
          visibleTemplateIds={visibleTemplateIds}
          spriteImage={spriteImage}
        />
      ))}
    </Box>
  );
}
