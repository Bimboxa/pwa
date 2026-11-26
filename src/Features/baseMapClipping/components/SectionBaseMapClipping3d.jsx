import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { setToaster } from "Features/layout/layoutSlice";
import {
  setBaseMapClipBoxShownIn3d,
  setBaseMapClippingIn3d,
} from "Features/threedEditor/threedEditorSlice";

import { Box, CircularProgress, Switch, Typography } from "@mui/material";

import { Vector3 } from "three";

import db from "App/db/db";

import useCreateBaseMapVersion from "Features/baseMaps/hooks/useCreateBaseMapVersion";
import getBaseMapNormalWorldFromRow from "Features/baseMaps/js/getBaseMapNormalWorldFromRow";
import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldMeasure from "Features/threedEditor/components/FieldMeasure";
import { getActiveThreedEditor } from "Features/threedEditor/services/threedEditorRegistry";

import getBaseMapClipping3d from "../utils/getBaseMapClipping3d";
import getVisibleClipLayerRange from "../utils/getVisibleClipLayerRange";
import rasterizeBaseMapSectionService from "../services/rasterizeBaseMapSectionService";
import vectorizeBaseMapSectionService from "../services/vectorizeBaseMapSectionService";

// "12.5" / "12,5" → 12.5; "" → null (no limit); anything else → undefined.
function parseDepth(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;
  const value = Number(trimmed.replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

// « Plan de coupe » section of the base map properties (3D editor): the base
// map as a clipping plane of the 3D scene — the annotations and the point
// clouds are cut to a box around it (depths in front / behind, stored on the
// base map).
//   - The title switch ENABLES the feature for this base map (stored too):
//     its row of the base maps list then shows the scissors button, which
//     turns the cut itself on / off (session state).
//   - « Afficher la boîte de coupe » draws the two faces of the box in 3D,
//     with their drag handles (ThreedBaseMapClipBoxes).
//   - « Vectoriser » / « Rasteriser » work on what is seen on screen: the
//     layer of the box on the camera side of the base map (front layer when
//     its front face is looked at, back layer otherwise) is drawn on the
//     base map as polylines, or printed as a new version of its image.
export default function SectionBaseMapClipping3d({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Plan de coupe";
  const showBoxS = "Afficher la boîte de coupe";
  const captionS =
    "Les ciseaux de la liste des fonds de plan activent la coupe : les annotations et le nuage de points sont masqués hors de la boîte. Champ vide : pas de limite de ce côté.";
  const frontS = "Devant";
  const backS = "Derrière";
  const vectorizeS = "Vectoriser";
  const rasterizeS = "Rasteriser";
  const actionsCaptionS =
    "À partir de la couche visible à l'écran (devant ou derrière le fond de plan, selon le côté regardé) : « Vectoriser » trace les lignes du nuage de points (annotations sans modèle), « Rasteriser » l'imprime dans une nouvelle version de l'image.";
  const noScopeS = "Sélectionnez un Krto pour vectoriser la coupe.";
  const versionLabelS = "Coupe rasterisée";
  const rasterizedS = "Nuage de points imprimé dans une nouvelle version.";
  const resultMessages = {
    NO_SCALE: "Ce fond de plan n'a pas d'échelle.",
    NO_CLOUD: "Aucun nuage de points disponible dans ce projet.",
    NO_POINT:
      "Aucun point du nuage dans la couche visible : augmentez la profondeur de la boîte de coupe.",
    NO_LINE: "Aucune ligne détectée dans la coupe.",
  };
  const errorS = "L'opération a échoué.";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);
  const clipBoxIds = useSelector((s) => s.threedEditor.clipBoxBaseMapIdsIn3d);
  const createBaseMapVersion = useCreateBaseMapVersion();

  // state

  // null | "VECTORIZE" | "RASTERIZE"
  const [running, setRunning] = useState(null);

  // helpers

  const clipping = getBaseMapClipping3d(baseMap);
  const { enabled, frontM, backM } = clipping;
  const boxShown = Boolean(baseMap?.id) && clipBoxIds.includes(baseMap.id);
  const depthText = (value) => (value === null ? "" : String(value));

  // Layer of the box seen from the camera, read at click time.
  function getVisibleRange() {
    const camera = getActiveThreedEditor()?.sceneManager?.camera;
    const n = getBaseMapNormalWorldFromRow(baseMap);
    const view = camera?.getWorldDirection(new Vector3());
    const viewDotNormal = view
      ? view.x * n.x + view.y * n.y + view.z * n.z
      : -1;
    return getVisibleClipLayerRange(clipping, viewDotNormal);
  }

  // handlers

  async function updateClipping3d(patch) {
    if (!baseMap?.id) return;
    await db.baseMaps.update(baseMap.id, {
      clipping3d: { enabled, frontM, backM, ...patch },
    });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerBaseMapsUpdate());
  }

  // Enabling the feature shows the scissors button of the base maps list
  // and arms the cut right away; disabling it drops both (and the box).
  async function handleEnabledChange(e) {
    const on = e.target.checked;
    await updateClipping3d({ enabled: on });
    dispatch(setBaseMapClippingIn3d({ baseMapId: baseMap.id, on }));
    if (!on) {
      dispatch(
        setBaseMapClipBoxShownIn3d({ baseMapId: baseMap.id, shown: false })
      );
    }
  }

  function handleBoxShownChange(e) {
    dispatch(
      setBaseMapClipBoxShownIn3d({
        baseMapId: baseMap.id,
        shown: e.target.checked,
      })
    );
  }

  function handleDepthCommit(key, text) {
    const value = parseDepth(text);
    if (value === undefined) return;
    if (value === (key === "frontM" ? frontM : backM)) return;
    updateClipping3d({ [key]: value });
  }

  // Runs one of the two actions on the visible layer, with its toasts.
  async function run(kind, action, getSuccessMessage) {
    if (running || !baseMap?.id) return;
    setRunning(kind);
    try {
      const result = await action(getVisibleRange());
      dispatch(
        result.status === "OK"
          ? setToaster({
              message: getSuccessMessage(result),
              severity: "success",
            })
          : setToaster({
              message: resultMessages[result.status] ?? errorS,
              severity: "warning",
            })
      );
    } catch (error) {
      console.error("[baseMapClipping] action failed", kind, error);
      dispatch(setToaster({ message: errorS, isError: true }));
    } finally {
      setRunning(null);
    }
  }

  function handleVectorize() {
    run(
      "VECTORIZE",
      (range) =>
        vectorizeBaseMapSectionService({ baseMap, range, scopeId, dispatch }),
      ({ annotationCount: n }) =>
        `${n} ligne${n > 1 ? "s" : ""} tracée${n > 1 ? "s" : ""} sur le fond de plan.`
    );
  }

  function handleRasterize() {
    run(
      "RASTERIZE",
      async (range) => {
        const result = await rasterizeBaseMapSectionService({
          baseMap,
          range,
          label: versionLabelS,
          createBaseMapVersionFn: createBaseMapVersion,
        });
        if (result.status === "OK") {
          dispatch(triggerEntitiesTableUpdate("baseMaps"));
          dispatch(triggerBaseMapsUpdate());
        }
        return result;
      },
      () => rasterizedS
    );
  }

  // render

  if (!baseMap || baseMap.isPhoto) return null;

  const spinner = <CircularProgress size={14} color="inherit" />;

  return (
    <WhiteSectionGeneric>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: "bold", flex: 1 }}>
          {titleS}
        </Typography>
        <Switch size="small" checked={enabled} onChange={handleEnabledChange} />
      </Box>

      {enabled && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {showBoxS}
            </Typography>
            <Switch
              size="small"
              checked={boxShown}
              onChange={handleBoxShownChange}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <FieldMeasure
              label={frontS}
              value={depthText(frontM)}
              onCommit={(text) => handleDepthCommit("frontM", text)}
              width={56}
            />
            <FieldMeasure
              label={backS}
              value={depthText(backM)}
              onCommit={(text) => handleDepthCommit("backM", text)}
              width={56}
            />
          </Box>
          <Typography variant="caption" color="text.secondary">
            {captionS}
          </Typography>

          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 0.5,
              mt: 1,
              pt: 1,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ButtonGeneric
                label={vectorizeS}
                size="small"
                variant="contained"
                color="secondary"
                fullWidth
                disabled={Boolean(running) || !scopeId}
                startIcon={running === "VECTORIZE" ? spinner : null}
                onClick={handleVectorize}
              />
              <ButtonGeneric
                label={rasterizeS}
                size="small"
                variant="contained"
                color="secondary"
                fullWidth
                disabled={Boolean(running)}
                startIcon={running === "RASTERIZE" ? spinner : null}
                onClick={handleRasterize}
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              {scopeId ? actionsCaptionS : noScopeS}
            </Typography>
          </Box>
        </Box>
      )}
    </WhiteSectionGeneric>
  );
}
