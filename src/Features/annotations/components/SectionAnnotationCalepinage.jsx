import { useMemo } from "react";
import { useDispatch } from "react-redux";

import { Box, Typography, IconButton } from "@mui/material";
import { ArrowForwardIos as ForwardIcon } from "@mui/icons-material";

import { setSubSelection } from "Features/selection/selectionSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";

import computeLayoutLineBars, {
  getLayoutLineRingsPx,
  LAYOUT_LINE_DEFAULTS,
} from "Features/annotations/utils/computeLayoutLineBars";

// Lists the layout lines ("lignes de calepinage") of a POLYGON with their
// total bar length. Each row shows the label / linear and a forward arrow;
// clicking it sub-selects that layoutLine (selectionSlice) so its properties
// panel opens. Same pattern as SectionAnnotationPentes.
export default function SectionAnnotationCalepinage({ annotation }) {
  // data

  const dispatch = useDispatch();
  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;

  // Keep the original index — the selection partId encodes it:
  // `${annotationId}::LAYOUT_LINE::${index}`.
  const rows = useMemo(() => {
    if (annotation?.type !== "POLYGON") return [];
    const lines = Array.isArray(annotation?.layoutLines)
      ? annotation.layoutLines
      : [];
    if (lines.length === 0) return [];
    const { outerRing, cutRings } = getLayoutLineRingsPx(annotation);
    return lines
      .map((raw, index) => {
        const l = { ...LAYOUT_LINE_DEFAULTS, ...raw };
        if ((l.points?.length ?? 0) < 2) return null;
        const layout = computeLayoutLineBars({
          linePoints: l.points,
          outerRing,
          cutRings,
          meterByPx,
          densityMode: l.densityMode,
          densityValue: l.densityValue,
          layoutAlign: l.layoutAlign,
          coverWholeSurface: l.coverWholeSurface,
        });
        return {
          index,
          label: l.label || "",
          barCount: layout.barCount,
          totalLengthM: layout.totalLengthM,
        };
      })
      .filter(Boolean);
  }, [annotation, meterByPx]);

  // handlers

  function handleSelect(index) {
    if (!annotation?.id) return;
    dispatch(
      setSubSelection({
        partId: `${annotation.id}::LAYOUT_LINE::${index}`,
        partType: "LAYOUT_LINE",
      })
    );
  }

  // render

  if (rows.length === 0) return null;

  return (
    <Box
      sx={{
        width: 1,
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600 }}
      >
        Calepinage
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
        {rows.map((row, i) => (
          <Box
            key={row.index}
            onClick={() => handleSelect(row.index)}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              bgcolor: "white",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              pl: 1,
              cursor: "pointer",
              "&:hover": { borderColor: "text.secondary" },
            }}
          >
            <Typography variant="caption" noWrap>
              {`Calepinage ${i + 1}${row.label ? ` — ${row.label}` : ""} : ${row.totalLengthM.toFixed(2)} ml`}
            </Typography>
            <IconButton size="small" onClick={() => handleSelect(row.index)}>
              <ForwardIcon sx={{ fontSize: 14 }} color="action" />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
