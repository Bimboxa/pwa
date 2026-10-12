import { useMemo, useState } from "react";

import { useDispatch, useSelector } from "react-redux";
import { setSelectedListingId, setOpenedPanel } from "../listingsSlice";

import useSelectedScope from "Features/scopes/hooks/useSelectedScope";
import useCreateListings from "../hooks/useCreateListings";
import useFavoriteListings from "../hooks/useFavoriteListings";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Tooltip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import MoreHoriz from "@mui/icons-material/MoreHoriz";

import DialogGeneric from "Features/layout/components/DialogGeneric";
import DialogGenericRename from "Features/layout/components/DialogGenericRename";
import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import SectionPresetListingsSelector from "./SectionPresetListingsSelector";
import SectionPresetListingsPreview from "./SectionPresetListingsPreview";

import buildListingFromFavorite from "../utils/buildListingFromFavorite";

// ---------------------------------------------------------------------------
// DialogCreateListingsFromFavorites — "Depuis mes favoris" step of the
// "Ajouter une liste" chooser. Same mechanics as the pre-configured lists
// section: favorites on the left (multi-select), name / avatar + templates
// of the selected ones on the right, "Ajouter les N listes" button.
// Each favorite row has a "..." menu to rename or delete the favorite.
// ---------------------------------------------------------------------------

