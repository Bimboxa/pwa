import { useMemo, useState } from "react";
import { useSelector } from "react-redux";

import { Box, Typography, Divider } from "@mui/material";
import { Image as ImageIcon, TableRows } from "@mui/icons-material";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useBusinessObjects from "Features/businessObjects/hooks/useBusinessObjects";
import useRelsBusinessObjectAnnotation from "Features/businessObjects/hooks/useRelsBusinessObjectAnnotation";
import ToggleSingleSelectorGeneric from "Features/layout/components/ToggleSingleSelectorGeneric";
import SectionBaseMap from "./SectionBaseMap";
import SectionBaseMapCard from "./SectionBaseMapCard";
import SectionCrossBaseMaps from "./SectionCrossBaseMaps";

// Recap editor of the SCOPE module, in two display modes (toggle top right):
//   - IMAGE (default): a two-column grid of sheet-shaped cards, the plan faded
//     and desaturated under its annotations. No quantities — the drawings are
//     the subject.
//   - QUANTITIES: the totals of the selected listing, then one row per base
//     map (thumbnail + quantities).
//
// The selected listing drives everything. Its entityModel type decides which
// quantities are displayed (annotation templates / business objects / none),
// which annotations are queried, and which base maps are worth showing:
//   - no listing        -> every base map, annotations of the whole scope
//                          grouped by listing name;
//   - BASE_MAP listing  -> the base maps of that listing, no quantities;
//   - BUSINESS_OBJECT   -> the base maps carrying an annotation linked to one
//                          of its objects, quantities per object;
//   - annotation listing-> the base maps carrying one of its annotations,
//                          quantities per annotation template.
const DISPLAY_MODES = { IMAGE: "IMAGE", QUANTITIES: "QUANTITIES" };

