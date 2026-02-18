import { useSelector, useDispatch } from "react-redux";

import { useDndMonitor, useDroppable } from "@dnd-kit/core";

import {
  setSelectedListingId,
  setHiddenListingsIds,
  setOpenedPanel,
} from "../listingsSlice";
import useListingsByScope from "../hooks/useListingsByScope";
import useListings from "../hooks/useListings";
import useAppConfig from "Features/appConfig/hooks/useAppConfig";
import useMoveAnnotationTemplateToListing from "Features/annotations/hooks/useMoveAnnotationTemplateToListing";

import { Box, IconButton, Tooltip, Typography, keyframes } from "@mui/material";
import {
  ArrowForwardIos,
  MoreHoriz,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import { grey } from "@mui/material/colors";
import theme from "Styles/theme";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import IconListingVariantSelectable from "./IconListingVariantSelectable";
import IconButtonOpenBaseMapDetail from "Features/baseMaps/components/IconButtonOpenBaseMapDetail";

import getModulesAndListingsForLeftPanel from "../utils/getModulesAndListingsForLeftPanel";
import ButtonDialogCreateListingInVerticalSelector from "./ButtonDialogCreateListingInVerticalSelector";
import { setShowBgImageInMapEditor } from "Features/bgImage/bgImageSlice";

// Animation keyframes for drop target
const pulseAnimation = keyframes`
  0%, 100% {
    transform: scale(1.15);
  }
  50% {
    transform: scale(1.25);
  }
`;

// Droppable component for listing item
function DroppableListingItem({
  listing,
  children,
  selected,
  hidden,
  showHideButton,
  onListingClick,
  onToggleVisibility,
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `listing-${listing.id}`,
    data: {
      type: "listing",
      listingId: listing.id,
    },
  });

  return (
    <Box
      ref={setNodeRef}
      // Inline-block wrapper so it doesn't affect child centering/size
      sx={{
        position: "relative",
        display: "inline-block",
        mb: 1,
        // show helper only on hover
        "&:hover .vis-btn": { opacity: 1, pointerEvents: "auto" },
        bgcolor: isOver ? "action.hover" : "transparent",
        borderRadius: 1,
        transition: isOver ? "none" : "all 0.3s ease-in-out",
        transform: isOver ? undefined : "scale(1)",
        zIndex: isOver ? 10 : "auto",
        boxShadow: isOver ? 3 : 0,
        ...(isOver && {
          animation: `${pulseAnimation} 0.8s ease-in-out infinite`,
        }),
      }}
    >
      {children}
    </Box>
  );
}

