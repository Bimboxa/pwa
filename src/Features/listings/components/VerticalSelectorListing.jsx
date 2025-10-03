import { useSelector, useDispatch } from "react-redux";

import { setSelectedListingId, setHiddenListingsIds } from "../listingsSlice";
import useListingsByScope from "../hooks/useListingsByScope";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";

import { Box, IconButton, Tooltip, Typography } from "@mui/material";
import {
  ArrowForwardIos,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { grey } from "@mui/material/colors";
import theme from "Styles/theme";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconListingVariantSelectable from "./IconListingVariantSelectable";

import getModulesAndListingsForLeftPanel from "../utils/getModulesAndListingsForLeftPanel";

export default function VerticalSelectorListing({ onSeeAllClick }) {
  const dispatch = useDispatch();

  const seeAllS = "Voir les listes";
  const pinnedS = "Listes";

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  const { value: listings } = useListingsByScope({
    filterByProjectId: projectId ?? null,
  });
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );
  const appConfig = useAppConfig();
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const entityModelTypes = appConfig?.features?.entityModelTypes;
  const items = getModulesAndListingsForLeftPanel({
    listings,
    entityModelTypes,
  });

  function handleListingClick(listing) {
    dispatch(setSelectedListingId(listing.id));
  }

  function toggleListingVisibility(id) {
    const isHidden = hiddenListingsIds.includes(id);
    const next = isHidden
      ? hiddenListingsIds.filter((x) => x !== id)
      : [...hiddenListingsIds, id];
    dispatch(setHiddenListingsIds(next));
  }

  if (onboardingIsActive)
    return (
      <Box
        sx={{
          bgcolor: "primary.main",
          display: "flex",
          flexDirection: "column",
          width: 1,
          flexGrow: 1,
        }}
      />
    );

  return (
    <Box
      sx={{
        bgcolor: "primary.main",
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        pt: 1,
        alignItems: "center",
        minHeight: 0,
      }}
    >
      <Tooltip title={seeAllS} placement="right">
        <IconButton sx={{ color: "grey.500", py: 1 }} onClick={onSeeAllClick}>
          <ArrowForwardIos />
        </IconButton>
      </Tooltip>

      <Box sx={{ borderBottom: `1px solid ${grey[500]}`, width: 1, my: 1 }} />

      <Box
        sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        {items.map((item) => {
          const selected = item?.listing?.id === selectedListingId;
          const id = item?.listing?.id;
          const hidden = id ? hiddenListingsIds.includes(id) : false;
          const showHideButton = item?.showHideButton;

          if (item.type === "ENTITY_MODEL_TYPE") {
            return (
              <Box
                key={item?.entityModelType?.type}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  mt: 1,
                  py: 1,
                }}
              >
                <Typography
                  sx={{ fontSize: 10 }}
                  align="center"
                  color="grey.300"
                >
                  {item?.entityModelType?.name}
                </Typography>
              </Box>
            );
          }

          if (item.type === "LISTING") {
            return (
              <Box
                key={id}
                // Inline-block wrapper so it doesn't affect child centering/size
                sx={{
                  position: "relative",
                  display: "inline-block",
                  // show helper only on hover
                  "&:hover .vis-btn": { opacity: 1, pointerEvents: "auto" },
                }}
              >
                {/* Listing tile (unchanged layout, stays centered by the parent column) */}
                <Box
                  sx={
                    {
                      //transition: "opacity 120ms ease, filter 120ms ease",
                      //opacity: hidden ? 0.6 : 1,
                      //filter: hidden ? "grayscale(0.6)" : "none",
                    }
                  }
                >
                  <IconListingVariantSelectable
                    listing={item.listing}
                    selected={selected}
                    hidden={hidden}
                    onClick={() => handleListingClick(item.listing)}
                  />
                </Box>

                {/* Visibility helper overlay (absolute; no layout impact) */}
                {showHideButton && (
                  <IconButton
                    className="vis-btn"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleListingVisibility(id);
                    }}
                    sx={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      zIndex: 3,
                      bgcolor: "rgba(255,255,255,0.9)",
                      border: "1px solid",
                      borderColor: "divider",
                      boxShadow: 1,
                      opacity: 0,
                      pointerEvents: "none", // disabled until hover via wrapper rule
                      transition: "opacity 120ms ease",
                      "&:hover": { bgcolor: "background.paper" },
                    }}
                  >
                    {hidden ? (
                      <VisibilityOff fontSize="inherit" />
                    ) : (
                      <Visibility fontSize="inherit" />
                    )}
                  </IconButton>
                )}
              </Box>
            );
          }

          return null;
        })}
      </Box>
    </Box>
  );
}
