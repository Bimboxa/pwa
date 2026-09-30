import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  toggleBaseMapVisibleIn3d,
  toggleScene3dHiddenIn3d,
  setBaseMapAnnotationsModeIn3d,
} from "Features/threedEditor/threedEditorSlice";
import { setSelectedBaseMapsListingId } from "Features/mapEditor/mapEditorSlice";

import { Box, Typography } from "@mui/material";

import RowBaseMapInList from "./RowBaseMapInList";
import PopoverBaseMapVersions from "./PopoverBaseMapVersions";

import useBaseMaps from "../hooks/useBaseMaps";
import useProjectBaseMapListings from "../hooks/useProjectBaseMapListings";
import useMainBaseMapVisibilityToggles from "../hooks/useMainBaseMapVisibilityToggles";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSelectMainBaseMap from "Features/threedEditor/hooks/useSelectMainBaseMap";
import useDisabledBaseMapListingIds from "Features/baseMapEditor/hooks/useDisabledBaseMapListingIds";
import useAnnotationsCountByBaseMapId from "Features/annotations/hooks/useAnnotationsCountByBaseMapId";
import { ANNOTATIONS_DISPLAY_MODE } from "Features/threedEditor/constants/annotationsDisplayModeIn3d";
import { getScene3dDisplay3d } from "Features/scene3d/constants/scene3dConstants";

// ---------------------------------------------------------------------------
// SectionBaseMapsList — "Fonds de plan" side of the popper / PanelDrawing /
// PanelViewer: the scope's base maps grouped by listing, one row each with
// the image eye, the name, the "3D" scan button and the annotations badge.
// Row click selects the base map as main (same as the top bar selector).
//
// Controls per row (replaces the removed TopBaseMapChipsThreed band):
// - main base map: eye + badge drive the DISPLAYED editor's state through
//   useMainBaseMapVisibilityToggles (2D `viewers.hide*InViewer`, 3D
//   `threedEditor.hideMain*In3d`);
// - other base maps, 3D displayed: eye = visibleBaseMapIdsIn3d, badge =
//   annotationsModeByBaseMapIdIn3d (NONE ⇄ NORMAL);
// - other base maps, 2D displayed: no eye, plain count (only the main base
//   map is on screen).
// - "3D" button (scan base maps only): hiddenScene3dBaseMapIdsIn3d, a 3D
//   state toggled from either editor.
// ---------------------------------------------------------------------------

