import { useSelector } from "react-redux";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";
import useSelectedScope from "Features/scopes/hooks/useSelectedScope";

import { ListItemButton, Typography, List, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconListingVariantBasic from "./IconListingVariantBasic";
import { CheckBoxOutlineBlank, CheckBox } from "@mui/icons-material";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

export default function SectionSelectorPresetListings({
  selectedKeys,
  onChange,
}) {
  // strings

  const comingSoonS = "Bientôt disponible";

  // data

  const presetListings = useResolvedPresetListings();
  const appConfig = useAppConfig();
  const { value: scope } = useSelectedScope();

  // helpers

  let keys = [];
  const presetScope = appConfig?.presetScopesObject?.[scope?.presetScopeKey];
  if (presetScope) keys = presetScope.listings;

  // helpers

  const listings = presetListings.filter(
    (listing) =>
      listing.entityModel?.type === "LOCATED_ENTITY" &&
      keys.includes(listing.key)
  );

  console.log("debug_2409_listings", listings, keys);

  // handlers

  function handleClick(e, listing) {
    e.stopPropagation(e);

    if (listing.comingSoon) return;

    const key = listing.key;
    let selection = selectedKeys ? [...selectedKeys] : [];
    if (selection?.includes(key)) {
      selection = selection.filter((k) => k !== key);
    } else {
      selection.push(key);
    }
    onChange(selection);
  }

  return (
    <BoxFlexVStretch>
      <List dense>
        {listings.map((listing) => {
          const checked = Boolean(selectedKeys?.includes(listing.key));
          return (
            <ListItemButton
              key={listing.key}
              sx={{ p: 0, display: "flex", flexDirection: "column" }}
              onClick={(e) => handleClick(e, listing)}
              divider
            >
              <Box
                sx={{
                  width: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 0.5,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center" }}>
                  <IconListingVariantBasic listing={listing} />
                  <Typography sx={{ ml: 1, fontWeight: "bold" }}>
                    {listing.name}
                  </Typography>
                </Box>
                {!listing.comingSoon && (
                  <Box
                    color="secondary.main"
                    sx={{ display: "flex", alignItems: "center", mr: 1 }}
                  >
                    {checked ? <CheckBox /> : <CheckBoxOutlineBlank />}
                  </Box>
                )}
                {listing.comingSoon && (
                  <Typography
                    variant="caption"
                    color="secondary"
                    sx={{ fontWeight: "bold" }}
                  >
                    {comingSoonS}
                  </Typography>
                )}
              </Box>
              {listing?.description && (
                <Box sx={{ width: 1, p: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {listing?.description}
                  </Typography>
                </Box>
              )}
            </ListItemButton>
          );
        })}
      </List>
    </BoxFlexVStretch>
  );
}
