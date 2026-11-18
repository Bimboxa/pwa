import { useDispatch } from "react-redux";

import { setSelectedItems } from "Features/selection/selectionSlice";

import { withUndoGroup } from "App/db/undoManager";
import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import explodeComponentService from "Features/annotationComponents/services/explodeComponentService";

import CommandButton from "../../components/CommandButton";
import { getExplodeComponentTargets } from "./explodeComponentCommand";

// Toolbar button of « Éclater le composant » (commandsToolbar): detaches the
// generated annotations of the selected components, deletes the components
// and selects the freed annotations — one undo step.
export default function ButtonExplodeComponent({
  command,
  ctx,
  state,
  hotkeyLabel,
}) {
  const dispatch = useDispatch();

  // data

  const deleteAnnotations = useDeleteAnnotations();

  // handlers

  async function handleClick() {
    const sourceIds = getExplodeComponentTargets(ctx).map((a) => a.id);
    if (sourceIds.length === 0) return;
    try {
      let detached = [];
      await withUndoGroup(async () => {
        detached = await explodeComponentService({ sourceIds });
        if (detached.length === 0) return;
        // the children are detached: the cascade only takes the sources
        await deleteAnnotations(sourceIds);
      });
      if (detached.length === 0) return;
      dispatch(
        setSelectedItems(
          detached.map((a) => ({
            id: a.id,
            nodeId: a.id,
            type: "NODE",
            nodeType: "ANNOTATION",
            annotationType: a.type,
            listingId: a.listingId,
            annotationTemplateId: a.annotationTemplateId,
            pointId: null,
            partId: null,
            partType: null,
          }))
        )
      );
    } catch (e) {
      console.error("[explodeComponent]", e);
    }
  }

  // render

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={state}
      onClick={handleClick}
    />
  );
}
