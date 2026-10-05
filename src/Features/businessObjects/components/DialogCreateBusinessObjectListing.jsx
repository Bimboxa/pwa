import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedListingId } from "../businessObjectsSlice";

import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";

import DialogPromptIaBusinessObjects from "./DialogPromptIaBusinessObjects";

import useCreateBusinessObjectListing from "../hooks/useCreateBusinessObjectListing";
import selectSelectedBusinessObjectTypeKey from "../utils/selectSelectedBusinessObjectTypeKey";
import BUSINESS_OBJECT_TYPES, {
  DEFAULT_BUSINESS_OBJECT_TYPE_KEY,
  getBusinessObjectType,
} from "../data/businessObjectTypesCatalog";

// Creation dialog of a business-object listing.
//
// The business object type of the new listing is implicit when the dialog is
// opened from a business-objects module (the module IS the type): the type
// selector only shows outside those modules — the listing viewer's empty
// state — where nothing else says which family the list belongs to. A caller
// may also pin the type with the `typeKey` prop. The "Localisation sur les
// plans" checkbox opts the listing into the main-location flow (off by
// default, see utils/canLocateBusinessObjects). "Prompt IA" opens the
// file-driven creation (DialogPromptIaBusinessObjects): the listing and its
// objects are then created together from an external AI chat's answer.
// Both follow the type's features: no location checkbox for the types
// without `locate`, no "Prompt IA" (a priced-articles prompt: codes, units,
// quantities) for the types without `quantities`.
export default function DialogCreateBusinessObjectListing({
  open,
  onClose,
  typeKey,
  onCreated,
}) {
  const dispatch = useDispatch();
  const createBusinessObjectListing = useCreateBusinessObjectListing();

  // strings

  const nameS = "Nom";
  const typeS = "Type de liste";
  const canLocateS = "Localisation sur les plans";
  const canLocateCaptionS =
    "Les objets pourront être localisés sur les plans (une annotation principale par plan).";
  const cancelS = "Annuler";
  const createS = "Créer";
  const promptIaS = "Prompt IA";

  // data

  const moduleTypeKey = useSelector(selectSelectedBusinessObjectTypeKey);

  // helpers — the type is fixed by the caller or by the selected module;
  // only a free type is selectable in the dialog.

  const fixedTypeKey = typeKey ?? moduleTypeKey ?? null;
  const showTypeSelector = !fixedTypeKey && BUSINESS_OBJECT_TYPES.length > 1;

  // state

  const [name, setName] = useState("");
  const [selectedTypeKey, setSelectedTypeKey] = useState(
    DEFAULT_BUSINESS_OBJECT_TYPE_KEY
  );
  const [canLocate, setCanLocate] = useState(null);
  const [openPromptIa, setOpenPromptIa] = useState(false);

  // helpers

  const createdTypeKey = fixedTypeKey ?? selectedTypeKey;
  const createdType =
    getBusinessObjectType(createdTypeKey) ??
    getBusinessObjectType(DEFAULT_BUSINESS_OBJECT_TYPE_KEY);
  const hasLocate = Boolean(createdType.features.locate);
  const hasPromptIa = Boolean(createdType.features.quantities);
  // A pinned type names the family in the title; a free one lets the
  // selector say it.
  const titleS = showTypeSelector
    ? "Nouvelle liste"
    : `Nouvelle ${createdType.strings.listLabel.toLowerCase()}`;
  const canLocateBusinessObjects =
    hasLocate && (canLocate ?? Boolean(createdType.features.locateByDefault));

  // handlers

  async function handleCreate() {
    const listing = await createBusinessObjectListing({
      name,
      typeKey: createdTypeKey,
      canLocateBusinessObjects,
    });
    if (listing) {
      dispatch(setSelectedListingId(listing.id));
      onCreated?.(listing);
    }
    onClose();
  }

  // render

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>{titleS}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label={nameS}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name) handleCreate();
            }}
            sx={{ mt: 1 }}
          />
          {hasLocate && (
            <>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={canLocateBusinessObjects}
                    onChange={(e) => setCanLocate(e.target.checked)}
                  />
                }
                label={<Typography variant="body2">{canLocateS}</Typography>}
                sx={{ mt: 1, ml: 0 }}
              />
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {canLocateCaptionS}
              </Typography>
            </>
          )}
          {showTypeSelector && (
            <TextField
              select
              fullWidth
              size="small"
              label={typeS}
              value={selectedTypeKey}
              onChange={(e) => setSelectedTypeKey(e.target.value)}
              sx={{ mt: 2 }}
            >
              {BUSINESS_OBJECT_TYPES.map((type) => (
                <MenuItem key={type.key} value={type.key}>
                  {type.defaultLabel}
                </MenuItem>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          {hasPromptIa && (
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setOpenPromptIa(true)}
              sx={{ mr: "auto" }}
            >
              {promptIaS}
            </Button>
          )}
          <Button onClick={onClose}>{cancelS}</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!name}>
            {createS}
          </Button>
        </DialogActions>
      </Dialog>
      {openPromptIa && (
        <DialogPromptIaBusinessObjects
          open
          onClose={() => setOpenPromptIa(false)}
          initialName={name}
          typeKey={createdTypeKey}
          canLocateBusinessObjects={canLocateBusinessObjects}
          onCreated={(listing) => {
            onCreated?.(listing);
            onClose();
          }}
        />
      )}
    </>
  );
}
