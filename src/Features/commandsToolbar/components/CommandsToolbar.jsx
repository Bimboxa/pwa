import { useCallback, useMemo, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { Box, Divider, Paper } from "@mui/material";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";

import {
  selectCommandsToolbarLastUsedByGroup,
  selectCommandsToolbarPosition,
  setCommandsToolbarLastUsed,
} from "../commandsToolbarSlice";

import CommandGroupButton from "./CommandGroupButton";
import CommandSlot from "./CommandSlot";
import { COMMANDS_BY_KEY } from "../commands";
import getToolbarLayout from "../constants/toolbarLayout";
import useCommandsContext from "../hooks/useCommandsContext";
import useCommandsHotkeys from "../hooks/useCommandsHotkeys";
import useToolbarDockDrag from "../hooks/useToolbarDockDrag";
import getCommandState from "../utils/getCommandState";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

// Floating toolbar: wraps on several lines up to this width.
const FLOATING_MAX_WIDTH = 640;

// Hotkey badge of a command for the displayed editor (none when the letter
// belongs to another editor — « E » Évider 2D / Extruder 3D).
function getHotkeyLabel(command, ctx) {
  const hotkey = command.hotkey;
  if (!hotkey?.key) return null;
  if (hotkey.editors && !hotkey.editors.includes(ctx.editor)) return null;
  // A letter shared by several commands (D = the last-used « Dessin » type)
  // is badged on the one that would fire.
  if (hotkey.showBadgeWhen && !hotkey.showBadgeWhen(ctx)) return null;
  return hotkey.key.toUpperCase();
}

// One slot item of a command: what CommandSlot / CommandGroupButton render.
function toSlotItem(command, ctx, deps) {
  return {
    key: command.key,
    command,
    label: command.label,
    Icon: command.Icon,
    icon: command.icon,
    hotkeyLabel: getHotkeyLabel(command, ctx),
    state: getCommandState(command, ctx),
    Button: command.Button,
    run: () => command.run?.(ctx, deps),
  };
}

// ---------------------------------------------------------------------------
// CommandsToolbar — the single toolbar gathering every annotation command of
// the 2D map editor and the 3D editor (one button + tooltip per command,
// irrelevant commands disabled, never hidden). Rendered once by SectionViewer
// over / beside the editors area:
// - docked (TOP / BOTTOM / LEFT): in-flow strip reserving its space, the
//   editors shrink (SketchUp-like); LEFT is a column wrapping into columns;
// - FLOATING: absolute layer inside the editors area, dragged by its grip,
//   wrapping on several lines; released near an edge it docks there.
// Groups of constants/toolbarLayout.js and commands with variants render as
// split buttons (CommandGroupButton).
// ---------------------------------------------------------------------------
export default function CommandsToolbar({ dock, containerRef }) {
  const dispatch = useDispatch();
  const store = useStore();

  // data

  const position = useSelector(selectCommandsToolbarPosition);
  const lastUsedByGroup = useSelector(selectCommandsToolbarLastUsedByGroup);
  const { ctx, ctxRef } = useCommandsContext({ enabled: true });

  // state

  const toolbarRef = useRef(null);
  const { handleGripMouseDown, livePosition, isDragging, snapDock } =
    useToolbarDockDrag({ dock, position, containerRef, toolbarRef });

  // helpers

  const deps = useMemo(
    () => ({ dispatch, store, getThreedEditor: getActiveThreedEditor }),
    [dispatch, store]
  );

  useCommandsHotkeys({ ctxRef, deps, enabled: true });

  const handleGroupItemClick = useCallback(
    (groupKey) => (commandKey) =>
      dispatch(setCommandsToolbarLastUsed({ groupKey, commandKey })),
    [dispatch]
  );

  const isVertical = dock === "LEFT";
  const isFloating = dock === "FLOATING";

  // render

  function renderEntry(entry, index) {
    if (entry?.type === "divider") {
      return (
        <Divider
          key={`divider-${index}`}
          orientation={isVertical ? "horizontal" : "vertical"}
          flexItem
          sx={isVertical ? { my: 0.5, mx: 0.5 } : { mx: 0.5, my: 0.5 }}
        />
      );
    }

    if (entry?.type === "group") {
      const items = entry.commandKeys
        .map((key) => COMMANDS_BY_KEY[key])
        .filter(Boolean)
        .map((command) => toSlotItem(command, ctx, deps));
      if (items.length === 0) return null;
      const lastUsedKey = lastUsedByGroup[entry.key];
      const primaryItem =
        items.find((item) => item.key === lastUsedKey) ?? items[0];
      return (
        <CommandGroupButton
          key={entry.key}
          label={entry.label}
          items={items}
          primaryItem={primaryItem}
          ctx={ctx}
          deps={deps}
          onItemClick={handleGroupItemClick(entry.key)}
        />
      );
    }

    const command = COMMANDS_BY_KEY[entry];
    if (!command) return null;
    const item = toSlotItem(command, ctx, deps);

    if (command.variants) {
      const activeVariant = command.getActiveVariant?.(ctx) ?? null;
      const variantItems = (command.variants(ctx) ?? []).map((variant) => ({
        key: variant.key,
        label: variant.label,
        Icon: variant.Icon,
        icon: variant.icon,
        state: {
          ...item.state,
          active: Boolean(
            item.state.active && activeVariant?.key === variant.key
          ),
        },
        run: () => command.run?.(ctx, deps, variant.key),
      }));
      const primaryItem = {
        ...item,
        Icon: activeVariant?.Icon ?? command.Icon,
        icon: activeVariant?.Icon ? undefined : activeVariant?.icon,
        label: activeVariant
          ? `${command.label} — ${activeVariant.label}`
          : command.label,
      };
      return (
        <CommandGroupButton
          key={command.key}
          label={command.label}
          items={variantItems}
          primaryItem={primaryItem}
          ctx={ctx}
          deps={deps}
        />
      );
    }

    return <CommandSlot key={command.key} item={item} ctx={ctx} deps={deps} />;
  }

  const grip = (
    <Box
      onMouseDown={handleGripMouseDown}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isDragging ? "grabbing" : "grab",
        color: "text.disabled",
        px: isVertical ? 0 : 0.25,
        py: isVertical ? 0.25 : 0,
        alignSelf: "stretch",
        "&:hover": { color: "text.secondary" },
        "& .MuiSvgIcon-root": {
          fontSize: 18,
          transform: isVertical ? "rotate(90deg)" : "none",
        },
      }}
    >
      <DragIndicatorIcon />
    </Box>
  );

  const dockedSx = isVertical
    ? {
        height: 1,
        maxHeight: 1,
        flexDirection: "column",
        flexWrap: "wrap",
        alignContent: "flex-start",
        px: 0.5,
        py: 0.5,
        borderRight: "1px solid",
        borderColor: "divider",
      }
    : {
        width: 1,
        flexDirection: "row",
        flexWrap: "wrap",
        px: 0.5,
        py: 0.25,
        ...(dock === "TOP"
          ? { borderBottom: "1px solid", borderColor: "divider" }
          : { borderTop: "1px solid", borderColor: "divider" }),
      };

  const floatingSx = {
    position: "absolute",
    left: 0,
    top: 0,
    transform: `translate(${livePosition.x}px, ${livePosition.y}px)`,
    transition: isDragging ? "none" : "transform 0.1s",
    zIndex: 1,
    maxWidth: FLOATING_MAX_WIDTH,
    flexDirection: "row",
    flexWrap: "wrap",
    px: 0.5,
    py: 0.25,
    borderRadius: "10px",
  };

  return (
    <>
      <Paper
        ref={toolbarRef}
        data-capture-hide
        elevation={isFloating ? 4 : 0}
        square={!isFloating}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          flexShrink: 0,
          boxSizing: "border-box",
          bgcolor: "background.paper",
          userSelect: "none",
          ...(isFloating ? floatingSx : dockedSx),
        }}
      >
        {grip}
        {getToolbarLayout(ctx.viewerKey).map(renderEntry)}
      </Paper>
      {/* Dock preview while dragging near an edge */}
      {isDragging && snapDock && (
        <Box
          sx={{
            position: "absolute",
            pointerEvents: "none",
            zIndex: 2,
            bgcolor: "primary.main",
            opacity: 0.18,
            ...(snapDock === "TOP" && {
              top: 0,
              left: 0,
              right: 0,
              height: 40,
            }),
            ...(snapDock === "BOTTOM" && {
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
            }),
            ...(snapDock === "LEFT" && {
              top: 0,
              bottom: 0,
              left: 0,
              width: 40,
            }),
          }}
        />
      )}
    </>
  );
}
