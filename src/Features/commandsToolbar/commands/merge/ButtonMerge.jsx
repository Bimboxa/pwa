import { useRef } from "react";
import { useDispatch } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import {
  clearSelection,
  setSelectedItem,
} from "Features/selection/selectionSlice";
import { setSelectedNode } from "Features/mapEditor/mapEditorSlice";

import useDeleteAnnotations from "Features/annotations/hooks/useDeleteAnnotations";
import useMergeAnnotations from "Features/annotations/hooks/useMergeAnnotations";
import mergeAnnotationsToMeshService from "Features/threedMergeFaces/services/mergeAnnotationsToMeshService";
import {
  getMergeAnnotationsRefusedMessage,
  MERGE_ANNOTATIONS_DONE_MESSAGE,
} from "Features/threedMergeFaces/utils/mergeFacesMessages";

import CommandButton from "../../components/CommandButton";
import { getMergeTarget, MERGE_MODES } from "./resolveMergeSelection";

export default function ButtonMerge({
  command,
  ctx,
  state,
  hotkeyLabel,
  deps,
}) {
  const dispatch = useDispatch();
  const mergeAnnotations = useMergeAnnotations();
  const deleteAnnotations = useDeleteAnnotations();
  const busyRef = useRef(false);

  // helpers

  function toast(message, isError = true) {
    dispatch(setToaster({ message, isError }));
  }

  // The merged annotation stays selected (whole annotation: the mesh write
  // renumbered its faces and cleared the part selection).
  function selectSeed(seed) {
    const node = {
      id: seed.id,
      nodeId: seed.id,
      nodeType: "ANNOTATION",
      annotationType: seed.type,
      listingId: seed.listingId,
    };
    dispatch(setSelectedNode(node));
    dispatch(
      setSelectedItem({
        ...node,
        type: "NODE",
        annotationTemplateId: seed.annotationTemplateId,
      })
    );
  }

  // handlers

  async function handleClick() {
    if (busyRef.current) return;
    const target = getMergeTarget(ctx);
    if (!target) return;
    busyRef.current = true;
    try {
      if (target.mode === MERGE_MODES.TWO_D) {
        await mergeAnnotations(target.annotations, { shape: target.shape });
        dispatch(clearSelection());
        return;
      }
      const result = await mergeAnnotationsToMeshService({
        annotationIds: target.annotations.map((a) => a.id),
        editor: deps?.getThreedEditor?.(),
        dispatch,
        deleteAnnotationsFn: deleteAnnotations,
      });
      if (result.status !== "done") {
        toast(getMergeAnnotationsRefusedMessage(result.reason));
        return;
      }
      selectSeed(result.annotation);
      toast(MERGE_ANNOTATIONS_DONE_MESSAGE, false);
    } catch (error) {
      console.error("[commandsToolbar] merge failed", error);
      toast(getMergeAnnotationsRefusedMessage("FAILED"));
    } finally {
      busyRef.current = false;
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
