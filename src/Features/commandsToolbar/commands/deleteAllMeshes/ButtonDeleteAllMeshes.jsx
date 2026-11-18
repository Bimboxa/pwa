import { useState } from "react";

import { useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import DialogDeleteRessource from "Features/layout/components/DialogDeleteRessource";
import deleteAllMeshes3dService, {
  getLiveMeshes3dIds,
} from "Features/threedMesh/services/deleteAllMeshes3dService";

import CommandButton from "../../components/CommandButton";

// Button of « Supprimer toutes les mailles »: counts the mailles of the
// scope, asks for a confirmation, then deletes them in one write
// (deleteAllMeshes3dService — soft delete, one undo step).
export default function ButtonDeleteAllMeshes({
  command,
  deps,
  state,
  hotkeyLabel,
}) {
  // strings

  const busyS = "Suppression des mailles en cours";
  const noneS = "Aucune maille à supprimer";
  const errorS = "Suppression des mailles impossible";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [busy, setBusy] = useState(false);
  // Number of mailles to delete while the confirmation dialog is open.
  const [pendingCount, setPendingCount] = useState(0);

  // helpers

  const buttonState =
    state?.enabled && busy ? { enabled: false, reason: busyS } : state;
  const messageS =
    pendingCount > 1
      ? `Supprimer les ${pendingCount} mailles du plan de repérage ?`
      : "Supprimer la maille du plan de repérage ?";

  // handlers

  async function handleClick() {
    const ids = await getLiveMeshes3dIds({ projectId, scopeId });
    if (!ids.length) {
      deps.dispatch(setToaster({ message: noneS, severity: "warning" }));
      return;
    }
    setPendingCount(ids.length);
  }

  async function handleConfirm() {
    setPendingCount(0);
    setBusy(true);
    try {
      const deleted = await deleteAllMeshes3dService({ projectId, scopeId });
      // The selected mailles are gone.
      deps.dispatch(clearSelection());
      const plural = deleted > 1 ? "s" : "";
      deps.dispatch(
        setToaster({
          message: `${deleted} maille${plural} supprimée${plural}`,
          severity: "success",
        })
      );
    } catch (err) {
      console.error("[threedMesh] delete all meshes failed", err);
      deps.dispatch(setToaster({ message: errorS, severity: "error" }));
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <>
      <CommandButton
        commandKey={command.key}
        label={command.label}
        Icon={command.Icon}
        hotkeyLabel={hotkeyLabel}
        state={buttonState}
        onClick={handleClick}
      />
      <DialogDeleteRessource
        open={pendingCount > 0}
        onClose={() => setPendingCount(0)}
        onConfirmAsync={handleConfirm}
        message={messageS}
      />
    </>
  );
}