export default function DialogCreateListingsFromFavorites({
  open,
  onClose,
  isForBaseMaps,
}) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Depuis mes favoris";
  const helperS = "Sélectionnez une ou plusieurs listes favorites";
  const emptyS =
    "Aucune liste favorite. Marquez une liste en favori (icône cœur) depuis ses propriétés.";
  const moreS = "Renommer, supprimer...";
  const renameS = "Renommer";
  const deleteS = "Supprimer";
  const deleteMessageS = (name) => `Supprimer le favori « ${name} » ?`;

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const { value: scope } = useSelectedScope();
  const createListings = useCreateListings();
  const { favoriteListings, renameFavorite, removeFavorite } =
    useFavoriteListings();

  // state

  const [selectedKeys, setSelectedKeys] = useState([]);
  // { [key]: { name, avatarString } } — edits made in the preview
  const [overridesByKey, setOverridesByKey] = useState({});
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuFavorite, setMenuFavorite] = useState(null);
  const [renamingFavorite, setRenamingFavorite] = useState(null);
  const [tempName, setTempName] = useState("");
  const [deletingFavorite, setDeletingFavorite] = useState(null);

  // helpers

  const favoriteItems = useMemo(() => {
    return favoriteListings
      .filter((fav) =>
        isForBaseMaps ? fav.isForBaseMaps === true : !fav.isForBaseMaps
      )
      .map((fav) => ({
        key: `fav_${fav.sourceListingId}`,
        sourceListingId: fav.sourceListingId,
        name: fav.name,
        fullName: fav.name,
        avatarString: fav.avatarString,
        annotationTemplatesLibrary: fav.annotationTemplates ?? [],
        isForBaseMaps: fav.isForBaseMaps,
      }));
  }, [favoriteListings, isForBaseMaps]);

  const hasFavorites = favoriteItems.length > 0;

  function getFavorite(sourceListingId) {
    return favoriteListings.find((f) => f.sourceListingId === sourceListingId);
  }

  function resetSelection() {
    setSelectedKeys([]);
    setOverridesByKey({});
  }

  // handlers - creation

  async function handleAdd() {
    const listings = selectedKeys
      .map((key) => {
        const item = favoriteItems.find((i) => i.key === key);
        const fav = item && getFavorite(item.sourceListingId);
        if (!fav) return null;
        return buildListingFromFavorite(fav, {
          projectId,
          isForBaseMaps,
          override: overridesByKey[key],
        });
      })
      .filter(Boolean);

    if (listings.length === 0) return;

    const created = await createListings({ listings, scope });
    if (created?.length > 0) {
      dispatch(setSelectedListingId(created[0].id));
      dispatch(setOpenedPanel("LISTING"));
    }
    resetSelection();
    onClose?.();
  }

  // handlers - "..." menu

  function handleMenuOpen(e, item) {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuFavorite(item);
  }

  function handleMenuClose() {
    setMenuAnchor(null);
    setMenuFavorite(null);
  }

  function handleRenameStart() {
    setRenamingFavorite(menuFavorite);
    setTempName(menuFavorite?.name ?? "");
    handleMenuClose();
  }

  function handleRenameClose() {
    const fav = renamingFavorite;
    setRenamingFavorite(null);
    if (!fav) return;
    const cleanName = tempName.trim();
    if (!cleanName || cleanName === fav.name) return;
    renameFavorite(fav.sourceListingId, cleanName);
    // the preview falls back to the favorite name once the override is gone
    setOverridesByKey((prev) => {
      if (!prev[fav.key]) return prev;
      const next = { ...prev };
      delete next[fav.key];
      return next;
    });
  }

  function handleDeleteStart() {
    setDeletingFavorite(menuFavorite);
    handleMenuClose();
  }

  async function handleDeleteConfirm() {
    const fav = deletingFavorite;
    setDeletingFavorite(null);
    if (!fav) return;
    removeFavorite(fav.sourceListingId);
    setSelectedKeys((prev) => prev.filter((k) => k !== fav.key));
    setOverridesByKey((prev) => {
      if (!prev[fav.key]) return prev;
      const next = { ...prev };
      delete next[fav.key];
      return next;
    });
  }

  // render

  function renderItemActions(item) {
    const isOpen = menuFavorite?.key === item.key;
    return (
      <Tooltip title={moreS}>
        <IconButton
          size="small"
          onClick={(e) => handleMenuOpen(e, item)}
          sx={{
            p: 0.25,
            borderRadius: 1,
            color: "text.secondary",
            bgcolor: isOpen ? "action.selected" : "transparent",
          }}
        >
          <MoreHoriz sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <DialogGeneric open={open} onClose={onClose} maxWidth={false}>
      <Box
        sx={{
          width: 700,
          p: 3,
          bgcolor: "background.default",
          position: "relative",
        }}
      >
        <IconButton
          size="small"
          onClick={() => onClose?.()}
          sx={{ position: "absolute", top: 12, right: 12 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          {titleS}
        </Typography>

        {!hasFavorites ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              py: 6,
              bgcolor: "white",
              borderRadius: 1,
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", px: 4 }}
            >
              {emptyS}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 2, minHeight: 300 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionPresetListingsSelector
                selectedKeys={selectedKeys}
                onChange={setSelectedKeys}
                isForBaseMaps={isForBaseMaps}
                listings={favoriteItems}
                showKeywordFilters={false}
                renderItemActions={renderItemActions}
                helperText={helperS}
              />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <SectionPresetListingsPreview
                selectedKeys={selectedKeys}
                onAddListings={handleAdd}
                overridesByKey={overridesByKey}
                onOverridesChange={setOverridesByKey}
                onSelectedKeysChange={setSelectedKeys}
                listings={favoriteItems}
              />
            </Box>
          </Box>
        )}
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleRenameStart}>{renameS}</MenuItem>
        <MenuItem onClick={handleDeleteStart} sx={{ color: "error.main" }}>
          {deleteS}
        </MenuItem>
      </Menu>

      <DialogGenericRename
        open={Boolean(renamingFavorite)}
        onClose={handleRenameClose}
        name={tempName}
        onNameChange={setTempName}
      />

      <DialogDeleteRessource
        open={Boolean(deletingFavorite)}
        onClose={() => setDeletingFavorite(null)}
        onConfirmAsync={handleDeleteConfirm}
        message={deleteMessageS(deletingFavorite?.name ?? "")}
      />
    </DialogGeneric>
  );
}
