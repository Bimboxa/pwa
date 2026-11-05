import { useLiveQuery } from "dexie-react-hooks";
import { useDispatch, useSelector } from "react-redux";

import { setBaseMapLinkAdaptScale } from "Features/mapEditor/mapEditorSlice";

import { Box, Paper, Switch, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import db from "App/db/db";

import { isBaseMapLinkLocateDraft } from "../utils/startBaseMapLinkTools";

// Drawing-helper body of the section marks ("trait de coupe", Fonds de plan
// module), in two parts mounted by SectionDrawingHelperContent:
// - default export: the instruction of the armed flow (drawing a new mark on
//   a plan / locating an existing one on a vertical base map), plus a warning
//   when the located mark already sits on another base map;
// - SwitchBaseMapLinkAdaptScale: the « Adapter l'échelle » option of the
//   locate flow, at the bottom of the helper.

const hasScale = (baseMap) => {
  const meterByPx = baseMap?.getMeterByPx?.() ?? baseMap?.meterByPx;
  return Number.isFinite(meterByPx) && meterByPx > 0;
};

export default function SectionBaseMapLinkDrawingHelper() {
  // strings

  const drawS =
    "Cliquez les deux extrémités du trait de coupe. L'observateur regarde à droite du sens du tracé.";
  const locateKeepS =
    "Cliquez le point d'accroche du trait de coupe, puis un 2ᵉ point pour donner sa direction.";
  const locateAdaptS =
    "Cliquez les deux extrémités du trait de coupe : l'échelle du fond de plan est recalculée.";
  const movedS = (name) =>
    `Ce trait est déjà repéré sur « ${name} » : il sera déplacé sur ce fond de plan.`;

  // data

  const baseMap = useMainBaseMap();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);
  const adaptScale = useSelector((s) => s.mapEditor.baseMapLinkAdaptScale);
  const annotationsUpdatedAt = useSelector(
    (s) => s.annotations.annotationsUpdatedAt
  );

  const isLocate = isBaseMapLinkLocateDraft(newAnnotation);
  const sourceId = isLocate ? newAnnotation.sourceLinkAnnotationId : null;
  const baseMapId = baseMap?.id;

  // Name of the OTHER vertical base map the mark is currently located on.
  const otherBaseMapName = useLiveQuery(async () => {
    if (!sourceId || !baseMapId) return null;
    const source = await db.annotations.get(sourceId);
    const targetId = source?.linkedBaseMapId;
    if (!source || source.deletedAt || !targetId || targetId === baseMapId)
      return null;
    const clones = await db.annotations
      .where("baseMapId")
      .equals(targetId)
      .filter(
        (a) =>
          !a.deletedAt &&
          a.type === "BASE_MAP_LINK" &&
          a.sourceLinkAnnotationId === sourceId
      )
      .count();
    if (clones === 0) return null;
    const target = await db.baseMaps.get(targetId);
    return target && !target.deletedAt ? (target.name ?? "…") : null;
  }, [sourceId, baseMapId, annotationsUpdatedAt]);

  // helpers

  const effectiveAdapt = Boolean(adaptScale) || !hasScale(baseMap);
  const messageS = isLocate
    ? effectiveAdapt
      ? locateAdaptS
      : locateKeepS
    : drawS;

  // render

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderRadius: 1,
          bgcolor: "primary.main",
          color: "primary.contrastText",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {messageS}
      </Box>
      {otherBaseMapName && (
        <Typography variant="caption" color="warning.main" sx={{ px: 0.5 }}>
          {movedS(otherBaseMapName)}
        </Typography>
      )}
    </Box>
  );
}

// « Adapter l'échelle » (locate flow only). OFF (default): the base map keeps
// its scale — the 1st click is the anchor, the 2nd one only gives the
// direction. ON: the scale is recalibrated so the two clicks span the mark.
// A base map without a scale has nothing to keep: forced ON.
export function SwitchBaseMapLinkAdaptScale() {
  const dispatch = useDispatch();

  // strings

  const labelS = "Adapter l'échelle";
  const noScaleS =
    "Ce fond de plan n'a pas d'échelle : elle sera calculée à partir du trait.";

  // data

  const baseMap = useMainBaseMap();
  const adaptScale = useSelector((s) => s.mapEditor.baseMapLinkAdaptScale);

  // helpers

  const forced = !hasScale(baseMap);

  // render

  return (
    <Paper
      elevation={0}
      sx={{
        px: 1,
        py: 0.5,
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
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
        <Typography variant="caption" color="text.secondary">
          {labelS}
        </Typography>
        <Switch
          size="small"
          disabled={forced}
          checked={forced || Boolean(adaptScale)}
          onChange={(e) => dispatch(setBaseMapLinkAdaptScale(e.target.checked))}
        />
      </Box>
      {forced && (
        <Typography variant="caption" color="text.disabled">
          {noScaleS}
        </Typography>
      )}
    </Paper>
  );
}
