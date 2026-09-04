import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";

import useBusinessObjects from "../hooks/useBusinessObjects";
import useCanEditRecord from "App/hooks/useCanEditRecord";
import db from "App/db/db";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  IconButton,
  InputBase,
} from "@mui/material";
import {
  ArrowBack as Back,
  AddLocationAlt,
  Add,
  Delete,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useDeleteAnnotationTemplate from "Features/annotations/hooks/useDeleteAnnotationTemplate";

import useLocationAnnotationTemplates from "../hooks/useLocationAnnotationTemplates";

// Right-panel properties of a business-objects listing, reached with the back
// arrow of the object properties panel (selection: {type: "LISTING"}). Name
// edition, the "Numérotation" display option (3-column DPGF-like tree) and
// the location templates: the listing's OWN annotationTemplates, created
// with the same "Nouveau modèle" dialog as the Dessin popper and flagged
// isBusinessObjectAnnotation. "Located" objects get a "Localiser" action that
// draws their main annotation with one of them.
export default function PanelBusinessObjectListingProperties({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Liste d'ouvrages";
  const nameS = "Nom de la liste";
  const numberingS = "Numérotation";
  const numberingCaptionS =
    "Affiche les ouvrages sur 3 colonnes : numéro, nom, quantité.";
  const locationS = "Modèles de localisation";
  const locationCaptionS =
    "Les ouvrages sont localisés sur les plans avec ces modèles : l'annotation dessinée devient l'annotation principale de l'ouvrage et porte son nom.";
  const locationEmptyS = "Aucun modèle — les ouvrages ne sont pas localisés.";
  const newTemplateS = "Nouveau modèle";
  const deleteTemplateS = "Supprimer le modèle";
  const cancelS = "Annuler";
  const deleteS = "Supprimer";

  // data

  const selectedScopeId = useSelector((s) => s.scopes.selectedScopeId);
  const { value: businessObjects } = useBusinessObjects({
    listingId: listing?.id,
  });
  const { guardEditRecord } = useCanEditRecord();

  const locationTemplates = useLocationAnnotationTemplates({ listing });
  const spriteImage = useAnnotationSpriteImage();
  const { deleteAnnotationTemplate, getAnnotationCount } =
    useDeleteAnnotationTemplate();

  // state

  const [nameValue, setNameValue] = useState(null);
  const [openCreateTemplate, setOpenCreateTemplate] = useState(false);
  // {template, annotationCount} while the delete confirmation is open
  const [deleteTarget, setDeleteTarget] = useState(null);

  // helpers

  const isEditingName = nameValue !== null;
  const displayName = isEditingName ? nameValue : listing?.name || "";

  const objectsCount = businessObjects?.length ?? 0;
  const countS = `${objectsCount} ouvrage${objectsCount > 1 ? "s" : ""}`;

  // handlers

  function handleBack() {
    // Back from the listing properties returns to the scope panel, like the
    // baseMap group properties panel.
    dispatch(setSelectedItem({ id: selectedScopeId, type: "SCOPE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  // handlers — location templates

  function handleOpenCreateTemplate() {
    if (!listing?.id || !guardEditRecord(listing)) return;
    setOpenCreateTemplate(true);
  }

  // Template row → its properties panel (label, colors, shape…), like the
  // "Modèles" rows of the generic listing panel.
  function handleSelectTemplate(template) {
    dispatch(setSelectedItem({ id: template.id, type: "ANNOTATION_TEMPLATE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  async function handleAskDeleteTemplate(e, template) {
    e.stopPropagation();
    if (!guardEditRecord(listing)) return;
    const annotationCount = await getAnnotationCount(template.id);
    setDeleteTarget({ template, annotationCount });
  }

  async function handleConfirmDeleteTemplate() {
    if (!deleteTarget) return;
    await deleteAnnotationTemplate(deleteTarget.template.id);
    setDeleteTarget(null);
  }

  async function handleToggleNumbering(e) {
    if (!listing?.id || !guardEditRecord(listing)) return;
    await db.listings.update(listing.id, {
      showNumbering: e.target.checked,
    });
    dispatch(triggerListingsUpdate());
  }

  // handlers - name

  function handleNameFocus() {
    setNameValue(listing?.name || "");
  }

  async function handleNameBlur() {
    if (nameValue !== null && listing?.id && guardEditRecord(listing)) {
      await db.listings.update(listing.id, { name: nameValue });
    }
    setNameValue(null);
  }

  function handleNameKeyDown(e) {
    if (e.key === "Enter") {
      e.target.blur();
    } else if (e.key === "Escape") {
      setNameValue(null);
    }
  }

  // render

  // useListingById spreads an undefined record into a truthy `{entityModel}`
  // object, and reads are not filtered on deletedAt: guard on both.
  if (!listing?.id || listing.deletedAt) return null;

  return (
    <BoxFlexVStretch>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0.5,
          pl: 1,
        }}
      >
        <IconButton onClick={handleBack}>
          <Back />
        </IconButton>
        <Box sx={{ ml: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {titleS}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {listing.name || titleS}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {countS}
          </Typography>
        </Box>
      </Box>

      <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1.5 }}>
        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {nameS}
            </Typography>
            <InputBase
              value={displayName}
              onChange={(e) => setNameValue(e.target.value)}
              onFocus={handleNameFocus}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              fullWidth
              sx={{ fontSize: "0.875rem" }}
            />
          </Box>
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          <Box sx={{ p: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(listing.showNumbering)}
                  onChange={handleToggleNumbering}
                />
              }
              label={
                <Typography variant="body2">{numberingS}</Typography>
              }
              sx={{ ml: 0 }}
            />
            <Typography
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {numberingCaptionS}
            </Typography>
          </Box>
        </WhiteSectionGeneric>

        <WhiteSectionGeneric>
          <Box sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <AddLocationAlt sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="body2">{locationS}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {locationCaptionS}
            </Typography>
            {locationTemplates.length === 0 ? (
              <Typography variant="caption" color="text.disabled">
                {locationEmptyS}
              </Typography>
            ) : (
              <List dense disablePadding sx={{ mx: -1 }}>
                {locationTemplates.map((template) => (
                  <ListItemButton
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    sx={{
                      py: 0.25,
                      "&:hover .location-template-delete": {
                        visibility: "visible",
                      },
                    }}
                  >
                    <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                      <AnnotationTemplateIcon
                        template={template}
                        size={20}
                        spriteImage={spriteImage}
                      />
                    </Box>
                    <ListItemText
                      primary={template.label || "Sans nom"}
                      slotProps={{ primary: { variant: "body2", noWrap: true } }}
                    />
                    <IconButton
                      className="location-template-delete"
                      size="small"
                      title={deleteTemplateS}
                      onClick={(e) => handleAskDeleteTemplate(e, template)}
                      sx={{ visibility: "hidden" }}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </ListItemButton>
                ))}
              </List>
            )}
            <Button
              size="small"
              variant="outlined"
              startIcon={<Add />}
              onClick={handleOpenCreateTemplate}
            >
              {newTemplateS}
            </Button>
          </Box>
        </WhiteSectionGeneric>
      </BoxFlexVStretch>

      {openCreateTemplate && (
        <DialogCreateAnnotationTemplate
          open
          listingId={listing.id}
          templateDefaults={{ isBusinessObjectAnnotation: true }}
          onClose={() => setOpenCreateTemplate(false)}
        />
      )}

      {deleteTarget && (
        <Dialog open onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>
            {`Supprimer le modèle "${deleteTarget.template.label || "Sans nom"}" ?`}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              {deleteTarget.annotationCount > 0
                ? `${deleteTarget.annotationCount} annotation${
                    deleteTarget.annotationCount > 1 ? "s" : ""
                  } de localisation dessinée${
                    deleteTarget.annotationCount > 1 ? "s" : ""
                  } avec ce modèle ${
                    deleteTarget.annotationCount > 1
                      ? "seront supprimées"
                      : "sera supprimée"
                  }.`
                : "Aucune annotation n'utilise ce modèle."}
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteTarget(null)}>{cancelS}</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDeleteTemplate}
            >
              {deleteS}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </BoxFlexVStretch>
  );
}