export default function VerticalSelectorListing({ onSeeAllClick }) {
  const dispatch = useDispatch();

  const seeAllS = "Voir les listes";
  const pinnedS = "Listes";
  const newListingS = "Nouvelle liste";
  const titleS = "Créer une liste d'objets";

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const showBgImage = useSelector((s) => s.bgImage.showBgImageInMapEditor);

  const moveAnnotationTemplateToListing = useMoveAnnotationTemplateToListing();

  const listings = useListings({
    filterByProjectId: projectId ?? null,
    filterByScopeId: scopeId,
    //includeListingsWithoutScope: true
  });
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);
  console.log("debug_1610_selectedListingId", selectedListingId);
  const onboardingIsActive = useSelector(
    (s) => s.onboarding.onboardingIsActive
  );
  const appConfig = useAppConfig();
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );

  const entityModelTypes = appConfig?.features?.entityModelTypes;

  // Handle drag and drop
  useDndMonitor({
    onDragEnd(event) {
      const { active, over } = event;

      if (!over || !active) return;

      // Check if we're dragging an annotation template
      const activeData = active.data.current;
      const overData = over.data.current;

      if (
        activeData?.type === "annotationTemplate" &&
        overData?.type === "listing" &&
        activeData?.annotationTemplateId &&
        overData?.listingId
      ) {
        // Prevent dropping on the same listing (will be handled in the hook, but we can check here too)
        moveAnnotationTemplateToListing(
          activeData.annotationTemplateId,
          overData.listingId
        ).catch((error) => {
          console.error("Error moving annotation template to listing:", error);
        });
      }
    },
  });

  let items = getModulesAndListingsForLeftPanel({
    listings,
    entityModelTypes,
  });

  items = [
    // {
    //   type: "ENTITY_MODEL_TYPE",
    //   entityModelType: { name: "Gabarit", type: "BACKGROUND" },
    // },
    // {
    //   type: "LISTING",
    //   listing: {
    //     id: "bgImageFormat",
    //     iconKey: "background",
    //     color: theme.palette.secondary.light,
    //   },
    //   showHideButton: true,
    // },
    ...items,
  ];

  function handleListingClick(listing) {
    if (listing.id === "bgImageFormat") {
      dispatch(setOpenedPanel("BG_IMAGE_FORMAT"));
    } else {
      dispatch(setOpenedPanel("LISTING"));
    }
    dispatch(setSelectedListingId(listing.id));
  }

  function toggleListingVisibility(id) {
    if (id !== "bgImageFormat") {
      const isHidden = hiddenListingsIds.includes(id);
      const next = isHidden
        ? hiddenListingsIds.filter((x) => x !== id)
        : [...hiddenListingsIds, id];
      dispatch(setHiddenListingsIds(next));
    } else {
      dispatch(setShowBgImageInMapEditor(!showBgImage));
    }
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
        pb: 2,
        alignItems: "center",
        minHeight: 0,
      }}
    >
      {/* <Box sx={{ borderBottom: `1px solid ${grey[500]}`, width: 1, my: 1 }} /> */}

      {/* <IconButtonOpenBaseMapDetail /> */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flex: 1,
          pt: 1,
        }}
      >
        {items.map((item, idx) => {
          const selected = item?.listing?.id === selectedListingId;
          const id = item?.listing?.id;
          let hidden = id ? hiddenListingsIds.includes(id) : false;
          if (id === "bgImageFormat") hidden = !showBgImage;
          const showHideButton = item?.showHideButton;

          // if (item.type === "ENTITY_MODEL_TYPE") {
          //   return (
          //     <Box
          //       key={`entity-model-type-${idx}`}
          //       sx={{
          //         display: "flex",
          //         alignItems: "center",
          //         justifyContent: "center",
          //         mt: 1,
          //         py: 1,
          //       }}
          //     >
          //       <Typography
          //         sx={{ fontSize: "10px !important" }}
          //         align="center"
          //         //color="grey.300"
          //         color="white"
          //       >
          //         {item?.entityModelType?.name}
          //       </Typography>
          //     </Box>
          //   );
          // }

          if (item.type === "LISTING") {
            return (
              <DroppableListingItem
                key={id}
                listing={item.listing}
                selected={selected}
                hidden={hidden}
                showHideButton={showHideButton}
                onListingClick={() => handleListingClick(item.listing)}
                onToggleVisibility={() => toggleListingVisibility(id)}
              >
                {/* Listing tile (unchanged layout, stays centered by the parent column) */}
                <Box
                  sx={
                    {
                      display: "flex", aligntItems: "center", flexDirection: "column"
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
                  <Typography align="center" variant="caption" sx={{ color: "grey.300" }}>{item?.listing?.name}</Typography>
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
              </DroppableListingItem>
            );
          }

          if (item.type === "CREATE_LOCATED_LISTING") {
            return (
              <Box
                key="create-located-listing"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  my: 2,
                }}
              >
                <Tooltip title={titleS} placement="right">
                  <Box>
                    <ButtonDialogCreateListingInVerticalSelector />
                  </Box>
                </Tooltip>
              </Box>
            );
          }

          return null;
        })}
      </Box>
      <Tooltip title={seeAllS} placement="right">
        <IconButton sx={{ color: "grey.500", py: 1 }} onClick={onSeeAllClick}>
          <MoreHoriz />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
