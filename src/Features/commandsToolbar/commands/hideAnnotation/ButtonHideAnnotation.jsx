import { useState } from "react";

import { useSelector } from "react-redux";

import { setEnabledDrawingMode } from "Features/mapEditor/mapEditorSlice";
import {
  clearItemPartSelection,
  clearSelection,
} from "Features/selection/selectionSlice";
import {
  hideAnnotations,
  hideMesh3dFaces,
  selectHiddenRegistryCount,
} from "Features/hiddenAnnotations/hiddenAnnotationsSlice";

import { Box, IconButton, Tooltip } from "@mui/material";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

import CommandButton from "../../components/CommandButton";
import { useCommandMenu } from "../../components/CommandMenuContext";
import PopoverHiddenAnnotations from "./PopoverHiddenAnnotations";

import { hasCarvedSolid } from "Features/threedEditor/js/utilsAnnotationsManager/getSolidMeshFromObject3D";
import { HIDE_ANNOTATION_MODE } from "./hideAnnotationMode";
import resolveHideSelection from "./resolveHideSelection";

// Button of « Masquer l'annotation » (commandsToolbar):
// - a selection exists: the click hides it right away (the selected faces of
//   a mesh annotation, else the selected annotations) and drops it from the
//   selection — a hidden item must not stay selected;
// - no selection: the click toggles the HIDE_ANNOTATION pick mode.
// In the toolbar row a small arrow opens the registry of the hidden items
// (PopoverHiddenAnnotations); in a menu (right-click shortcuts) only the
// action is offered.
export default function ButtonHideAnnotation({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  const menu = useCommandMenu();
  const isMenu = menu?.variant === "menu";

  // strings

  const registryS = "Éléments masqués";

  // data

  const hiddenCount = useSelector(selectHiddenRegistryCount);

  // state

  const [rootEl, setRootEl] = useState(null);
  const [open, setOpen] = useState(false);

  // helpers

  // A mesh carved live by a subtraction: its part indices address the carved
  // solid, not the stored faces.
  function isCarved(annotationId) {
    const object =
      deps.getThreedEditor?.()?.sceneManager?.annotationsManager
        ?.annotationsObjectsMap?.[annotationId];
    return object ? hasCarvedSolid(object) : false;
  }

  // handlers

  function handleClick() {
    if (ctx.enabledDrawingMode === HIDE_ANNOTATION_MODE) {
      deps.dispatch(setEnabledDrawingMode(null));
      return;
    }
    const target = resolveHideSelection(ctx, { isCarved });
    if (target?.faces) {
      deps.dispatch(hideMesh3dFaces(target.faces));
      deps.dispatch(clearItemPartSelection(ctx.selectedItems[0].id));
      return;
    }
    if (target?.annotationIds) {
      deps.dispatch(hideAnnotations(target.annotationIds));
      deps.dispatch(clearSelection());
      return;
    }
    deps.dispatch(setEnabledDrawingMode(HIDE_ANNOTATION_MODE));
  }

  // render

  const button = (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={handleClick}
    />
  );

  if (isMenu) return button;

  return (
    <Box
      ref={setRootEl}
      sx={{ display: "inline-flex", alignItems: "center", flexShrink: 0 }}
    >
      {button}
      <Tooltip
        title={hiddenCount > 0 ? `${registryS} (${hiddenCount})` : registryS}
        enterDelay={400}
      >
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          sx={{
            p: 0,
            ml: "-6px",
            width: 14,
            height: 30,
            borderRadius: "4px",
            // tinted while something is hidden: the scene is not complete
            color: open || hiddenCount > 0 ? "secondary.main" : "text.disabled",
            "& .MuiSvgIcon-root": { fontSize: 16 },
          }}
        >
          <ArrowDropDownIcon />
        </IconButton>
      </Tooltip>
      <PopoverHiddenAnnotations
        open={open}
        anchorEl={rootEl}
        onClose={() => setOpen(false)}
      />
    </Box>
  );
}
