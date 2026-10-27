import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  closeContextMenu,
  selectContextMenuAnchorPosition,
} from "Features/contextMenu/contextMenuSlice";
import {
  selectShortcutCommandKeys,
  setCommandsToolbarLastUsed,
  setShortcutsDialogOpen,
} from "../commandsToolbarSlice";

import {
  Box,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Portal,
} from "@mui/material";
import IconRightClickShortcut from "Features/icons/IconRightClickShortcut";

import CommandMenuContext from "./CommandMenuContext";
import CommandSlot from "./CommandSlot";
import { COMMANDS_BY_KEY } from "../commands";
import getToolbarLayout, {
  getLayoutCommandKeys,
} from "../constants/toolbarLayout";
import toSlotItem from "../utils/toSlotItem";

// Right-click shortcuts menu of the editors, rendered by CommandsToolbar (the
// owner of ctx / deps): the user's ordered shortcut commands
// (commandsToolbar.shortcutCommandKeys, chosen in DialogCommandShortcuts) as
// menu items — the same CommandSlot / CommandMenuContext rendering as a
// group menu, so a `run` command fires and a popup-owning command (template
// pickers, dialogs) opens its popup on the menu anchor. The menu is
// keepMounted: a popup opened from an item survives the menu closing.
//
// Opens on contextMenu.anchorPosition (set by the 2D InteractionLayer and the
// 3D MainThreedEditor on a right click, after they selected the hit
// annotation). The anchor is a real 1×1 fixed element portaled to body (the
// floating toolbar is CSS-transformed) and stays where the menu last opened
// so the popups keep a live anchor. Only the shortcuts present in the current
// module's layout are listed; a non-relevant command is disabled with its
// reason, never hidden (toolbar rule). Footer: « Raccourcis… » opens the
// dialog.
export default function MenuCommandShortcuts({ ctx, deps }) {
  const dispatch = useDispatch();

  // strings

  const configureS = "Raccourcis…";

  // data

  const anchorPosition = useSelector(selectContextMenuAnchorPosition);
  const shortcutKeys = useSelector(selectShortcutCommandKeys);

  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [lastPosition, setLastPosition] = useState(null);
  const [hasOpened, setHasOpened] = useState(false);

  // effects

  // A stale anchor (a right click dispatched while the toolbar was hidden —
  // capture framing, another module…) must not pop the menu on mount; the
  // anchor is also dropped when the toolbar goes away.
  useEffect(() => {
    dispatch(closeContextMenu());
    return () => {
      dispatch(closeContextMenu());
    };
  }, [dispatch]);

  useEffect(() => {
    if (anchorPosition) {
      setLastPosition(anchorPosition);
      setHasOpened(true);
    }
  }, [anchorPosition]);

  // helpers

  const closeMenu = useCallback(() => {
    dispatch(closeContextMenu());
  }, [dispatch]);

  const layout = getToolbarLayout(ctx.viewerKey);
  const layoutKeys = useMemo(
    () => new Set(getLayoutCommandKeys(layout)),
    [layout]
  );
  // A grouped command fired from here becomes its group's primary slot too.
  const groupKeyByCommand = useMemo(() => {
    const map = {};
    layout.forEach((entry) => {
      if (entry?.type === "group") {
        entry.commandKeys.forEach((k) => {
          map[k] = entry.key;
        });
      }
    });
    return map;
  }, [layout]);

  const onItemClick = useCallback(
    (commandKey) => {
      const groupKey = groupKeyByCommand[commandKey];
      if (groupKey) {
        dispatch(setCommandsToolbarLastUsed({ groupKey, commandKey }));
      }
    },
    [dispatch, groupKeyByCommand]
  );

  const menuCtx = useMemo(
    () => ({ variant: "menu", anchorEl, closeMenu, onItemClick }),
    [anchorEl, closeMenu, onItemClick]
  );

  const items = shortcutKeys
    .filter((key) => layoutKeys.has(key))
    .map((key) => COMMANDS_BY_KEY[key])
    .filter(Boolean)
    .map((command) => toSlotItem(command, ctx, deps));

  const open = Boolean(anchorPosition && anchorEl);

  // handlers

  function handleOpenDialog() {
    closeMenu();
    dispatch(setShortcutsDialogOpen(true));
  }

  // render

  return (
    <>
      <Portal>
        {lastPosition && (
          <Box
            ref={setAnchorEl}
            sx={{
              position: "fixed",
              left: lastPosition.x,
              top: lastPosition.y,
              width: 1,
              height: 1,
              pointerEvents: "none",
            }}
          />
        )}
      </Portal>
      <Menu
        open={open}
        anchorEl={anchorEl}
        onClose={closeMenu}
        keepMounted
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { sx: { minWidth: 240, maxHeight: 480 } } }}
      >
        {hasOpened ? (
          <CommandMenuContext.Provider value={menuCtx}>
            {items.map((item) => (
              <CommandSlot key={item.key} item={item} ctx={ctx} deps={deps} />
            ))}
            {items.length > 0 && <Divider sx={{ my: 0.5 }} />}
            <MenuItem dense onClick={handleOpenDialog}>
              <ListItemIcon
                sx={{ minWidth: 32, "& .MuiSvgIcon-root": { fontSize: 18 } }}
              >
                <IconRightClickShortcut />
              </ListItemIcon>
              <ListItemText
                primary={configureS}
                slotProps={{ primary: { variant: "body2" } }}
              />
            </MenuItem>
          </CommandMenuContext.Provider>
        ) : null}
      </Menu>
    </>
  );
}