export default function SectionBaseMapsList() {
  const dispatch = useDispatch();

  // strings

  const emptyS = "Aucun fond de plan";
  const othersS = "Autres";
  const versionS = "Version";

  // data

  const { value: baseMaps = [] } = useBaseMaps({});
  const listings = useProjectBaseMapListings() ?? [];
  const { disabledListingIds } = useDisabledBaseMapListingIds();
  const mainBaseMap = useMainBaseMap();
  const selectMainBaseMap = useSelectMainBaseMap();
  const annotationsCountByBaseMapId = useAnnotationsCountByBaseMapId();
  const {
    isThreedDisplayed,
    imageOn: mainImageOn,
    annotationsOn: mainAnnotationsOn,
    toggleImage: toggleMainImage,
    toggleAnnotations: toggleMainAnnotations,
  } = useMainBaseMapVisibilityToggles();

  const visibleIds = useSelector((s) => s.threedEditor.visibleBaseMapIdsIn3d);
  const hiddenScanIds = useSelector(
    (s) => s.threedEditor.hiddenScene3dBaseMapIdsIn3d
  );
  const annotationsModeByBaseMapId = useSelector(
    (s) => s.threedEditor.annotationsModeByBaseMapIdIn3d
  );
  const viewerKey = useSelector((s) => s.viewers.selectedViewerKey);
  const showAnnotationsInBaseMaps = useSelector(
    (s) => s.baseMapEditor.showAnnotations
  );
  const hideEmpty = useSelector(
    (s) => s.popperMapListings.hideEmptyBaseMapsInList
  );

  // state

  const [versionsAnchorEl, setVersionsAnchorEl] = useState(null);

  // helpers

  const isViewerModule = viewerKey === "THREED";
  // BaseMaps module: the image is edited there (no eye, same as the top
  // bar), and the drawing annotations are loaded only with the panel switch.
  const isBaseMapsModule = viewerKey === "BASE_MAPS";
  const showImageEye = !isBaseMapsModule;
  const hideAnnotationsBadge = isBaseMapsModule && !showAnnotationsInBaseMaps;

  // Per-scope disabled listings leave the list — except the current main
  // base map, whose row hosts the eye / badge and must stay reachable. The
  // "hide empty" list option (properties panel) also drops the annotation-
  // less base maps, unless they are shown in 3D (image or annotations).
  const groups = useMemo(() => {
    const enabled = baseMaps.filter(
      (bm) =>
        (!disabledListingIds.includes(bm.listingId) ||
          bm.id === mainBaseMap?.id) &&
        (!hideEmpty ||
          bm.id === mainBaseMap?.id ||
          (annotationsCountByBaseMapId[bm.id] ?? 0) > 0 ||
          visibleIds.includes(bm.id) ||
          Boolean(annotationsModeByBaseMapId?.[bm.id]))
    );
    const byListing = new Map();
    for (const bm of enabled) {
      const key = bm.listingId ?? "__none__";
      if (!byListing.has(key)) byListing.set(key, []);
      byListing.get(key).push(bm);
    }
    const ordered = [];
    for (const listing of listings) {
      if (byListing.has(listing.id)) {
        ordered.push({
          id: listing.id,
          name: listing.name,
          baseMaps: byListing.get(listing.id),
        });
        byListing.delete(listing.id);
      }
    }
    for (const [key, bms] of byListing) {
      ordered.push({ id: key, name: othersS, baseMaps: bms });
    }
    return ordered;
  }, [
    baseMaps,
    disabledListingIds,
    listings,
    mainBaseMap?.id,
    othersS,
    hideEmpty,
    annotationsCountByBaseMapId,
    visibleIds,
    annotationsModeByBaseMapId,
  ]);

  const mainVersions = mainBaseMap?.versions ?? [];
  const activeVersion =
    mainVersions.find((v) => v.isActive) || mainVersions[0] || null;

  function getRowProps(map) {
    const isMain = map.id === mainBaseMap?.id;

    const imageEye = !showImageEye
      ? null
      : isMain
        ? { on: mainImageOn, onToggle: toggleMainImage }
        : isThreedDisplayed
          ? {
              on: visibleIds.includes(map.id),
              onToggle: () => dispatch(toggleBaseMapVisibleIn3d(map.id)),
            }
          : null;

    const count = annotationsCountByBaseMapId[map.id] ?? 0;
    const annotationsMode =
      annotationsModeByBaseMapId?.[map.id] ?? ANNOTATIONS_DISPLAY_MODE.NONE;
    const otherAnnotationsOn =
      annotationsMode !== ANNOTATIONS_DISPLAY_MODE.NONE;
    const annotationsBadge = hideAnnotationsBadge
      ? null
      : isMain
        ? { count, on: mainAnnotationsOn, onToggle: toggleMainAnnotations }
        : isThreedDisplayed
          ? {
              count,
              on: otherAnnotationsOn,
              onToggle: () =>
                dispatch(
                  setBaseMapAnnotationsModeIn3d({
                    baseMapId: map.id,
                    mode: otherAnnotationsOn
                      ? ANNOTATIONS_DISPLAY_MODE.NONE
                      : ANNOTATIONS_DISPLAY_MODE.NORMAL,
                  })
                ),
            }
          : { count, on: false, onToggle: null };

    const scanButton = map.scene3d
      ? {
          on: !hiddenScanIds.includes(map.id),
          disabled: getScene3dDisplay3d(map) !== "MESH",
          onToggle: () => dispatch(toggleScene3dHiddenIn3d(map.id)),
        }
      : null;

    // The Viewer module has no version selector in the top bar.
    const versionChip =
      isMain && isViewerModule && mainVersions.length > 1
        ? {
            label: activeVersion?.label || versionS,
            onOpen: (e) => setVersionsAnchorEl(e.currentTarget),
          }
        : null;

    return { isMain, imageEye, annotationsBadge, scanButton, versionChip };
  }

  // handlers

  function handleSelect(map) {
    selectMainBaseMap(map.id);
    // Keep the listing selection in sync: baseMap creation & url params
    // still read selectedBaseMapsListingId.
    if (map.listingId) dispatch(setSelectedBaseMapsListingId(map.listingId));
  }

  // render

  if (groups.length === 0) {
    return (
      <Typography
        variant="caption"
        sx={{
          display: "block",
          px: 2,
          py: 1.5,
          color: "panel.textMuted",
          fontStyle: "italic",
        }}
      >
        {emptyS}
      </Typography>
    );
  }

  return (
    <Box>
      {groups.map((group) => (
        <Box key={group.id}>
          {groups.length > 1 && (
            <Box
              sx={{
                px: 1,
                py: 0.5,
                bgcolor: "panel.sectionBg",
                borderBottom: "1px solid",
                borderColor: "panel.border",
              }}
            >
              <Typography
                variant="caption"
                noWrap
                sx={{
                  display: "block",
                  color: "panel.textMuted",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  fontSize: "11px",
                }}
              >
                {group.name}
              </Typography>
            </Box>
          )}
          {group.baseMaps.map((map) => (
            <RowBaseMapInList
              key={map.id}
              name={map.name}
              onSelect={() => handleSelect(map)}
              {...getRowProps(map)}
            />
          ))}
        </Box>
      ))}
      {isViewerModule && (
        <PopoverBaseMapVersions
          baseMap={mainBaseMap}
          anchorEl={versionsAnchorEl}
          onClose={() => setVersionsAnchorEl(null)}
        />
      )}
    </Box>
  );
}
