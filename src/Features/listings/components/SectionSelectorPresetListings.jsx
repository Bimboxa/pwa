import { useSelector } from "react-redux";

import useResolvedPresetListings from "../hooks/useResolvedPresetListings";

import { ListItemButton, Typography, List, Box } from "@mui/material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconListingVariantBasic from "./IconListingVariantBasic";
import { CheckBoxOutlineBlank, CheckBox } from "@mui/icons-material";

export default function SectionSelectorPresetListings({
  selectedKeys,
  onChange,
}) {
  // strings

  // data

  const presetListings = useResolvedPresetListings();

  // helpers

  const listings = presetListings.filter(
    (listing) => listing.entityModel?.type === "LOCATED_ENTITY"
  );

  // handlers

  function handleClick(e, key) {
    e.stopPropagation(e);
    let selection = selectedKeys ? [...selectedKeys] : [];
    if (selection?.includes(key)) {
      selection = selection.filter((k) => k !== key);
    } else {
      selection.push(key);
    }
    onChange(selection);
  }

  function handleCheckboxChange(e, listingKey) {
    console.log("e", e);
  }

  return (
    <BoxFlexVStretch>
      <List dense>
        {listings.map((listing) => {
          const checked = Boolean(selectedKeys?.includes(listing.key));
          return (
            <ListItemButton
              key={listing.key}
              sx={{ p: 0 }}
              onClick={(e) => handleClick(e, listing.key)}
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
                  <Typography sx={{ ml: 1 }}>{listing.name}</Typography>
                </Box>
                <Box color="secondary.main">
                  {checked ? <CheckBox /> : <CheckBoxOutlineBlank />}
                </Box>
              </Box>
            </ListItemButton>
          );
        })}
      </List>
    </BoxFlexVStretch>
  );
}
