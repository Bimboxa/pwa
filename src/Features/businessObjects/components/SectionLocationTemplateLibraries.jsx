import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import {
  Box,
  Divider,
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

import IconListingVariantBasic from "Features/listings/components/IconListingVariantBasic";
import useListings from "Features/listings/hooks/useListings";
import useLinkedListings from "Features/listings/hooks/useLinkedListings";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import db from "App/db/db";

import getLocationTemplateListingIds from "../utils/getLocationTemplateListingIds";

// « Bibliothèques » block of the « Modèles de localisation » card of a located
// business-objects listing: the annotation listings of the scope whose
// templates locate the objects too (listing.locationTemplateListingIds), next
// to the listing's own templates. The "+" menu lists the candidates — the
// scope's LOCATED_ENTITY listings not added yet, minus the listings linked
// from another Krto (read-only there: nothing can be drawn into them) — and
// the cross of a row removes one. The drawn annotation stays in its library
// listing; only the main rel points at the object.
export default function SectionLocationTemplateLibraries({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Bibliothèques";
  const captionS =
    "Listes d'annotations du scope dont les modèles localisent aussi les ouvrages. L'annotation dessinée reste dans sa liste et porte le nom de l'ouvrage.";
  const addS = "Ajouter une bibliothèque";
  const removeS = "Retirer la bibliothèque";
  const emptyS = "Aucune bibliothèque.";
  const noCandidateS = "Toutes les listes sont ajoutées.";
  const noListingS = "Aucune liste d'annotations dans ce scope.";

  // data

  const { value: scopeListings } = useListings({
    filterByScopeId: listing?.scopeId,
    filterByEntityModelType: "LOCATED_ENTITY",
  });
  const { isLinkedListing } = useLinkedListings();
  const listingsById = useSelector((s) => s.listings.listingsById);
  const { guardEditRecord } = useCanEditRecord();

  // state

  const [anchorEl, setAnchorEl] = useState(null);

  // helpers

  const libraryIds = useMemo(
    () => getLocationTemplateListingIds(listing, listingsById),
    [listing, listingsById]
  );
  const libraries = useMemo(
    () => libraryIds.map((id) => listingsById?.[id]).filter(Boolean),
    [libraryIds, listingsById]
  );
  const candidateListings = useMemo(
    () =>
      (scopeListings ?? []).filter(
        (l) =>
          l.id !== listing?.id &&
          !libraryIds.includes(l.id) &&
          !isLinkedListing(l.id)
      ),
    [scopeListings, listing?.id, libraryIds, isLinkedListing]
  );
  const emptyCandidateS = scopeListings?.length ? noCandidateS : noListingS;

  // handlers

  async function writeLibraryIds(nextIds) {
    if (!listing?.id || !guardEditRecord(listing)) return;
    await db.listings.update(listing.id, {
      locationTemplateListingIds: nextIds,
    });
    dispatch(triggerListingsUpdate());
  }

  function handleAdd(library) {
    setAnchorEl(null);
    // the stored array is rewritten from the filtered one: dangling ids
    // (deleted / unlinked listings) are dropped on the way
    writeLibraryIds([...libraryIds, library.id]);
  }

  function handleRemove(library) {
    writeLibraryIds(libraryIds.filter((id) => id !== library.id));
  }

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <Divider sx={{ my: 1 }} />
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

      {libraries.length === 0 ? (
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 1, color: "text.disabled" }}
        >
          {emptyS}
        </Typography>
      ) : (
        <List dense disablePadding sx={{ mx: -1, mt: 0.5 }}>
          {libraries.map((library) => (
            <ListItem
              key={library.id}
              sx={{ py: 0.25, pl: 1 }}
              secondaryAction={
                <Tooltip title={removeS}>
                  <IconButton
                    size="small"
                    edge="end"
                    onClick={() => handleRemove(library)}
                  >
                    <Close sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              }
            >
              <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                <IconListingVariantBasic listing={library} />
              </Box>
              <ListItemText
                primary={library.name || "Sans nom"}
                slotProps={{ primary: { variant: "body2", noWrap: true } }}
              />
            </ListItem>
          ))}
        </List>
      )}

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
          candidateListings.map((l) => (
            <MenuItem key={l.id} onClick={() => handleAdd(l)}>
              <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                <IconListingVariantBasic listing={l} />
              </Box>
              <Typography variant="body2" noWrap>
                {l.name || "Sans nom"}
              </Typography>
            </MenuItem>
          ))
        )}
      </Menu>
    </Box>
  );
}
