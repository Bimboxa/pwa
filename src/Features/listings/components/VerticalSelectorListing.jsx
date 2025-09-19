import { useSelector, useDispatch } from "react-redux";

import { setSelectedListingId } from "../listingsSlice";

import useListingsByScope from "../hooks/useListingsByScope";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import { ArrowForwardIos } from "@mui/icons-material";
import { grey } from "@mui/material/colors";
import theme from "Styles/theme";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconListingVariantSelectable from "./IconListingVariantSelectable";

export default function VerticalSelectorListing({ onSeeAllClick }) {
  const dispatch = useDispatch();

  // strings

  const seeAllS = "Voir tous les modules";

  const pinnedS = "Modules favoris";

  // data

  const { value: listings } = useListingsByScope();
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );

  // handlers

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
  }

  // render

  if (onboardingIsActive)
    return (
      <Box
        sx={{
          bgcolor: "primary.main",
          display: "flex",
          flexDirection: "column",
          width: 1,
        }}
      />
    );

  return (
    <Box
      sx={{
        bgcolor: "primary.main",
        display: "flex",
        flexDirection: "column",

        pt: 1,
        alignItems: "center",
      }}
    >
      <Tooltip title={seeAllS} placement="right">
        <IconButton sx={{ color: "grey.500", py: 1 }} onClick={onSeeAllClick}>
          <ArrowForwardIos />
        </IconButton>
      </Tooltip>

      <Box sx={{ borderBottom: `1px solid ${grey[500]}`, width: 1, my: 1 }} />

      <Box sx={{ display: "flex", alignItems: "center", py: 1 }}>
        <Typography sx={{ fontSize: 10 }} align="center" color="grey.300">
          {pinnedS}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column" }}>
        {listings.map((listing) => {
          const selected = listing.id === selectedListingId;
          return (
            <IconListingVariantSelectable
              key={listing.id}
              listing={listing}
              selected={selected}
              onClick={() => handleListingClick(listing)}
              bgcolor={theme.palette.background.default}
            />
          );
        })}
      </Box>
    </Box>
  );
}
