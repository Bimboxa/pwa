import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import useUpdateListing from "../hooks/useUpdateListing";
import useAnnotationTemplates from "Features/annotations/hooks/useAnnotationTemplates";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";

import { setSelectedMainBaseMapId } from "Features/mapEditor/mapEditorSlice";
import {
  setSelectedItem,
  clearSelection,
} from "Features/selection/selectionSlice";
import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";

import {
  Box,
  Typography,
  InputBase,
  IconButton,
  Switch,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  TextField,
  Popover,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ChevronRight,
  Favorite,
  FavoriteBorder,
  TableChart,
  ArrowBack,
} from "@mui/icons-material";

import db from "App/db/db";
import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import FieldProcedureKeys from "Features/annotationsAuto/components/FieldProcedureKeys";
import SectionListingPromptIa from "Features/promptIa/components/SectionListingPromptIa";
import SectionListingProceduresLinks from "Features/annotationsAuto/components/SectionListingProceduresLinks";
import DialogGeneric from "Features/layout/components/DialogGeneric";
import DatagridAnnotations from "Features/annotations/components/DatagridAnnotations";
import IconButtonMoreActionsListing from "./IconButtonMoreActionsListing";
import ListListingAnnotationTemplatesGrouped from "./ListListingAnnotationTemplatesGrouped";
import AvatarListing from "./AvatarListing";
import { getDefaultListingAvatarString } from "../utils/getListingAvatarString";
import useFavoriteListings from "../hooks/useFavoriteListings";
import useLinkedListings from "../hooks/useLinkedListings";

