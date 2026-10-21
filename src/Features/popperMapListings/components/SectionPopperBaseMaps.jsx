import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setBaseMapsPanelExpanded } from "../popperMapListingsSlice";

import { Box, Tooltip, Typography } from "@mui/material";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

import SectionBaseMapsList from "Features/baseMaps/components/SectionBaseMapsList";
import IconButtonToggleDetached from "./IconButtonToggleDetached";

import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import { isLegacyStyleRevolutionHelper } from "Features/annotations/constants/drawingShapeConfig";
import { isTemplatelessAnnotationInScope } from "Features/annotations/utils/templatelessAnnotations";
import bandButtonSx from "../utils/bandButtonSx";

// ---------------------------------------------------------------------------
// SectionPopperBaseMaps — « X annotations sur N fonds de plan » block of the
// Dessin popper, pinned at the very bottom under « Annotations sans
// modèle »:
// 1. the header (N = base maps whose annotations the editor displays —
//    main eye, 2D overlay badges, 3D display modes — among those carrying
//    at least one counted annotation, X = their annotations; so the counts
//    below are computed even while collapsed): the detach icon of the list
//    (PopperBaseMapsList) and the expand / collapse button of the base maps
//    panel — collapsed by default;
// 2. the base maps list (SectionBaseMapsList, the very panel the former
//    "Fonds de plan" tab of the header toggle showed, without its
//    "Visibilité auto" row: selecting a base map here always hides the
//    others' image and annotations), capped in height so a long list never
//    pushes
//    the listings and templates out of sight. Its counts are aligned on the
//    listing counters above: per base map, the annotations of the listings
//    displayed AND visible in the popper (hidden listings and eye-hidden
//    templates excluded) plus the templateless ones of the scope — computed
//    here, scope-wide. (The top bar badge keeps the whole count of the base
//    map, see useAnnotationsCountByBaseMapId.)
// Replaces the "Fonds de plan" side of the header toggle in the poppers
// that show the listings block; the legend poppers keep their tab. While
// the list is detached the section is gone altogether (re-attach from the
// detached popper's footer, which also expands the section).
// The expanded state lives in redux (popperMapListings.baseMapsPanelExpanded)
// so it survives the popper remount between the 2D and 3D editors.
// ---------------------------------------------------------------------------

const PANEL_MAX_HEIGHT = 240;

export default function SectionPopperBaseMaps({
  // Ids of the listings displayed in the popper (their counters above).
  listingIds,
  // Ids of the base maps whose annotations the displayed editor shows.
  displayedBaseMapIds,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = (x, n) =>
    `${x} annotation${x > 1 ? "s" : ""} sur ${n} fond${n > 1 ? "s" : ""} de plan`;
  const expandS = "Déplier les fonds de plan";
  const collapseS = "Replier les fonds de plan";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const expanded = useSelector(
    (s) => s.popperMapListings.baseMapsPanelExpanded
  );
  const detached = useSelector((s) => s.popperMapListings.baseMapsListDetached);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  // Scope-wide annotations set, same filters as the popper's counters
  // (allAnnotations of PopperMapListings) without the main base map one.
  // Also feeds the header's counts, hence fetched while collapsed.
  const scopeAnnotations = useAnnotationsV2({
    caller: "SectionPopperBaseMaps",
    enabled: !detached,
    filterBySelectedScope: true,
    hideBaseMapAnnotations: true,
    ignoreSolo: true,
  });
  const listingIdsKey = (listingIds ?? []).join("|");
  const hiddenListingIdsKey = hiddenListingsIds.join("|");
  const countByBaseMapId = useMemo(() => {
    const hiddenSet = new Set(
      hiddenListingIdsKey ? hiddenListingIdsKey.split("|") : []
    );
    const listingIdSet = new Set(
      (listingIdsKey ? listingIdsKey.split("|") : []).filter(
        (id) => !hiddenSet.has(id)
      )
    );
    const counts = {};
    (scopeAnnotations ?? []).forEach((a) => {
      if (!a.baseMapId || isLegacyStyleRevolutionHelper(a)) return;
      const counted = a.listingId
        ? listingIdSet.has(a.listingId)
        : isTemplatelessAnnotationInScope(a, selectedScopeId);
      if (counted) counts[a.baseMapId] = (counts[a.baseMapId] ?? 0) + 1;
    });
    return counts;
  }, [scopeAnnotations, listingIdsKey, hiddenListingIdsKey, selectedScopeId]);
  const displayedCounts = (displayedBaseMapIds ?? []).map(
    (id) => countByBaseMapId[id] ?? 0
  );
  const displayedBaseMapsCount = displayedCounts.filter((n) => n > 0).length;
  const displayedAnnotationsCount = displayedCounts.reduce((a, n) => a + n, 0);

  // handlers

  const handleToggleExpanded = () => {
    dispatch(setBaseMapsPanelExpanded(!expanded));
  };

  // render

  // Detached: the list lives in PopperBaseMapsList, nothing to show here.
  if (detached) return null;

  return (
    <Box>
      {/* Header: title, then the detach icon and the expand / collapse
          button. */}
      <Box
        onClick={handleToggleExpanded}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pl: 1.5,
          pr: 1,
          py: 0.5,
          cursor: "pointer",
          userSelect: "none",
          // Pinned at the bottom of the popper: the border is on top, and
          // under the header only while the list is expanded.
          borderTop: "1px solid",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "panel.border",
          // Same tinted block as the "Listes d'annotations" header.
          bgcolor: "background.default",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Typography
          variant="caption"
          noWrap
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 600,
            color: "panel.textMuted",
          }}
        >
          {titleS(displayedAnnotationsCount, displayedBaseMapsCount)}
        </Typography>

        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
        >
          <IconButtonToggleDetached />
        </Box>

        <Tooltip title={expanded ? collapseS : expandS} arrow placement="top">
          <Box
            component="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpanded();
            }}
            sx={bandButtonSx}
          >
            {expanded ? (
              <ExpandLess sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMore sx={{ fontSize: 18 }} />
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Base maps panel, under the header — white like the templates list
          (the header alone is tinted). */}
      {expanded && (
        <Box
          sx={{
            maxHeight: PANEL_MAX_HEIGHT,
            overflow: "auto",
            bgcolor: "background.paper",
          }}
        >
          <SectionBaseMapsList
            countByBaseMapIdOverride={countByBaseMapId}
            hideAutoVisibility
            forceAutoVisibility
            disableDrag
          />
        </Box>
      )}
    </Box>
  );
}
