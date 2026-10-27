import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  selectShortcutCommandKeys,
  selectShortcutsDialogOpen,
  setShortcutCommandKeys,
  setShortcutsDialogOpen,
  toggleShortcutCommand,
} from "../commandsToolbarSlice";

import { Box, Button, Dialog, List, Typography } from "@mui/material";
import RestartAlt from "@mui/icons-material/RestartAlt";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

import HeaderDialogFullPage from "Features/layout/components/HeaderDialogFullPage";
import useDialogQuitHotkey from "Features/layout/hooks/useDialogQuitHotkey";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import WhiteSectionTitle from "Features/form/components/WhiteSectionTitle";
import RowShortcutCommand from "./RowShortcutCommand";
import ListSortableShortcuts from "./ListSortableShortcuts";
import { COMMANDS_BY_KEY } from "../commands";
import { TOOLBAR_SECTIONS } from "../constants/toolbarLayout";
import { DEFAULT_SHORTCUT_COMMAND_KEYS } from "../constants/defaultShortcuts";

// Full-page « Raccourcis » dialog (opened by the last toolbar button and by
// the footer of the right-click menu): on the left every command of the
// toolbar by section and group, checked = offered in the right-click menu of
// the editors; on the right the ordered recap of the menu, reorderable by
// drag & drop. Per-device preference (commandsToolbar.shortcutCommandKeys,
// localStorage). Closes on Q (useDialogQuitHotkey) like the Configuration
// dialog; the focus stays trapped in the dialog, so the editor hotkeys are
// off while it is open.
export default function DialogCommandShortcuts() {
  const dispatch = useDispatch();

  // strings

  const titleS = "Raccourcis du clic droit";
  const introS =
    "Cochez les commandes à proposer au clic droit dans les éditeurs 2D et 3D. Le menu affiche les raccourcis dans l'ordre de la liste de droite ; une commande non applicable à la sélection y reste visible, désactivée.";
  const menuTitleS = "Menu clic droit";
  const menuHelperS = "Glissez les poignées pour changer l'ordre d'affichage.";
  const emptyS = "Aucun raccourci : cochez des commandes à gauche.";
  const resetS = "Réinitialiser";

  // data

  const open = useSelector(selectShortcutsDialogOpen);
  const shortcutKeys = useSelector(selectShortcutCommandKeys);

  // helpers

  const checked = new Set(shortcutKeys);
  const shortcutCommands = shortcutKeys
    .map((key) => COMMANDS_BY_KEY[key])
    .filter(Boolean);
  const isDefault =
    shortcutKeys.length === DEFAULT_SHORTCUT_COMMAND_KEYS.length &&
    shortcutKeys.every((k, i) => k === DEFAULT_SHORTCUT_COMMAND_KEYS[i]);

  // handlers

  const handleClose = useCallback(() => {
    dispatch(setShortcutsDialogOpen(false));
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

  useDialogQuitHotkey(open, handleClose);

  // render

  function renderCommandRow(key, indent) {
    const command = COMMANDS_BY_KEY[key];
    if (!command) return null;
    return (
      <RowShortcutCommand
        key={key}
        command={command}
        checked={checked.has(key)}
        onToggle={handleToggle}
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
      <HeaderDialogFullPage title={titleS} onClose={handleClose} />
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
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, maxWidth: 900 }}
          >
            {introS}
          </Typography>
          {/* Masonry: CSS columns, the tiles stack in each column without
              the row-aligned gaps of a grid. */}
          <Box
            sx={{
              columnCount: { xs: 1, md: 2, lg: 3 },
              columnGap: 2,
            }}
          >
            {TOOLBAR_SECTIONS.DEFAULT.map(renderSection)}
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
    </Dialog>
  );
}
