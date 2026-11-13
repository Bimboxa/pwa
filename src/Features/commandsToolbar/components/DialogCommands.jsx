import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectCommandsDialogOpen,
  selectHideDisabledCommands,
  selectShortcutCommandKeys,
  setCommandsDialogOpen,
  setHideDisabledCommands,
  setShortcutCommandKeys,
  toggleShortcutCommand,
} from "../commandsToolbarSlice";

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  List,
  Typography,
} from "@mui/material";
import RestartAlt from "@mui/icons-material/RestartAlt";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

import HeaderDialogFullPage from "Features/layout/components/HeaderDialogFullPage";
import useDialogQuitHotkey from "Features/layout/hooks/useDialogQuitHotkey";
import SearchBar from "Features/search/components/SearchBar";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import useViewers from "Features/viewers/hooks/useViewers";
import RowCommand from "./RowCommand";
import DialogCommandHelper from "./DialogCommandHelper";
import ListSortableShortcuts from "./ListSortableShortcuts";
import ChipsCommandsModule from "./ChipsCommandsModule";
import { COMMANDS_BY_KEY } from "../commands";
import { getToolbarSections } from "../constants/toolbarLayout";
import isCommandsToolbarModuleKey from "../utils/isCommandsToolbarModuleKey";
import { DEFAULT_SHORTCUT_COMMAND_KEYS } from "../constants/defaultShortcuts";
import useCommandHelpers from "../hooks/useCommandHelpers";
import matchesCommandSearch, {
  getSearchWords,
} from "../utils/matchesCommandSearch";

