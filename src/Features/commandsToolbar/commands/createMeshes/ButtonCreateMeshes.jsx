import { useState, useSyncExternalStore } from "react";

import { useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";

import createMeshesFromCutLinesService from "Features/threedCutLines/services/createMeshesFromCutLinesService";
import {
  getCutLinesVersion,
  getCutLinesWorldPolylines,
  subscribeCutLineObjects,
} from "Features/threedCutLines/services/cutLineObjectsStore";

import CommandButton from "../../components/CommandButton";

// Button of « Mailler »: one maille per piece of the faces the cut lines
// cross (createMeshesFromCutLinesService). With annotations selected (cut
// lines aside), the run is scoped to them and meshes every face of theirs,
// cut lines or not. Disabled while a creation is running and, without a
// selection, while no cut line is rendered.
export default function ButtonCreateMeshes({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  // strings

  const noneS = "Aucune ligne de coupe visible";
  const busyS = "Création du maillage en cours";
  const errorS = "Création du maillage impossible";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const angleDeg = useSelector((s) => s.threedEditor.faceSelectionAngleDeg);
  // Re-render when the rendered cut lines change (store version).
  useSyncExternalStore(subscribeCutLineObjects, getCutLinesVersion);
  const hasCutLines = getCutLinesWorldPolylines().length > 0;
  // Selection scope: the selected annotations, the cut lines left out (they
  // cut, they are not meshed). Falls back on the ids while the annotations
  // query has not resolved them.
  const scopeAnnotationIds = ctx.annotationsLoading
    ? ctx.selectedAnnotationIds
    : ctx.selectedAnnotations
        .filter((a) => a.type !== "CUT_LINE")
        .map((a) => a.id);
  const scoped = scopeAnnotationIds.length > 0;

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  let buttonState = state;
  if (state?.enabled && busy) {
    buttonState = { enabled: false, reason: busyS };
  } else if (state?.enabled && !scoped && !hasCutLines) {
    buttonState = { enabled: false, reason: noneS };
  }

  // handlers

  async function handleClick() {
    const editor = deps.getThreedEditor();
    if (!editor) return;
    setBusy(true);
    try {
      const { created, skippedCovered, facesCut } =
        await createMeshesFromCutLinesService({
          editor,
          projectId,
          scopeId,
          angleDeg,
          annotationIds: scoped ? scopeAnnotationIds : null,
        });
      const parts = [
        `${created} maille${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}`,
      ];
      if (skippedCovered)
        parts.push(
          `${skippedCovered} déjà maillée${skippedCovered > 1 ? "s" : ""}`
        );
      if (!facesCut)
        parts.push(scoped ? "aucune face à mailler" : "aucune face traversée");
      deps.dispatch(
        setToaster({
          message: parts.join(" · "),
          severity: created ? "success" : "warning",
        })
      );
    } catch (err) {
      console.error("[threedCutLines] create meshes failed", err);
      deps.dispatch(setToaster({ message: errorS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <CommandButton
      commandKey={command.key}
      label={command.label}
      Icon={command.Icon}
      hotkeyLabel={hotkeyLabel}
      state={buttonState}
      onClick={handleClick}
    />
  );
}
