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
// cross (createMeshesFromCutLinesService). Disabled while no cut line is
// rendered, and while a creation is running.
export default function ButtonCreateMeshes({
  command,
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

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  let buttonState = state;
  if (state?.enabled && busy) {
    buttonState = { enabled: false, reason: busyS };
  } else if (state?.enabled && !hasCutLines) {
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
        });
      const parts = [
        `${created} maille${created > 1 ? "s" : ""} créée${created > 1 ? "s" : ""}`,
      ];
      if (skippedCovered)
        parts.push(
          `${skippedCovered} déjà maillée${skippedCovered > 1 ? "s" : ""}`
        );
      if (!facesCut) parts.push("aucune face traversée");
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