export default function MainListingMapsEditor({ listing }) {
  // strings

  const noBaseMapS = "Aucun fond de plan dans ce périmètre.";
  const noBaseMapForListingS = "Aucun fond de plan pour cette liste.";
  const imageModeS = "Image";
  const quantitiesModeS = "Quantités";

  // state

  // Display mode of the editor. Local like the mode it replaces: it is a way
  // of looking at the recap, not a setting of the scope.
  const [displayMode, setDisplayMode] = useState(DISPLAY_MODES.IMAGE);

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: baseMaps } = useBaseMaps({ filterByProject: projectId });
  // Base map folders switched off by the eye of the SCOPE panel.
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  // helpers - listing mode

  const entityModelType = listing?.entityModel?.type;
  const showAllListings = !listing;
  const isBaseMapListing = entityModelType === "BASE_MAP";
  const isBusinessObjectListing = entityModelType === "BUSINESS_OBJECT";

  // A business-objects listing owns no annotation — its objects are LINKED to
  // annotations of other listings — and a base-map listing owns none either.
  // Filtering by the listing id would empty the recap in both cases.
  const filterByListingId =
    showAllListings || isBaseMapListing || isBusinessObjectListing
      ? undefined
      : listing?.id;

  // data - annotations

  const annotationTemplates = useAnnotationTemplates({
    filterByListingId,
    sortByLabel: true,
  });

  const allAnnotations = useAnnotationsV2({
    caller: "MainListingMapsEditor",
    filterByListingId,
    excludeIsForBaseMapsListings: true,
    withQties: true,
    withListingName: showAllListings,
  });

  // data - business objects (fetched once here, not per base map section)

  const businessObjectListingId = isBusinessObjectListing ? listing?.id : null;
  const { value: businessObjects } = useBusinessObjects({
    listingId: businessObjectListingId,
  });
  const { value: businessObjectRels } = useRelsBusinessObjectAnnotation({
    listingId: businessObjectListingId,
  });

  // helpers

  const hasBaseMaps = baseMaps?.length > 0;
  // useAnnotationsV2 returns [] while loading as well as on an empty scope:
  // hold the "nothing to show" message back until the first result lands, or
  // the recap blinks on every listing switch.
  const annotationsLoading = !allAnnotations;

  const annotationsByBaseMapId = useMemo(() => {
    if (!allAnnotations) return {};
    const map = {};
    for (const a of allAnnotations) {
      if (!a.baseMapId) continue;
      if (!map[a.baseMapId]) map[a.baseMapId] = [];
      map[a.baseMapId].push(a);
    }
    return map;
  }, [allAnnotations]);

  // Base maps worth a section for the selected listing (see the table above),
  // minus the folders hidden from the panel.
  const displayedBaseMaps = useMemo(() => {
    if (!baseMaps?.length) return [];
    const visibleBaseMaps = hiddenListingsIds.length
      ? baseMaps.filter(
          (baseMap) => !hiddenListingsIds.includes(baseMap.listingId)
        )
      : baseMaps;
    if (showAllListings) return visibleBaseMaps;
    if (isBaseMapListing)
      return visibleBaseMaps.filter(
        (baseMap) => baseMap.listingId === listing?.id
      );
    if (isBusinessObjectListing) {
      const linkedIds = new Set(
        (businessObjectRels ?? []).map((rel) => rel.annotationId)
      );
      return visibleBaseMaps.filter((baseMap) =>
        (annotationsByBaseMapId[baseMap.id] ?? []).some((a) =>
          linkedIds.has(a.id)
        )
      );
    }
    return visibleBaseMaps.filter(
      (baseMap) => (annotationsByBaseMapId[baseMap.id] ?? []).length > 0
    );
  }, [
    baseMaps,
    hiddenListingsIds,
    showAllListings,
    isBaseMapListing,
    isBusinessObjectListing,
    listing?.id,
    businessObjectRels,
    annotationsByBaseMapId,
  ]);

  // handlers

  // The toggle group clears the value when the active button is pressed
  // again; keep the current mode rather than falling into an empty editor.
  function handleDisplayModeChange(mode) {
    if (mode) setDisplayMode(mode);
  }

  // render

  if (!hasBaseMaps) {
    return (
      <Box
        sx={{
          width: 1,
          height: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
        }}
      >
        <Typography color="text.secondary">{noBaseMapS}</Typography>
      </Box>
    );
  }

  const isImageMode = displayMode === DISPLAY_MODES.IMAGE;
  const showEmptyMessage =
    displayedBaseMaps.length === 0 && !annotationsLoading;

  return (
    <Box
      sx={{
        width: 1,
        height: 1,
        overflow: "auto",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      {/* Display mode toggle, top right of the editor */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleSingleSelectorGeneric
          options={[
            {
              key: DISPLAY_MODES.IMAGE,
              label: imageModeS,
              icon: <ImageIcon fontSize="small" />,
            },
            {
              key: DISPLAY_MODES.QUANTITIES,
              label: quantitiesModeS,
              icon: <TableRows fontSize="small" />,
            },
          ]}
          selectedKey={displayMode}
          onChange={handleDisplayModeChange}
        />
      </Box>

      {isImageMode ? (
        showEmptyMessage ? (
          <Typography variant="body2" color="text.secondary">
            {noBaseMapForListingS}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 2,
            }}
          >
            {displayedBaseMaps.map((baseMap) => (
              <SectionBaseMapCard
                key={baseMap.id}
                baseMap={baseMap}
                listing={listing}
                annotations={annotationsByBaseMapId[baseMap.id] ?? []}
                showAllListings={showAllListings}
              />
            ))}
          </Box>
        )
      ) : (
        <>
          <SectionCrossBaseMaps
            listing={listing}
            showAllListings={showAllListings}
            isBaseMapListing={isBaseMapListing}
            isBusinessObjectListing={isBusinessObjectListing}
            annotations={allAnnotations}
            annotationTemplates={annotationTemplates}
            businessObjects={businessObjects}
            businessObjectRels={businessObjectRels}
          />
          <Divider sx={{ my: 2 }} />
          {showEmptyMessage && (
            <Typography variant="body2" color="text.secondary">
              {noBaseMapForListingS}
            </Typography>
          )}
          {displayedBaseMaps.map((baseMap, index) => (
            <Box key={baseMap.id}>
              <SectionBaseMap
                baseMap={baseMap}
                listing={listing}
                annotationTemplates={annotationTemplates}
                annotations={annotationsByBaseMapId[baseMap.id] ?? []}
                showAllListings={showAllListings}
                isBaseMapListing={isBaseMapListing}
                isBusinessObjectListing={isBusinessObjectListing}
                businessObjects={businessObjects}
                businessObjectRels={businessObjectRels}
              />
              {index < displayedBaseMaps.length - 1 && (
                <Divider sx={{ my: 2 }} />
              )}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}
