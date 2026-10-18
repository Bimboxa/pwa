import { Box, Switch, Tooltip, Typography } from "@mui/material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useSegmentsHidden from "Features/points/hooks/useSegmentsHidden";

import getAnnotationPartQties from "../utils/getAnnotationPartQties";

// Inline editor row for the currently sub-selected segment (main ring or cut
// ring) of a POLYLINE / POLYGON / STRIP: read-only length + visible switch.
// The length is the same value the measurements row shows for a part
// (developed length when the endpoints carry Z offsets), so the host toolbar
// skips its measurements row for segment parts. The visible switch drives the
// per-segment hidden flag — same persistence as the Backspace hotkey.
export default function ToolbarEditSegment({ annotation, part }) {
  // data

  const baseMap = useMainBaseMap();
  const meterByPx = baseMap?.meterByPx;
  const hidden = useSegmentsHidden();

  // helpers

  const qties =
    annotation && part
      ? getAnnotationPartQties({ annotation, part, meterByPx })
      : null;
  const length =
    qties?.enabled === false
      ? null
      : (qties?.lengthDeveloped ?? qties?.length ?? null);
  const showLength = Number.isFinite(length) && length > 0;

  const isVisible = !hidden.checked;

  // handlers

  function handleVisibleChange() {
    hidden.toggle();
  }

  // render

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        px: 1.25,
        py: 0.25,
        gap: 0.5,
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Typography variant="caption" sx={{ color: "text.secondary" }}>
        Longueur
      </Typography>
      {showLength && (
        <Typography
          variant="caption"
          sx={{
            fontFamily: "monospace",
            color: "warning.main",
            fontWeight: 500,
          }}
        >
          {length.toFixed(2)} ml
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      <Tooltip
        title={
          isVisible
            ? "Segment visible — désactiver pour le masquer"
            : "Segment masqué — activer pour l'afficher"
        }
      >
        <Box sx={{ display: "flex", alignItems: "center", p: 0.5 }}>
          <Typography variant="body2" color="text.secondary" noWrap>
            Visible
          </Typography>
          <Switch
            size="small"
            checked={isVisible}
            onChange={handleVisibleChange}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </Box>
      </Tooltip>
    </Box>
  );
}
