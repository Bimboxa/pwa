import { useMemo } from "react";
import { useSelector } from "react-redux";

import { Box, Button, Paper, Typography } from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useListingItemsCountById from "Features/listings/hooks/useListingItemsCountById";
import useListingGroupsWithIcons from "../hooks/useListingGroupsWithIcons";

import { ChipScopeStat } from "Features/dashboard/components/ChipsScopeStats";
import ListingFamilyAvatar from "./ListingFamilyAvatar";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";
import getAnnotationListingsCount from "../utils/getAnnotationListingsCount";

// Folded state of the SCOPE module's floating listing selector, shown at the
// top left of the recap editor when the left panel is folded
// (leftPanelDocked false). Folded, the panel only slides back on hover of
// the module band or the breadcrumbs — so nothing said which listing drove
// the editor, and there was no explicit way to change it. The button recaps
// the selected listing's row — the scope content title above, then family
// mark, name, items count chip — and `onExpand` asks the parent
// (MainListingViewer) to swap it for the unfolded panel
// (PanelSelectorListingFloating), so both entry points stay the same list.
//
// `listing` null is the "Afficher toutes les listes" mode of the panel: the
// button then recaps that row — annotation family icon, "Toutes les listes",
// total of the scope's annotations.
export default function ButtonSelectorListingInViewer({ listing, onExpand }) {
  // data

  const appConfig = useAppConfig();
  const entityModelTypes = appConfig?.features?.entityModelTypes;
  const showAllListings = !listing;

  // strings

  // Scope content title ("Contenu du Krto" / "Contenu du dossier"), the same
  // key as the panel header (SelectorListingForViewer).
  const titleS =
    appConfig?.strings?.scope?.contentTitle ?? "Contenu du dossier";
  const allListingsS = "Toutes les listes";

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  // Scope listings, for the all-listings total only (the hook is cheap, the
  // count query below is bounded to the listings handed to it).
  const { value: scopeListings } = useListingsByScope({
    filterByProjectId: projectId,
  });

  // Family of the selected listing, resolved the way the panel resolves its
  // groups (so a business object listing gets its module icon too). In
  // all-listings mode, the annotation listings family — the group the row
  // belongs to — through a synthetic group, so the icon is the same source.
  const rawGroups = useMemo(() => {
    if (listing) {
      return getListingGroupsByEntityModelType({
        listings: [listing],
        entityModelTypes,
      });
    }
    return [{ key: "LOCATED_ENTITY", type: "LOCATED_ENTITY", listings: [] }];
  }, [listing, entityModelTypes]);
  const groups = useListingGroupsWithIcons(rawGroups);
  const family = groups[0] ?? null;

  const listingsToCount = useMemo(() => {
    if (listing) return [listing];
    return (scopeListings ?? []).filter(
      (l) => l?.entityModel?.type === "LOCATED_ENTITY" && !l.isForBaseMaps
    );
  }, [listing, scopeListings]);
  const itemsCountById = useListingItemsCountById(listingsToCount);
  const itemsCount = listing
    ? (itemsCountById[listing.id] ?? 0)
    : getAnnotationListingsCount(listingsToCount, itemsCountById);

  // helpers

  const label = listing?.name ?? allListingsS;

  // render

  return (
    <Paper
      elevation={2}
      sx={{
        maxWidth: 320,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "panel.border",
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      <Button
        onClick={onExpand}
        endIcon={<ArrowDropDown />}
        sx={{
          maxWidth: 1,
          minWidth: 0,
          px: 1.5,
          py: 0.75,
          textTransform: "none",
          color: "text.primary",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            minWidth: 0,
          }}
        >
          <Typography
            variant="caption"
            noWrap
            sx={{
              maxWidth: 1,
              color: "panel.textLight",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              lineHeight: 1.2,
              fontWeight: 600,
            }}
          >
            {titleS}
          </Typography>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
              maxWidth: 1,
            }}
          >
            <ListingFamilyAvatar
              listing={listing}
              familyType={showAllListings ? null : family?.type}
              familyIcon={family?.icon}
            />
            {/* A flex item defaults to min-width:auto — without minWidth 0 the
                name would push past the Paper instead of ellipsizing, and
                shove the chip and the arrow out of view. */}
            <Typography
              variant="button"
              noWrap
              sx={{ minWidth: 0, fontWeight: 600 }}
            >
              {label}
            </Typography>
            <ChipScopeStat
              icon={family?.icon ?? undefined}
              label={itemsCount}
            />
          </Box>
        </Box>
      </Button>
    </Paper>
  );
}
