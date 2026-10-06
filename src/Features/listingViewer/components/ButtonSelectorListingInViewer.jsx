import { useMemo, useState } from "react";

import { Box, Button, Paper, Popover, Typography } from "@mui/material";
import { ArrowDropDown } from "@mui/icons-material";

import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useListingItemsCountById from "Features/listings/hooks/useListingItemsCountById";
import useListingGroupsWithIcons from "../hooks/useListingGroupsWithIcons";

import { ChipScopeStat } from "Features/dashboard/components/ChipsScopeStats";
import ListingFamilyAvatar from "./ListingFamilyAvatar";
import SelectorListingForViewer from "./SelectorListingForViewer";

import getListingGroupsByEntityModelType from "Features/listings/utils/getListingGroupsByEntityModelType";

// Floating listing selector of the SCOPE module, shown at the top left of the
// recap editor when the left panel is folded (leftPanelDocked false). Folded,
// the panel only slides back on hover of the module band or the breadcrumbs —
// so nothing said which listing drove the editor, and there was no explicit
// way to change it. The button recaps the selected listing's row — family
// mark, name, items count chip — and opens the very content of the docked
// panel (SelectorListingForViewer), so both entry points stay the same list.
//
// A Popover, not a Popper + ClickAwayListener: the panel mounts the family
// creation dialogs as its own children, and a ClickAwayListener would close
// the popper — unmounting the dialog with it — on the first click inside it.
export default function ButtonSelectorListingInViewer({ listing }) {
  // strings

  // No selection means the editor shows every base map and the totals of the
  // whole scope, not an empty state.
  const allListingsS = "Toutes les listes";

  // data

  const appConfig = useAppConfig();
  const entityModelTypes = appConfig?.features?.entityModelTypes;

  // Family of the selected listing, resolved the way the panel resolves its
  // groups (so a business object listing gets its module icon too).
  const rawGroups = useMemo(
    () =>
      listing
        ? getListingGroupsByEntityModelType({
            listings: [listing],
            entityModelTypes,
          })
        : [],
    [listing, entityModelTypes]
  );
  const groups = useListingGroupsWithIcons(rawGroups);
  const family = groups[0] ?? null;

  const listingsToCount = useMemo(() => (listing ? [listing] : []), [listing]);
  const itemsCountById = useListingItemsCountById(listingsToCount);
  const itemsCount = listing ? (itemsCountById[listing.id] ?? 0) : null;

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const open = Boolean(anchorEl);
  const label = listing?.name ?? allListingsS;

  // handlers

  function handleClick(e) {
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  // render

  return (
    <>
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
          onClick={handleClick}
          endIcon={<ArrowDropDown />}
          sx={{
            maxWidth: 1,
            minWidth: 0,
            px: 1.5,
            textTransform: "none",
            color: "text.primary",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              minWidth: 0,
            }}
          >
            {listing && (
              <ListingFamilyAvatar
                listing={listing}
                familyType={family?.type}
                familyIcon={family?.icon}
              />
            )}
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
            {listing && (
              <ChipScopeStat
                icon={family?.icon ?? undefined}
                label={itemsCount}
              />
            )}
          </Box>
        </Button>
      </Paper>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        // The creation dialogs open on top of the popover; letting them own the
        // focus keeps the two focus traps from fighting.
        disableEnforceFocus
        slotProps={{
          paper: {
            sx: {
              // Same width as the docked panel (MainListingViewer panelWidth):
              // the menu reads as that panel, floated.
              width: 300,
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              borderRadius: 2,
              border: "1px solid",
              borderColor: "panel.border",
              mt: 0.5,
            },
          },
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <SelectorListingForViewer
            selectedListingId={listing?.id ?? null}
            onListingSelected={handleClose}
          />
        </Box>
      </Popover>
    </>
  );
}
