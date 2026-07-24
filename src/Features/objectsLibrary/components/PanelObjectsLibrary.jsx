import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { setSelectedMenuItemKey } from "Features/rightPanel/rightPanelSlice";
import { setToaster } from "Features/layout/layoutSlice";

import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  Close,
  Category,
  Search,
  GridViewRounded,
  ViewListRounded,
  Bolt,
} from "@mui/icons-material";

import BoxFlexVStretch from "Features/layout/components/BoxFlexVStretch";

import {
  OBJECTS_LIBRARY_TABS,
  DRAWING_SUBTABS,
} from "../constants/objectsLibraryTabs";
import useObjectsLibrary from "../hooks/useObjectsLibrary";
import usePlaceObjectFromLibrary from "../hooks/usePlaceObjectFromLibrary";
import useObjectsTargetListings from "../hooks/useObjectsTargetListings";
import GridObjects from "./GridObjects";
import ListObjects from "./ListObjects";
import SectionUnderConstruction from "./SectionUnderConstruction";
import SelectorListingForObjects from "./SelectorListingForObjects";
import DialogObjectConfig from "./DialogObjectConfig";
import DialogObjectAlreadyExists from "./DialogObjectAlreadyExists";
import findObjectTemplateInListing from "../services/findObjectTemplateInListing";

