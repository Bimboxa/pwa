import { useState } from "react";

import { useSelector } from "react-redux";

import { setToaster } from "Features/layout/layoutSlice";
import { clearSelection } from "Features/selection/selectionSlice";

import { getCutLinesWorldPolylines } from "Features/threedCutLines/services/cutLineObjectsStore";
import mergeAdjacentMeshes3dService from "Features/threedMesh/services/mergeAdjacentMeshes3dService";

import CommandButton from "../../components/CommandButton";

// Button of « Fusionner les mailles adjacentes »: merges the mailles of the
// scope that no rendered cut line separates (mergeAdjacentMeshes3dService).
// With a selection, only the selected mailles — or the mailles created from
// the selected annotations — are merged. Disabled while a merge is running.
export default function ButtonMergeAdjacentMeshes({
  command,
  ctx,
  deps,
  state,
  hotkeyLabel,
}) {
  // strings

  const busyS = "Fusion des mailles en cours";
  const noneS = "Aucune maille adjacente à fusionner";
  const errorS = "Fusion des mailles impossible";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [busy, setBusy] = useState(false);

  // helpers

  // Selection scope: the selected mailles (MESH3D nodes), or the mailles of
  // the selected annotations.
  const meshIds = ctx.selectedItems
    .filter((item) => item?.type === "NODE" && item?.nodeType === "MESH3D")
    .map((item) => item.nodeId);
  const annotationIds = ctx.selectedAnnotationIds;

  const buttonState =
    state?.enabled && busy ? { enabled: false, reason: busyS } : state;

  // handlers

  async function handleClick() {
    setBusy(true);
    try {
      const { groups, removedIds } = await mergeAdjacentMeshes3dService({
        projectId,
        scopeId,
        cutLines: getCutLinesWorldPolylines().map((line) => line.points),
        meshIds,
        annotationIds,
      });
      if (!groups) {
        deps.dispatch(setToaster({ message: noneS, severity: "warning" }));
        return;
      }
      // The absorbed mailles may be selected: their ids are gone (a
      // selection of annotations only stays).
      if (meshIds.length || !annotationIds.length) {
        deps.dispatch(clearSelection());
      }
      const count = removedIds.length + groups;
      deps.dispatch(
        setToaster({
          message: `${count} mailles fusionnées en ${groups}`,
          severity: "success",
        })
      );
    } catch (err) {
      console.error("[threedMesh] merge adjacent meshes failed", err);
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