export default function PanelPropertiesListingV2({ listing }) {
  const dispatch = useDispatch();

  // data

  const updateListing = useUpdateListing();
  const { isFavorite, toggleFavorite } = useFavoriteListings();
  // Listing linked from another scope ("Depuis un autre Krto"): read-only
  // here — banner + locked name / avatar (edited from the source scope).
  const { isLinkedListing, getSourceScope } = useLinkedListings();
  const isLinked = isLinkedListing(listing?.id);
  const linkedSourceScope = isLinked ? getSourceScope(listing?.id) : null;
  const linkedReadOnlyS = linkedSourceScope?.name
    ? `Depuis ${linkedSourceScope.name} — lecture seule`
    : "Depuis un autre plan de repérage — lecture seule";
  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const annotationTemplates = useAnnotationTemplates({
    filterByListingId: listing?.id,
    sortByOrder: true,
  });
  const listingAnnotations = useAnnotationsV2({
    filterByListingId: listing?.id,
    withQties: true,
    caller: "PanelPropertiesListingV2",
  });
  const selectedBaseMapId = useSelector((s) => s.mapEditor.selectedBaseMapId);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  // state

  const [name, setName] = useState(listing?.name ?? "");
  const [avatarValue, setAvatarValue] = useState(listing?.avatarString ?? "");
  const [avatarAnchor, setAvatarAnchor] = useState(null);
  const [openTableDialog, setOpenTableDialog] = useState(false);
  // "Info" (name, favorite, templates, base maps) / "Avancé" (procedures,
  // auto-numbering, planning, Prompt IA)
  const [tab, setTab] = useState("INFO");

  useEffect(() => {
    setName(listing?.name ?? "");
  }, [listing?.id, listing?.name]);

  useEffect(() => {
    setAvatarValue(listing?.avatarString ?? "");
  }, [listing?.id, listing?.avatarString]);

  // data - base maps with annotation counts for this listing

  const baseMapRows = useLiveQuery(async () => {
    if (!listing?.id || !projectId) return [];
    const baseMaps = (
      await db.baseMaps.where("projectId").equals(projectId).toArray()
    ).filter((bm) => !bm.deletedAt);

    const annotations = (
      await db.annotations.where("listingId").equals(listing.id).toArray()
    ).filter((a) => !a.deletedAt && !a.isBaseMapAnnotation);

    const countByBaseMapId = {};
    annotations.forEach((a) => {
      if (a.baseMapId) {
        countByBaseMapId[a.baseMapId] =
          (countByBaseMapId[a.baseMapId] || 0) + 1;
      }
    });

    return baseMaps
      .map((bm) => ({
        id: bm.id,
        name: bm.name || "Sans nom",
        count: countByBaseMapId[bm.id] || 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [listing?.id, projectId, annotationsUpdatedAt]);

  // helpers

  const label = listing?.name ?? "Liste";
  const backToScopeS = "Retour";
  const avatarS = "Avatar";
  const editAvatarS = "Modifier l'avatar";
  const avatarHintS = "Vide = automatique";
  const tabInfoS = "Info";
  const tabAdvancedS = "Avancé";

  // handlers

  function handleBackToScope() {
    // Empty selection = the module's default panel (PanelSelectionProperties):
    // the Dessin panel in the Dessin module, the scope panel elsewhere.
    dispatch(clearSelection());
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  const handleNameBlur = async () => {
    if (!listing?.id || name === listing.name) return;
    await updateListing({ id: listing.id, name });
  };

  const handleNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.target.blur();
    }
  };

  const handleAvatarClose = async () => {
    setAvatarAnchor(null);
    if (!listing?.id) return;
    const next = avatarValue.trim() || null;
    const current = listing.avatarString?.trim() || null;
    if (next === current) return;
    await updateListing({ id: listing.id, avatarString: next });
  };

  const handleAvatarKeyDown = (e) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.preventDefault();
      handleAvatarClose();
    }
  };

  const handleSelectBaseMap = (baseMapId) => {
    dispatch(setSelectedMainBaseMapId(baseMapId));
  };

  function handleSelectTemplate(template) {
    // listingId: triggerSelectionBack maps ANNOTATION_TEMPLATE back to
    // { type: "LISTING", id: item.listingId }.
    dispatch(
      setSelectedItem({
        id: template.id,
        type: "ANNOTATION_TEMPLATE",
        listingId: listing.id,
      })
    );
    dispatch(setSelectedMenuItemKey("SELECTION_PROPERTIES"));
  }

  const handleToggleFavorite = async () => {
    if (!listing?.id) return;
    const templates = (
      await db.annotationTemplates
        .where("listingId")
        .equals(listing.id)
        .toArray()
    ).filter((t) => !t.deletedAt);
    toggleFavorite({ listing, annotationTemplates: templates });
  };

  // render

  return (
    <BoxFlexVStretch sx={{ height: "100%" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 0.5,
          pl: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <Tooltip title={backToScopeS}>
            <IconButton size="small" onClick={handleBackToScope}>
              <ArrowBack fontSize="small" />
            </IconButton>
          </Tooltip>
          <Box sx={{ ml: 1, minWidth: 0 }}>
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{
                fontStyle: "italic",
                fontSize: (theme) => theme.typography.caption.fontSize,
              }}
            >
              Liste
            </Typography>
            <Typography noWrap variant="body2" sx={{ fontWeight: "bold" }}>
              {label}
            </Typography>
          </Box>
        </Box>
        <IconButtonMoreActionsListing listing={listing} />
      </Box>

      {isLinked && (
        <Box
          sx={{
            mx: 1,
            mb: 0.5,
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: "listingFromOtherScope.main",
            color: "listingFromOtherScope.contrastText",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            {linkedReadOnlyS}
          </Typography>
        </Box>
      )}

      <Tabs
        value={tab}
        onChange={(e, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 36,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Tab label={tabInfoS} value="INFO" sx={{ minHeight: 36, py: 0.5 }} />
        <Tab
          label={tabAdvancedS}
          value="ADVANCED"
          sx={{ minHeight: 36, py: 0.5 }}
        />
      </Tabs>

      {/* Content - Info tab */}
      {tab === "INFO" && (
        <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
          {/* Name field */}
          <WhiteSectionGeneric>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
            >
              Nom
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Tooltip title={editAvatarS}>
                <span>
                  <AvatarListing
                    listing={{ ...listing, name, avatarString: avatarValue }}
                    size={36}
                    variant="selected"
                    linked={isLinked}
                    onClick={
                      isLinked
                        ? undefined
                        : (e) => setAvatarAnchor(e.currentTarget)
                    }
                  />
                </span>
              </Tooltip>
              <InputBase
                value={name}
                readOnly={isLinked}
                onChange={(e) => setName(e.target.value)}
                onBlur={isLinked ? undefined : handleNameBlur}
                onKeyDown={isLinked ? undefined : handleNameKeyDown}
                sx={{
                  flex: 1,
                  fontSize: "0.875rem",
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  "&:focus-within": {
                    borderColor: "primary.main",
                  },
                }}
              />
            </Box>
            <Popover
              open={Boolean(avatarAnchor)}
              anchorEl={avatarAnchor}
              onClose={handleAvatarClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              slotProps={{ paper: { sx: { p: 1.5, mt: 0.5 } } }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
              >
                {avatarS}
              </Typography>
              <InputBase
                autoFocus
                value={avatarValue}
                onChange={(e) => setAvatarValue(e.target.value)}
                onKeyDown={handleAvatarKeyDown}
                placeholder={getDefaultListingAvatarString({
                  ...listing,
                  name,
                })}
                inputProps={{ maxLength: 3 }}
                sx={{
                  width: 80,
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  "&:focus-within": {
                    borderColor: "primary.main",
                  },
                }}
              />
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ display: "block", mt: 0.5 }}
              >
                {avatarHintS}
              </Typography>
            </Popover>
          </WhiteSectionGeneric>

          {/* Favorite toggle */}
          <WhiteSectionGeneric>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Favori
              </Typography>
              <IconButton size="small" onClick={handleToggleFavorite}>
                {isFavorite(listing?.id) ? (
                  <Favorite sx={{ color: "orange", fontSize: 20 }} />
                ) : (
                  <FavoriteBorder
                    sx={{ color: "text.disabled", fontSize: 20 }}
                  />
                )}
              </IconButton>
            </Box>
          </WhiteSectionGeneric>

          {/* Linked procedures: a row opens the procedure properties */}
          <SectionListingProceduresLinks listing={listing} />

          {/* Coupes & élévations (vertical baseMaps) */}
          {listing?.entityModel?.type === "BASE_MAP" && (
            <WhiteSectionGeneric>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  Coupes & élévations
                </Typography>
                <Switch
                  size="small"
                  checked={Boolean(listing?.verticalBaseMaps)}
                  onChange={(e) =>
                    updateListing({
                      id: listing.id,
                      verticalBaseMaps: e.target.checked,
                    })
                  }
                />
              </Box>
            </WhiteSectionGeneric>
          )}

          {/* Annotation templates */}
          {annotationTemplates?.length > 0 && (
            <WhiteSectionGeneric>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.5,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600 }}
                >
                  Modèles
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setOpenTableDialog(true)}
                >
                  <TableChart sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Box sx={{ mx: -1, mb: -1 }}>
                <ListListingAnnotationTemplatesGrouped
                  annotationTemplates={annotationTemplates}
                  onSelectTemplate={handleSelectTemplate}
                />
              </Box>
            </WhiteSectionGeneric>
          )}

          {/* Annotations per base map */}
          <WhiteSectionGeneric>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, mb: 0.5, display: "block" }}
            >
              Annotations par fond de plan
            </Typography>
            <List dense disablePadding>
              {baseMapRows?.map((row) => {
                const isSelected = row.id === selectedBaseMapId;
                return (
                  <ListItemButton
                    key={row.id}
                    onClick={() => handleSelectBaseMap(row.id)}
                    sx={{
                      borderRadius: 1,
                      py: 0.5,
                      px: 1,
                      bgcolor: isSelected ? "action.selected" : "transparent",
                      "&:hover": { bgcolor: "action.hover" },
                    }}
                  >
                    <ListItemText
                      primary={row.name}
                      primaryTypographyProps={{
                        variant: "body2",
                        fontWeight: isSelected ? 600 : 400,
                        noWrap: true,
                      }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: "monospace",
                        fontSize: "10px",
                        fontWeight: 500,
                        color:
                          row.count > 0 ? "secondary.main" : "text.disabled",
                        mr: 0.5,
                        minWidth: 20,
                        textAlign: "right",
                      }}
                    >
                      {row.count}
                    </Typography>
                    <ChevronRight
                      sx={{ fontSize: 16, color: "text.disabled" }}
                    />
                  </ListItemButton>
                );
              })}
              {baseMapRows?.length === 0 && (
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{ py: 1, textAlign: "center" }}
                >
                  Aucun fond de plan
                </Typography>
              )}
            </List>
          </WhiteSectionGeneric>
        </BoxFlexVStretch>
      )}

      {/* Content - Avancé tab */}
      {tab === "ADVANCED" && (
        <BoxFlexVStretch sx={{ overflow: "auto", gap: 1, p: 1 }}>
          {/* Procedures launched at listing level ("Dessin auto" section
            under the listing name) */}
          {!isLinked && (
            <FieldProcedureKeys
              label="Procédures"
              value={listing?.procedureKeys}
              onChange={(procedureKeys) =>
                updateListing({ id: listing.id, procedureKeys })
              }
            />
          )}

          {/* Auto-numbered annotation labels */}
          <WhiteSectionGeneric>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                Numérotation automatique
              </Typography>
              <Switch
                size="small"
                checked={Boolean(listing?.autoNumberAnnotations)}
                onChange={(e) =>
                  updateListing({
                    id: listing.id,
                    autoNumberAnnotations: e.target.checked,
                  })
                }
              />
            </Box>
            {listing?.autoNumberAnnotations && (
              <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                <TextField
                  key={`prefix-${listing.id}`}
                  size="small"
                  label="Préfixe"
                  defaultValue={listing.autoNumberPrefix ?? ""}
                  onBlur={(e) =>
                    updateListing({
                      id: listing.id,
                      autoNumberPrefix: e.target.value.trim() || null,
                    })
                  }
                  sx={{ flex: 1 }}
                />
                <TextField
                  key={`pad-${listing.id}`}
                  size="small"
                  label="Chiffres"
                  type="number"
                  slotProps={{ htmlInput: { min: 0, max: 9 } }}
                  defaultValue={listing.autoNumberPadStart ?? ""}
                  onBlur={(e) => {
                    const n = parseInt(e.target.value, 10);
                    updateListing({
                      id: listing.id,
                      autoNumberPadStart:
                        Number.isFinite(n) && n > 0 ? n : null,
                    });
                  }}
                  sx={{ width: 96 }}
                />
              </Box>
            )}
          </WhiteSectionGeneric>

          {/* Feeds the PLANNING module (declarative tag, see
            businessObjects/utils/isForPlanning) — drawing lists only */}
          {listing?.entityModel?.type === "LOCATED_ENTITY" &&
            !listing?.isForBaseMaps && (
              <WhiteSectionGeneric>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontWeight: 600 }}
                  >
                    Planning
                  </Typography>
                  <Switch
                    size="small"
                    checked={Boolean(listing?.isForPlanning)}
                    onChange={(e) =>
                      updateListing({
                        id: listing.id,
                        isForPlanning: e.target.checked,
                      })
                    }
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{ display: "block", color: "text.secondary" }}
                >
                  Liste proposée dans la section « Liste d&apos;annotations »
                  des plannings du scope.
                </Typography>
              </WhiteSectionGeneric>
            )}

          {/* Prompt IA: virtual procedure of the "Dessin auto" band + the
            instructions handed to the AI — drawing lists only */}
          {listing?.entityModel?.type === "LOCATED_ENTITY" &&
            !listing?.isForBaseMaps &&
            !isLinked && (
              <SectionListingPromptIa
                listing={listing}
                onChange={(updates) =>
                  updateListing({ id: listing.id, ...updates })
                }
              />
            )}
        </BoxFlexVStretch>
      )}

      {/* Annotations table (opened from the Modèles section) */}
      <DialogGeneric
        title={listing?.name ?? "Annotations"}
        open={openTableDialog}
        onClose={() => setOpenTableDialog(false)}
        vw="90"
        vh="80"
      >
        <BoxFlexVStretch>
          <DatagridAnnotations
            annotations={listingAnnotations ?? []}
            onClose={() => setOpenTableDialog(false)}
          />
        </BoxFlexVStretch>
      </DialogGeneric>
    </BoxFlexVStretch>
  );
}
