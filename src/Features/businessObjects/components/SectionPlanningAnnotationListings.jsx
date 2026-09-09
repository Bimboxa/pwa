import { useMemo, useState } from "react";

import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from "@mui/material";
import { Add, Close } from "@mui/icons-material";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";
import useListingsByScope from "Features/listings/hooks/useListingsByScope";
import useUpdateListing from "Features/listings/hooks/useUpdateListing";

import isForPlanning from "../utils/isForPlanning";

// "Liste d'annotations" section of a PLANNING listing properties panel (type
// feature `annotationListings`): the drawing lists of the scope declared as
// feeding this planning (listing.isForPlanning). The "+" button lists the
// candidates — every scoped LOCATED_ENTITY listing not tagged yet, the same
// set as the MAP viewer popper — and one click tags it; the cross of a row
// untags it. Declarative only: nothing filters on the tag yet.
export default function SectionPlanningAnnotationListings() {
  // strings

  const titleS = "Liste d'annotations";
  const captionS =
    "Les listes de dessin qui alimentent ce planning. Information déclarative : les work packages et le calcul des heures voient toujours toutes les annotations.";
  const addS = "Ajouter une liste";
  const removeS = "Retirer la liste";
  const emptyS = "Aucune liste d'annotations.";
  const noCandidateS = "Toutes les listes sont ajoutées.";
  const noListingS = "Aucune liste d'annotations dans ce scope.";

  // data

  // same listing set as the MAP viewer's PopperMapListings: scoped
  // LOCATED_ENTITY listings, excluding the "isForBaseMaps" ones.
  const { value: listings } = useListingsByScope({
    filterByEntityModelType: "LOCATED_ENTITY",
    excludeIsForBaseMaps: true,
  });
  const updateListing = useUpdateListing();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const selectedListings = useMemo(
    () => (listings ?? []).filter(isForPlanning),
    [listings]
  );
  const candidateListings = useMemo(
    () => (listings ?? []).filter((l) => !isForPlanning(l)),
    [listings]
  );
  const emptyCandidateS = listings?.length ? noCandidateS : noListingS;

  // handlers

  function handleAdd(listing) {
    setAnchorEl(null);
    updateListing({ id: listing.id, isForPlanning: true });
  }

  function handleRemove(listing) {
    updateListing({ id: listing.id, isForPlanning: false });
  }

  // render

  return (
    <WhiteSectionGeneric>
      <Box sx={{ p: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
            {titleS}
          </Typography>
          <Tooltip title={addS}>
            <IconButton
              size="small"
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              <Add sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
        <Typography
          variant="caption"
          sx={{ display: "block", color: "text.secondary" }}
        >
          {captionS}
        </Typography>

        {selectedListings.length === 0 ? (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 1, color: "text.disabled" }}
          >
            {emptyS}
          </Typography>
        ) : (
          <List dense disablePadding sx={{ mx: -1, mt: 0.5 }}>
            {selectedListings.map((listing) => (
              <ListItem
                key={listing.id}
                sx={{ py: 0.25, pl: 1 }}
                secondaryAction={
                  <Tooltip title={removeS}>
                    <IconButton
                      size="small"
                      edge="end"
                      onClick={() => handleRemove(listing)}
                    >
                      <Close sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  <IconListingVariantBasic listing={listing} />
                </Box>
                <ListItemText
                  primary={listing.name || "Sans nom"}
                  slotProps={{ primary: { variant: "body2", noWrap: true } }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {candidateListings.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2">{emptyCandidateS}</Typography>
          </MenuItem>
        ) : (
          candidateListings.map((listing) => (
            <MenuItem key={listing.id} onClick={() => handleAdd(listing)}>
              <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                <IconListingVariantBasic listing={listing} />
              </Box>
              <Typography variant="body2" noWrap>
                {listing.name || "Sans nom"}
              </Typography>
            </MenuItem>
          ))
        )}
      </Menu>
    </WhiteSectionGeneric>
  );
}
