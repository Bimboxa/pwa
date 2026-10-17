import { useState } from "react";

import getAnnotationColor from "Features/annotations/utils/getAnnotationColor";

import CommandButton from "../../components/CommandButton";
import CloneAnnotationFlow from "./CloneAnnotationFlow";
import MenuCloneAnnotations from "./MenuCloneAnnotations";
import { getTargets } from "../../utils/selectionCommandState";

// Toolbar button of « Dupliquer » (commandsToolbar) + its flow: the single
// annotation flow (menu or wall-piece chooser) or the multi-selection menu.
// The flow (and its templates hooks) is mounted on the first click only and
// keyed on the selection so it resets with it.
export default function ButtonClone({ command, ctx, state, hotkeyLabel }) {
  // state

  const [anchorEl, setAnchorEl] = useState(null);
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  // helpers

  const targets = getTargets(ctx);
  const isSingle = ctx.selectedAnnotations.length === 1;
  const selectionKey = ctx.selectedAnnotationIds.join("|");

  // handlers

  function handleOpen(event, anchor) {
    setAnchorEl(anchor);
    setHasOpened(true);
    setOpen(true);
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={{ ...state, active: open }}
        onClick={handleOpen}
      />
      {hasOpened && isSingle && ctx.selectedAnnotation && (
        <CloneAnnotationFlow
          key={selectionKey}
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={anchorEl}
          accentColor={getAnnotationColor(ctx.selectedAnnotation) || "#6366F1"}
          selectedAnnotation={ctx.selectedAnnotation}
          selectedPart={ctx.selectedPart}
        />
      )}
      {hasOpened && !isSingle && targets.length > 0 && (
        <MenuCloneAnnotations
          key={selectionKey}
          open={open}
          onClose={() => setOpen(false)}
          anchorEl={anchorEl}
          annotations={targets}
        />
      )}
    </>
  );
}
