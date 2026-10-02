import { useSelector } from "react-redux";

import {
  selectMeshBrushPartType,
  selectMeshBrushTemplateId,
} from "Features/meshPaint/utils/meshBrushSelectors";

import { Box, Typography } from "@mui/material";

import useExtraBaseMapIdsIn3d from "Features/threedEditor/hooks/useExtraBaseMapIdsIn3d";
import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import usePaintedPartsQties from "Features/meshPaint/hooks/usePaintedPartsQties";

import { MESH_PAINT_PART_TYPES } from "Features/meshPaint/constants/meshPaintConstants";
import { formatQtyValue } from "Features/annotations/utils/mergePaintedQtiesIntoTemplateQties";

const plural = (n, word, pluralWord = `${word}s`) =>
  `${n} ${n > 1 ? pluralWord : word}`;

// Live total of the parts painted with the armed « Pinceau » template, in the
// drawing helper — same scope as the Dessin panel's template totals
// (PanelDrawing's usePaintedPartsQties options in 3D).
export default function SectionMeshBrushPaintedTotal() {
  // strings

  const titleS = "Déjà peint avec ce modèle";

  // data

  const partType = useSelector(selectMeshBrushPartType);
  const templateId = useSelector(selectMeshBrushTemplateId);
  const hiddenListingsIds = useSelector(
    (s) => s.listings.hiddenListingsIds || []
  );
  const hideMainAnnotationsIn3d = useSelector(
    (s) => s.threedEditor.hideMainBaseMapAnnotationsIn3d
  );
  const isAllScope = useSelector(
    (s) => s.panelDrawing.viewerAnnotationsScope === "ALL"
  );
  const baseMap = useMainBaseMap();
  const extraBaseMapIds = useExtraBaseMapIdsIn3d();

  const painted = usePaintedPartsQties({
    enabled: Boolean(templateId),
    filterByMainBaseMap: !isAllScope,
    filterBySelectedScope: true,
    excludeIsForBaseMapsListings: true,
    keepHiddenTemplates: true,
    ...(!isAllScope
      ? {
          extraBaseMapIds,
          excludeProfileTemplates: true,
          excludeListingsIds: hiddenListingsIds,
          excludeBaseMapIds:
            hideMainAnnotationsIn3d && baseMap?.id ? [baseMap.id] : null,
        }
      : {}),
  });

  // helpers

  const stats = templateId ? painted.qtiesByTemplateId?.[templateId] : null;
  const isEdge = partType === MESH_PAINT_PART_TYPES.EDGE;
  const count = (isEdge ? stats?.edgesCount : stats?.facesCount) ?? 0;
  const quantity = isEdge
    ? `${formatQtyValue(stats?.length ?? 0)} ml`
    : `${formatQtyValue(stats?.surface ?? 0)} m²`;
  const countLabel = isEdge ? plural(count, "arête") : plural(count, "face");
  const uncounted = Math.max(
    0,
    (stats?.listedCount ?? 0) - (stats?.partsCount ?? 0)
  );

  // render

  if (!partType || !templateId) return null;

  return (
    <Box
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: "action.hover",
        display: "flex",
        flexDirection: "column",
        gap: 0.25,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {titleS}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {`${quantity} · ${countLabel}`}
      </Typography>
      {uncounted > 0 && (
        <Typography variant="caption" color="text.secondary">
          {`${plural(uncounted, "partie")} non comptée${uncounted > 1 ? "s" : ""}`}
        </Typography>
      )}
    </Box>
  );
}
