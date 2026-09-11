import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { setSelectedItem } from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { triggerListingsUpdate } from "Features/listings/listingsSlice";
import { setListingPropertiesTab } from "../businessObjectsSlice";

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
  CircularProgress,
  IconButton,
  InputBase,
  Tab,
  Tabs,
} from "@mui/material";
import {
  ArrowBack as Back,
  AddLocationAlt,
  Add,
  CloudDownload,
  Delete,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import AnnotationTemplateIcon from "Features/annotations/components/AnnotationTemplateIcon";
import DialogCreateAnnotationTemplate from "Features/annotations/components/DialogCreateAnnotationTemplate";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";
import useDeleteAnnotationTemplate from "Features/annotations/hooks/useDeleteAnnotationTemplate";

import useLocationAnnotationTemplates from "../hooks/useLocationAnnotationTemplates";
import canLocateBusinessObjects from "../utils/canLocateBusinessObjects";
import getBusinessObjectTypeOfListing from "../utils/getBusinessObjectTypeOfListing";
import SectionPlanningAnnotationListings from "./SectionPlanningAnnotationListings";

import useNotesAppConfig from "Features/notesApp/hooks/useNotesAppConfig";
import useNotesAppScopeLink from "Features/notesApp/hooks/useNotesAppScopeLink";
import useSyncNotesAppListing from "Features/notesApp/hooks/useSyncNotesAppListing";
import { getNotesAppRemoteListingId } from "Features/notesApp/services/syncNotesAppListing";
import SectionNotesAppListingAdvanced from "Features/notesApp/components/SectionNotesAppListingAdvanced";
import PanelNotesAppListingConfig from "Features/notesApp/components/PanelNotesAppListingConfig";

// Right-panel properties of a business-objects listing, reached with the back
// arrow of the object properties panel (selection: {type: "LISTING"}). Name
// edition, the "Numérotation" display option (3-column DPGF-like tree), the
// "Localisation sur les plans" opt-in (listing.canLocateBusinessObjects) and,
// when it is on, the location templates: the listing's OWN
// annotationTemplates, created with the same "Nouveau modèle" dialog as the
// Dessin popper and flagged isBusinessObjectAnnotation — drawing one from
// the popper (business-object mode) creates the object's main annotation.
// Turning the option off hides the templates card only: templates and
// existing main annotations are kept. When the org has the Krnet
// integration the panel gets two tabs: "Général" (the cards above) and
// "Avancé" (the listing configuration synced with Krnet: fields, state
// models, codification, object preview — SectionNotesAppListingAdvanced);
// the sub-views that tab opens replace the whole panel until closed. A
// Krnet-linked listing gets a pull icon button in the header ("Récupérer"):
// every object of the remote list with notes, links, positions, shapes and
// the list configuration are fetched (useSyncNotesAppListing) — pull only.
export default function PanelBusinessObjectListingProperties({ listing }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Liste d'ouvrages";
  const tabGeneralS = "Général";
  const tabAdvancedS = "Avancé";
  const nameS = "Nom de la liste";
  const numberingS = "Numérotation";
  const numberingCaptionS =
    "Affiche les ouvrages sur 3 colonnes : numéro, nom, quantité.";
  const canLocateS = "Localisation sur les plans";
  const canLocateCaptionS =
    "Les ouvrages peuvent être localisés sur les plans : dessiner un modèle de localisation crée l'annotation principale de l'ouvrage. Les localisations existantes sont conservées.";
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
  const notesAppConfig = useNotesAppConfig();
  const notesAppEnabled = notesAppConfig?.enabled === true;
  const notesAppName = notesAppConfig?.name ?? "Krnet";
  const configView = useSelector((s) => s.notesApp.listingConfigView);
  const propertiesTab = useSelector(
    (s) => s.businessObjects.listingPropertiesTab
  );

  const locationTemplates = useLocationAnnotationTemplates({ listing });
  const spriteImage = useAnnotationSpriteImage();
  const { deleteAnnotationTemplate, getAnnotationCount } =
    useDeleteAnnotationTemplate();

  // data — per-listing pull from Krnet (header icon button): the listing
  // must be mapped on a Krnet list and the scope linked to a Krnet project.
  // Pull only: nothing is sent to Krnet.
  const { link: notesAppLink, scope: notesAppScope } = useNotesAppScopeLink();
  const { syncListing, syncing: pulling } = useSyncNotesAppListing();
  const canPull =
    notesAppEnabled &&
    Boolean(notesAppLink?.projectId) &&
    Boolean(getNotesAppRemoteListingId({ listing, scope: notesAppScope }));
  const pullTitleS = `Récupérer les données de cette liste depuis ${notesAppName} (aucun envoi vers ${notesAppName})`;

  // state

  const [nameValue, setNameValue] = useState(null);
  const [openCreateTemplate, setOpenCreateTemplate] = useState(false);
  // {template, annotationCount} while the delete confirmation is open
  const [deleteTarget, setDeleteTarget] = useState(null);

  // helpers

  const isEditingName = nameValue !== null;
  const displayName = isEditingName ? nameValue : listing?.name || "";

  const objectsCount = businessObjects?.length ?? 0;
  const canLocate = canLocateBusinessObjects(listing);
  // PLANNING listings only (type feature): the drawing lists feeding the
  // planning.
  const showAnnotationListings = Boolean(
    getBusinessObjectTypeOfListing(listing).features?.annotationListings
  );
  // stale stack of another listing = closed
  const configViewOpen =
    notesAppEnabled &&
    configView.listingId === listing?.id &&
    configView.stack.length > 0;
  const countS = `${objectsCount} ouvrage${objectsCount > 1 ? "s" : ""}`;
  // the Avancé tab only exists with the integration: a stale "ADVANCED"
  // falls back to Général
  const effectiveTab =
    notesAppEnabled && propertiesTab === "ADVANCED" ? "ADVANCED" : "GENERAL";

  // handlers

  function handleBack() {
    // Back from the listing properties returns to the scope panel, like the
    // baseMap group properties panel.
    dispatch(setSelectedItem({ id: selectedScopeId, type: "SCOPE" }));
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  async function handlePull() {
    if (pulling || !listing) return;
    await syncListing(listing);
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

  async function handleToggleCanLocate(e) {
    if (!listing?.id || !guardEditRecord(listing)) return;
    await db.listings.update(listing.id, {
      canLocateBusinessObjects: e.target.checked,
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
      // the name is part of the Krnet configuration: stamp the local edit
      // so the sync conflict rule and the push selection see it
      if (listing.notesApp) {
        await db.listings.update(listing.id, {
          notesApp: {
            ...listing.notesApp,
            localUpdatedAt: new Date().toISOString(),
          },
        });
      }
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

  if (configViewOpen) {
    return <PanelNotesAppListingConfig listing={listing} />;
  }

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
        <Box sx={{ ml: 1, flexGrow: 1, minWidth: 0 }}>
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
        {canPull &&
          (pulling ? (
            <CircularProgress size={18} sx={{ mx: 1 }} />
          ) : (
            <IconButton
              size="small"
              onClick={handlePull}
              title={pullTitleS}
              sx={{ flexShrink: 0, mr: 0.5 }}
            >
              <CloudDownload />
            </IconButton>
          ))}
      </Box>

      {notesAppEnabled && (
        <Tabs
          value={effectiveTab}
          onChange={(_e, v) => dispatch(setListingPropertiesTab(v))}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            borderBottom: "1px solid",
            borderColor: "divider",
            "& .MuiTab-root": { minHeight: 36 },
          }}
        >
          <Tab value="GENERAL" label={tabGeneralS} />
          <Tab value="ADVANCED" label={tabAdvancedS} />
        </Tabs>
      )}

      {effectiveTab === "ADVANCED" && (
        <SectionNotesAppListingAdvanced listing={listing} />
      )}

      {effectiveTab === "GENERAL" && (
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
                label={<Typography variant="body2">{numberingS}</Typography>}
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
            <Box sx={{ p: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={canLocate}
                    onChange={handleToggleCanLocate}
                  />
                }
                label={<Typography variant="body2">{canLocateS}</Typography>}
                sx={{ ml: 0 }}
              />
              <Typography
                variant="caption"
                sx={{ display: "block", color: "text.secondary" }}
              >
                {canLocateCaptionS}
              </Typography>
            </Box>
          </WhiteSectionGeneric>

          {showAnnotationListings && <SectionPlanningAnnotationListings />}

          {canLocate && (
            <WhiteSectionGeneric>
              <Box
                sx={{ p: 1, display: "flex", flexDirection: "column", gap: 1 }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <AddLocationAlt
                    sx={{ fontSize: 16, color: "text.secondary" }}
                  />
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
                        <Box
                          sx={{ mr: 1, display: "flex", alignItems: "center" }}
                        >
                          <AnnotationTemplateIcon
                            template={template}
                            size={20}
                            spriteImage={spriteImage}
                          />
                        </Box>
                        <ListItemText
                          primary={template.label || "Sans nom"}
                          slotProps={{
                            primary: { variant: "body2", noWrap: true },
                          }}
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
          )}
        </BoxFlexVStretch>
      )}

      {canLocate && openCreateTemplate && (
        <DialogCreateAnnotationTemplate
          open
          listingId={listing.id}
          templateDefaults={{ isBusinessObjectAnnotation: true }}
          onClose={() => setOpenCreateTemplate(false)}
        />
      )}

      {deleteTarget && (
        <Dialog
          open
          onClose={() => setDeleteTarget(null)}
          maxWidth="xs"
          fullWidth
        >
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