// Full-page « Commandes » dialog (opened by the last toolbar button and by
// the footer of the right-click menu): the reference list of the commands
// of the toolbar, by section and group, for the module selected with the
// chips above the list (ChipsCommandsModule — the modules carrying the
// toolbar; default = the module the dialog was opened from; the list is
// that module's toolbar layout, getToolbarSections). A search field (header) highlights
// the rows matching the label or the helper description (the layout stays
// whole, the sections are the landmarks); a command with a helper
// (Data/<org>/commands/<KEY>.md: description and / or gif) shows an « i »
// opening DialogCommandHelper. The checkbox of a row = offered in the
// right-click menu of the editors; on the right the ordered recap of the
// menu, reorderable by drag & drop. Per-device preference
// (commandsToolbar.shortcutCommandKeys, localStorage). Next to the chips, the
// « Masquer les commandes désactivées » option (hideDisabledCommands, on by
// default): the toolbar only shows the commands available in the current
// context. Closes on Q
// (useDialogQuitHotkey) like the Configuration dialog — the letter yields
// while typing in the search field; the focus stays trapped in the dialog,
// so the editor hotkeys are off while it is open.
export default function DialogCommands() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Commandes";
  const introS =
    "Les commandes des éditeurs 2D et 3D disponibles dans le module sélectionné. Cochez celles à proposer au clic droit : le menu les affiche dans l'ordre de la liste de droite ; une commande non applicable à la sélection y reste visible, désactivée.";
  const searchS = "Rechercher une commande…";
  const noMatchS = "Aucune commande ne correspond à";
  const menuTitleS = "Menu clic droit";
  const menuHelperS = "Glissez les poignées pour changer l'ordre d'affichage.";
  const emptyS = "Aucun raccourci : cochez des commandes à gauche.";
  const resetS = "Réinitialiser";
  const hideDisabledS = "Masquer les commandes désactivées";

  // data

  const open = useSelector(selectCommandsDialogOpen);
  const shortcutKeys = useSelector(selectShortcutCommandKeys);
  const hideDisabledCommands = useSelector(selectHideDisabledCommands);
  const { orgaCode, basePath, byKey: helpersByKey } = useCommandHelpers();
  const currentModuleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const viewers = useViewers();
  const modules = viewers.filter((viewer) =>
    isCommandsToolbarModuleKey(viewer.key)
  );

  // state

  const [search, setSearch] = useState("");
  const [helperCommandKey, setHelperCommandKey] = useState(null);
  // Module picked with the chips; null = the module the dialog was opened
  // from (reset on every opening).
  const [pickedModuleKey, setPickedModuleKey] = useState(null);

  // effects

  // A fresh dialog on every opening.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setHelperCommandKey(null);
      setPickedModuleKey(null);
    }
  }, [open]);

  // helpers

  // The listed commands = the toolbar sections of the selected module.
  const candidateKey = pickedModuleKey ?? currentModuleKey;
  const selectedModuleKey = modules.some((m) => m.key === candidateKey)
    ? candidateKey
    : (modules[0]?.key ?? currentModuleKey);
  const sections = useMemo(
    () => getToolbarSections(selectedModuleKey),
    [selectedModuleKey]
  );

  const checked = new Set(shortcutKeys);
  const shortcutCommands = shortcutKeys
    .map((key) => COMMANDS_BY_KEY[key])
    .filter(Boolean);
  const isDefault =
    shortcutKeys.length === DEFAULT_SHORTCUT_COMMAND_KEYS.length &&
    shortcutKeys.every((k, i) => k === DEFAULT_SHORTCUT_COMMAND_KEYS[i]);

  const searchWords = useMemo(() => getSearchWords(search), [search]);
  const searching = searchWords.length > 0;

  // Keys of the commands matching the search: the layout is never filtered,
  // the matching rows are highlighted (RowCommand) so the user keeps the
  // sections / groups as landmarks. Null without a search.
  const matchingKeys = useMemo(() => {
    if (!searching) return null;
    const keys = new Set();
    sections.forEach((section) => {
      section.entries.forEach((entry) => {
        const entryKeys =
          typeof entry === "string"
            ? [entry]
            : entry?.type === "group"
              ? entry.commandKeys
              : [];
        entryKeys.forEach((key) => {
          const command = COMMANDS_BY_KEY[key];
          if (
            command &&
            matchesCommandSearch(command, helpersByKey[key], searchWords)
          ) {
            keys.add(key);
          }
        });
      });
    });
    return keys;
  }, [searching, searchWords, helpersByKey, sections]);

  const helperCommand = helperCommandKey
    ? COMMANDS_BY_KEY[helperCommandKey]
    : null;
  const helper = helperCommandKey ? helpersByKey[helperCommandKey] : null;

  // handlers

  const handleClose = useCallback(() => {
    dispatch(setCommandsDialogOpen(false));
  }, [dispatch]);

  function handleToggle(key) {
    dispatch(toggleShortcutCommand(key));
  }

  function handleOrderChange(keys) {
    dispatch(setShortcutCommandKeys(keys));
  }

  function handleReset() {
    dispatch(setShortcutCommandKeys(DEFAULT_SHORTCUT_COMMAND_KEYS));
  }

  function handleHideDisabledChange(event) {
    dispatch(setHideDisabledCommands(event.target.checked));
  }

  function handleInfo(key) {
    setHelperCommandKey(key);
  }

  function handleCloseHelper() {
    setHelperCommandKey(null);
  }

  useDialogQuitHotkey(open, handleClose);

  // render

  function renderCommandRow(key, indent) {
    const command = COMMANDS_BY_KEY[key];
    if (!command) return null;
    return (
      <RowCommand
        key={key}
        command={command}
        checked={checked.has(key)}
        onToggle={handleToggle}
        onInfo={helpersByKey[key] ? handleInfo : null}
        highlighted={Boolean(matchingKeys?.has(key))}
        indent={indent}
      />
    );
  }

  // Each section is one tile of the masonry below (CSS columns): it must
  // never be split across two columns.
  function renderSection(section) {
    return (
      <Box key={section.key} sx={{ breakInside: "avoid", mb: 2 }}>
        <WhiteSectionGeneric>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            <WhiteSectionTitle sx={{ px: 1 }}>
              {section.label}
            </WhiteSectionTitle>
            <List disablePadding>
              {section.entries.map((entry) => {
                if (typeof entry === "string") return renderCommandRow(entry);
                if (entry?.type !== "group") return null;
                return (
                  <Box key={`group-${entry.key}`}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: "block", px: 1, pt: 0.75, pb: 0.25 }}
                    >
                      {entry.label}
                    </Typography>
                    {entry.commandKeys.map((key) =>
                      renderCommandRow(key, true)
                    )}
                  </Box>
                );
              })}
            </List>
          </Box>
        </WhiteSectionGeneric>
      </Box>
    );
  }

  return (
    <Dialog fullScreen open={open} onClose={handleClose}>
      <HeaderDialogFullPage title={titleS} onClose={handleClose}>
        <Box sx={{ flex: 1, maxWidth: 420, minWidth: 0 }}>
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={searchS}
            fullWidth
          />
        </Box>
      </HeaderDialogFullPage>
      <Box sx={{ display: "flex", flexGrow: 1, minHeight: 0 }}>
        {/* Left: every command, by section / group */}
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            px: 3,
            py: 2,
            bgcolor: "background.default",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              columnGap: 2,
              rowGap: 0.5,
              mb: 1.5,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <ChipsCommandsModule
                modules={modules}
                value={selectedModuleKey}
                onChange={setPickedModuleKey}
              />
            </Box>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Checkbox
                  size="small"
                  checked={hideDisabledCommands}
                  onChange={handleHideDisabledChange}
                  sx={{ p: 0.5 }}
                />
              }
              label={<Typography variant="body2">{hideDisabledS}</Typography>}
            />
          </Box>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, maxWidth: 900 }}
          >
            {introS}
          </Typography>
          {matchingKeys && matchingKeys.size === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {`${noMatchS} « ${search.trim()} ».`}
            </Typography>
          )}
          {/* Masonry: CSS columns, the tiles stack in each column without
              the row-aligned gaps of a grid. */}
          <Box
            sx={{
              columnCount: { xs: 1, md: 2, lg: 3 },
              columnGap: 2,
            }}
          >
            {sections.map(renderSection)}
          </Box>
        </Box>

        {/* Right: the ordered menu */}
        <Box
          sx={{
            width: 380,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            borderLeft: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
          }}
        >
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconRightClickShortcut
                sx={{ fontSize: 20, color: "secondary.main" }}
              />
              <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                {menuTitleS}
              </Typography>
              <Button
                size="small"
                startIcon={<RestartAlt />}
                onClick={handleReset}
                disabled={isDefault}
              >
                {resetS}
              </Button>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {menuHelperS}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 1.5 }}>
            {shortcutCommands.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ px: 1, py: 2, textAlign: "center" }}
              >
                {emptyS}
              </Typography>
            ) : (
              <ListSortableShortcuts
                commands={shortcutCommands}
                onOrderChange={handleOrderChange}
                onRemove={handleToggle}
              />
            )}
          </Box>
        </Box>
      </Box>
      <DialogCommandHelper
        open={Boolean(helperCommand)}
        command={helperCommand}
        helper={helper}
        orgaCode={orgaCode}
        basePath={basePath}
        onClose={handleCloseHelper}
      />
    </Dialog>
  );
}