export default function PanelObjectsLibrary() {
  const dispatch = useDispatch();

  // data

  const { objects, loading } = useObjectsLibrary();
  const place = usePlaceObjectFromLibrary();
  const candidateListings = useObjectsTargetListings();
  const selectedListingId = useSelector((s) => s.listings.selectedListingId);

  // state

  const [activeTab, setActiveTab] = useState("DRAWING");
  const [activeSubTab, setActiveSubTab] = useState("DRAWING_2D");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [dialogObject, setDialogObject] = useState(null);
  const [targetListingId, setTargetListingId] = useState(selectedListingId);
  // { object, existingTemplate, listingName, listingId } when the target listing
  // already holds a template for this model (modelIdMaster match).
  const [existsDialog, setExistsDialog] = useState(null);

  // helpers

  // Under "Dessin" the sub-chip drives the category; "Objets 3D" is its own
  // category. Each maps to an object's `tab` value in the manifest.
  const effectiveCategory =
    activeTab === "DRAWING" ? activeSubTab : "OBJECT_3D";

  // A category is populated when the manifest holds at least one object for it;
  // empty categories show an "En cours de construction" placeholder.
  const categoryHasObjects = objects.some((o) => o.tab === effectiveCategory);

  // A valid target must be one of the candidate listings (the system
  // "Annotations libres" listing is excluded and can't be a target).
  const hasValidTarget = candidateListings.some(
    (l) => l.id === targetListingId
  );

  const filteredObjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return objects
      .filter((o) => o.tab === effectiveCategory)
      .filter((o) => {
        if (!q) return true;
        return (
          o.label?.toLowerCase().includes(q) ||
          o.description?.toLowerCase().includes(q) ||
          o.category?.toLowerCase().includes(q)
        );
      });
  }, [objects, effectiveCategory, search]);

  // handlers

  function handleClose() {
    dispatch(setSelectedMenuItemKey(null));
  }

  async function handlePlace({ object, userEdits }) {
    await place({ object, userEdits, listingId: targetListingId });
    setDialogObject(null);
    // Close the panel so the map (and the shape ghost under the cursor) is
    // fully visible for placement.
    dispatch(setSelectedMenuItemKey(null));
  }

  // "Localiser" straight from a card/row: same placement as the dialog, with the
  // object's default config. Requires a target listing first. Unlike the dialog
  // "Positionner", this keeps the panel open. If the listing already holds a
  // template for this model (modelIdMaster match), ask create-new vs reuse-existing.
  async function handleLocate(object) {
    if (!hasValidTarget) {
      dispatch(
        setToaster({
          message: "Choisissez d'abord la liste de destination.",
          severity: "warning",
        })
      );
      return;
    }
    const existingTemplate = await findObjectTemplateInListing(
      targetListingId,
      object.modelIdMaster
    );
    if (existingTemplate) {
      const listingName =
        candidateListings.find((l) => l.id === targetListingId)?.name ?? "";
      setExistsDialog({
        object,
        existingTemplate,
        listingName,
        listingId: targetListingId,
      });
      return;
    }
    place({ object, userEdits: {}, listingId: targetListingId });
  }

  function handleCreateNewModel() {
    const d = existsDialog;
    setExistsDialog(null);
    if (d?.object) {
      place({ object: d.object, userEdits: {}, listingId: d.listingId });
    }
  }

  function handleUseExistingModel() {
    const d = existsDialog;
    setExistsDialog(null);
    if (d?.object && d?.existingTemplate) {
      place({
        object: d.object,
        existingTemplate: d.existingTemplate,
        listingId: d.listingId,
      });
    }
  }

  // render

  return (
    <BoxFlexVStretch>
      {/* header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 1.5,
            bgcolor: "primary.light",
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Category fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: "bold", lineHeight: 1.2 }}
          >
            Bibliothèque de modèles
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rechercher &amp; positionner une figure
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose}>
          <Close />
        </IconButton>
      </Box>

      {/* tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => setActiveTab(v)}
        variant="fullWidth"
        sx={{
          minHeight: 40,
          borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
          "& .MuiTab-root": { minHeight: 40, textTransform: "none" },
        }}
      >
        {OBJECTS_LIBRARY_TABS.map((tab) => (
          <Tab key={tab.key} value={tab.key} label={tab.label} />
        ))}
      </Tabs>

      {/* white content surface: search + filters + list + footer */}
      <Box
        sx={{
          flexGrow: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          bgcolor: "white",
        }}
      >
        {/* search + view toggle */}
        <Box sx={{ display: "flex", gap: 1, p: 1.5, pb: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Rechercher une figure…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={viewMode}
            onChange={(e, v) => v && setViewMode(v)}
          >
            <ToggleButton value="grid">
              <GridViewRounded fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list">
              <ViewListRounded fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* sub-category chips (only under the "Dessin" tab) */}
        {activeTab === "DRAWING" && (
          <Box sx={{ display: "flex", gap: 1, px: 1.5, pb: 1 }}>
            {DRAWING_SUBTABS.map((sub) => {
              const selected = activeSubTab === sub.key;
              return (
                <Chip
                  key={sub.key}
                  size="small"
                  label={sub.label}
                  color={selected ? "primary" : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => setActiveSubTab(sub.key)}
                />
              );
            })}
          </Box>
        )}

        {/* content */}
        <Box
          sx={{ flexGrow: 1, minHeight: 0, overflowY: "auto", px: 1.5, pb: 1 }}
        >
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : !categoryHasObjects ? (
            <SectionUnderConstruction />
          ) : filteredObjects.length === 0 ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", p: 4 }}
            >
              Aucune figure trouvée.
            </Typography>
          ) : (
            <>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: "block", mb: 1 }}
              >
                {filteredObjects.length} figure
                {filteredObjects.length > 1 ? "s" : ""}
              </Typography>
              {viewMode === "grid" ? (
                <GridObjects
                  objects={filteredObjects}
                  onOpen={setDialogObject}
                  onLocate={handleLocate}
                />
              ) : (
                <ListObjects
                  objects={filteredObjects}
                  onOpen={setDialogObject}
                  onLocate={handleLocate}
                />
              )}
            </>
          )}
        </Box>

        {/* footer: target listing selector + hint. When no valid target listing
            is selected, a warning band draws attention to the selector. */}
        <Box
          sx={{
            p: 1.5,
            borderTop: (theme) =>
              `1px solid ${
                hasValidTarget
                  ? theme.palette.divider
                  : theme.palette.warning.main
              }`,
            bgcolor: (theme) =>
              hasValidTarget
                ? "transparent"
                : alpha(theme.palette.warning.main, 0.12),
            transition: "background-color 0.2s",
          }}
        >
          <SelectorListingForObjects
            value={targetListingId}
            onChange={setTargetListingId}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
            <Bolt
              fontSize="small"
              sx={{ color: hasValidTarget ? "text.disabled" : "warning.main" }}
            />
            <Typography
              variant="caption"
              color={hasValidTarget ? "text.secondary" : "warning.main"}
            >
              {hasValidTarget
                ? "Ouvrez une figure puis cliquez sur « Dessiner »."
                : "Sélectionnez d'abord une liste de destination."}
            </Typography>
          </Box>
        </Box>
      </Box>

      <DialogObjectConfig
        open={Boolean(dialogObject)}
        object={dialogObject}
        canPlace={hasValidTarget}
        onClose={() => setDialogObject(null)}
        onPlace={handlePlace}
      />

      <DialogObjectAlreadyExists
        open={Boolean(existsDialog)}
        object={existsDialog?.object}
        existingTemplate={existsDialog?.existingTemplate}
        listingName={existsDialog?.listingName}
        onClose={() => setExistsDialog(null)}
        onCreateNew={handleCreateNewModel}
        onUseExisting={handleUseExistingModel}
      />
    </BoxFlexVStretch>
  );
}
