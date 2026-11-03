import { useState, useSyncExternalStore } from "react";

import { useDispatch, useSelector } from "react-redux";

import { Button, Tooltip } from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";

import { setToaster } from "Features/layout/layoutSlice";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import createMeshesFromCutLinesService from "../services/createMeshesFromCutLinesService";
import {
  getCutLinesVersion,
  getCutLinesWorldPolylines,
  subscribeCutLineObjects,
} from "../services/cutLineObjectsStore";

// « Créer le maillage » (MeshingToolbarThreed): one maille per piece of the
// faces the cut lines cross (createMeshesFromCutLinesService). Disabled
// while no cut line is rendered.
export default function ButtonCreateMeshesFromCutLines() {
  const dispatch = useDispatch();

  // strings

  const label = "Créer le maillage";
  const tooltip =
    "Crée une maille par morceau des faces traversées par les lignes de coupe";
  const noneS = "Aucune ligne de coupe visible";

  // data

  const projectId = useSelector((s) => s.projects.selectedProjectId);
  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const angleDeg = useSelector((s) => s.threedEditor.faceSelectionAngleDeg);
  // Re-render when the rendered cut lines change (store version).
  useSyncExternalStore(subscribeCutLineObjects, getCutLinesVersion);
  const hasCutLines = getCutLinesWorldPolylines().length > 0;

  // state

  const [busy, setBusy] = useState(false);

  // handlers

  async function handleClick() {
    const editor = getActiveThreedEditor();
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
      dispatch(
        setToaster({
          message: parts.join(" · "),
          severity: created ? "success" : "warning",
        })
      );
    } catch (err) {
      console.error("[threedCutLines] create meshes failed", err);
      dispatch(
        setToaster({
          message: "Création du maillage impossible",
          severity: "error",
        })
      );
    } finally {
      setBusy(false);
    }
  }

  // render

  return (
    <Tooltip title={hasCutLines ? tooltip : noneS}>
      <span>
        <Button
          size="small"
          variant="outlined"
          startIcon={<GridOnIcon />}
          onClick={handleClick}
          disabled={busy || !hasCutLines}
          sx={{ textTransform: "none", whiteSpace: "nowrap" }}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}
