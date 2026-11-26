import { Box, Tooltip } from "@mui/material";
import { Lock as LockIcon } from "@mui/icons-material";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useUpdateAnnotation from "../hooks/useUpdateAnnotation";

import FieldAnnotationHeight from "./FieldAnnotationHeight";

import getRectangleSizeLocks from "Features/rectangles/utils/getRectangleSizeLocks";

// Dimensions of a RECTANGLE annotation: Lx / Ly along its own sides, in
// metres (pixels when the base map has no scale). A dimension locked by the
// template is read-only (padlock). An edit resizes the rectangle around its
// centre, so a rotated rectangle stays in place.
const ROWS = [
  { key: "lx", label: "Lx", bboxKey: "width", lockKey: "lockedWidth" },
  { key: "ly", label: "Ly", bboxKey: "height", lockKey: "lockedHeight" },
];

export default function FieldsAnnotationRectangle({ annotation }) {
  // data

  const baseMap = useMainBaseMap();
  const updateAnnotation = useUpdateAnnotation();

  // helpers

  const imageSize = baseMap?.getImageSize?.() || baseMap?.image?.imageSize;
  const meterByPx = baseMap?.getMeterByPx?.();
  const hasScale = Number.isFinite(meterByPx) && meterByPx > 0;
  const unitByPx = hasScale ? meterByPx : 1;
  const unit = hasScale ? "m" : "px";

  const bbox = annotation?.bbox; // resolved: base map pixels
  const locks = getRectangleSizeLocks(annotation?.annotationTemplateProps);
  const values = {
    id: annotation?.id,
    lx: (bbox?.width ?? 0) * unitByPx,
    ly: (bbox?.height ?? 0) * unitByPx,
  };

  // handlers

  const handleDimChange = (row) => async (next) => {
    const value = next?.[row.key];
    if (!(value > 0) || !bbox || !imageSize?.width || !imageSize?.height) {
      return;
    }
    const newBbox = { ...bbox, [row.bboxKey]: value / unitByPx };
    // keep the centre
    newBbox.x = bbox.x + (bbox.width - newBbox.width) / 2;
    newBbox.y = bbox.y + (bbox.height - newBbox.height) / 2;
    await updateAnnotation({
      id: annotation.id,
      bbox: {
        x: newBbox.x / imageSize.width,
        y: newBbox.y / imageSize.height,
        width: newBbox.width / imageSize.width,
        height: newBbox.height / imageSize.height,
      },
    });
  };

  // render

  if (!annotation || !bbox) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      {ROWS.map((row) => {
        const locked = locks[row.lockKey];
        return (
          <Box key={row.key} sx={{ display: "flex", alignItems: "center" }}>
            <FieldAnnotationHeight
              annotation={values}
              field={row.key}
              label={row.label}
              unit={unit}
              displayDecimals={3}
              disabled={locked}
              commitOnBlur
              onChange={handleDimChange(row)}
            />
            {locked && (
              <Tooltip title="Dimension verrouillée par le modèle">
                <LockIcon sx={{ fontSize: 14, color: "text.disabled" }} />
              </Tooltip>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
