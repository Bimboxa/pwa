import { useState } from "react";

import { useDispatch, useSelector } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerBaseMapsUpdate } from "Features/baseMaps/baseMapsSlice";
import { setToaster } from "Features/layout/layoutSlice";
import { setBaseMapClippingIn3d } from "Features/threedEditor/threedEditorSlice";

import { Box, CircularProgress, Switch, Typography } from "@mui/material";

import db from "App/db/db";

import WhiteSectionGeneric from "Features/form/components/WhiteSectionGeneric";
import ButtonGeneric from "Features/layout/components/ButtonGeneric";
import FieldMeasure from "Features/threedEditor/components/FieldMeasure";

import getBaseMapClipping3d from "../utils/getBaseMapClipping3d";
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
// clouds are cut to a slab around it (depths in front / behind, stored on
// the base map). The switch ENABLES the feature for this base map (stored
// too): its row of the base maps list then shows the scissors button, which
// turns the cut itself on / off (session state) — and « Vectoriser la coupe », which draws
// on the base map the lines the point cloud leaves in its plane.
export default function SectionBaseMapClipping3d({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const titleS = "Plan de coupe";
  const captionS =
    "Les ciseaux de la liste des fonds de plan activent la coupe : les annotations et le nuage de points sont masqués hors de la tranche. Champ vide : pas de limite de ce côté.";
  const frontS = "Devant";
  const backS = "Derrière";
  const toleranceS = "Épaisseur de coupe ±";
  const vectorizeS = "Vectoriser la coupe";
  const vectorizeCaptionS =
    "Trace sur le fond de plan les lignes laissées par le nuage de points dans son plan (annotations sans modèle).";
  const noScopeS = "Sélectionnez un Krto pour vectoriser la coupe.";
  const resultMessages = {
    NO_SCALE: "Ce fond de plan n'a pas d'échelle.",
    NO_CLOUD: "Aucun nuage de points disponible dans ce projet.",
    NO_POINT:
      "Aucun point du nuage dans le plan de ce fond de plan : augmentez l'épaisseur de coupe.",
    NO_LINE: "Aucune ligne détectée dans la coupe.",
  };
  const errorS = "La vectorisation a échoué.";

  // data

  const scopeId = useSelector((s) => s.scopes.selectedScopeId);

  // state

  const [vectorizing, setVectorizing] = useState(false);

  // helpers

  const { enabled, frontM, backM, toleranceM } = getBaseMapClipping3d(baseMap);
  const depthText = (value) => (value === null ? "" : String(value));
  // cm, without float noise (0.01 m → "1")
  const toleranceCmText = String(Math.round(toleranceM * 1000) / 10);

  // handlers

  async function updateClipping3d(patch) {
    if (!baseMap?.id) return;
    await db.baseMaps.update(baseMap.id, {
      clipping3d: { enabled, frontM, backM, toleranceM, ...patch },
    });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerBaseMapsUpdate());
  }

  // Enabling the feature shows the scissors button of the base maps list
  // and arms the cut right away; disabling it drops both.
  async function handleEnabledChange(e) {
    const on = e.target.checked;
    await updateClipping3d({ enabled: on });
    dispatch(setBaseMapClippingIn3d({ baseMapId: baseMap.id, on }));
  }

  function handleDepthCommit(key, text) {
    const value = parseDepth(text);
    if (value === undefined) return;
    if (value === (key === "frontM" ? frontM : backM)) return;
    updateClipping3d({ [key]: value });
  }

  function handleToleranceCommit(text) {
    const cm = parseDepth(text);
    if (!(cm > 0)) return;
    const next = cm / 100;
    if (next === toleranceM) return;
    updateClipping3d({ toleranceM: next });
  }

  async function handleVectorize() {
    if (vectorizing || !baseMap?.id) return;
    setVectorizing(true);
    try {
      const result = await vectorizeBaseMapSectionService({
        baseMap,
        toleranceM,
        scopeId,
        dispatch,
      });
      if (result.status === "OK") {
        const n = result.annotationCount;
        dispatch(
          setToaster({
            message: `${n} ligne${n > 1 ? "s" : ""} tracée${n > 1 ? "s" : ""} sur le fond de plan.`,
            severity: "success",
          })
        );
      } else {
        dispatch(
          setToaster({
            message: resultMessages[result.status] ?? errorS,
            severity: "warning",
          })
        );
      }
    } catch (error) {
      console.error("[baseMapClipping] vectorization failed", error);
      dispatch(setToaster({ message: errorS, isError: true }));
    } finally {
      setVectorizing(false);
    }
  }

  // render

  if (!baseMap || baseMap.isPhoto) return null;

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
        </Box>
      )}

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
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <FieldMeasure
            label={toleranceS}
            value={toleranceCmText}
            onCommit={handleToleranceCommit}
            unit="cm"
            width={44}
          />
          <ButtonGeneric
            label={vectorizeS}
            size="small"
            variant="contained"
            color="secondary"
            disabled={vectorizing || !scopeId}
            startIcon={
              vectorizing ? (
                <CircularProgress size={14} color="inherit" />
              ) : null
            }
            onClick={handleVectorize}
          />
        </Box>
        <Typography variant="caption" color="text.secondary">
          {scopeId ? vectorizeCaptionS : noScopeS}
        </Typography>
      </Box>
    </WhiteSectionGeneric>
  );
}
