import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { IconButton, Tooltip } from "@mui/material";
import {
  Straighten as ScaleIcon,
  AddPhotoAlternate as ChangeImageIcon,
} from "@mui/icons-material";

import {
  setEnabledDrawingMode,
  setImageChangeAnnotationId,
  setImageScaleDraft,
} from "Features/mapEditor/mapEditorSlice";
import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import theme from "Styles/theme";

// Overlay toolbar above a selected IMAGE annotation — same pattern as the
// NodeSegmentLengthsStatic overlay (HTML buttons in a counter-scaled
// foreignObject, `ui-overlay` guards so the click never reaches the map).
// Two actions:
// - Scale: arm the IMAGE_SCALE 2-click cote; the popper then asks the real
//   length and the bbox is scaled about the first clicked point.
// - Change image: open DialogChangeAnnotationImage for THIS annotation.
const ACCENT_COLOR = "#2196f3";
const OVERLAY_BUTTON_PX = 34;
const OVERLAY_GAP_PX = 4;
const OVERLAY_H_PX = 40;
// Clears the rotation handle (30px above the bbox) and its knob.
const OVERLAY_OFFSET_PX = 60;

const overlayGuards = {
  onPointerDown: (e) => e.stopPropagation(),
  onPointerUp: (e) => e.stopPropagation(),
  onMouseDown: (e) => e.stopPropagation(),
  onMouseUp: (e) => e.stopPropagation(),
  onClick: (e) => e.stopPropagation(),
};

const buttonSx = (active) => ({
  bgcolor: "rgba(255,255,255,0.9)",
  border: `1px solid ${ACCENT_COLOR}`,
  color: active ? ACCENT_COLOR : "text.disabled",
  "&:hover": { bgcolor: "white" },
  p: 0.5,
});

export default function NodeImageToolbarOverlay({
  annotation,
  anchor, // { x, y } base-map px — top-centre of the rotated bbox
  containerK = 1,
  baseMapMeterByPx,
}) {
  const dispatch = useDispatch();

  // data

  const enabledDrawingMode = useSelector((s) => s.mapEditor.enabledDrawingMode);

  // helpers

  const hasScale = Number.isFinite(baseMapMeterByPx) && baseMapMeterByPx > 0;
  const counterScaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  const buttonCount = 2;
  const overlayWidth =
    buttonCount * OVERLAY_BUTTON_PX + (buttonCount - 1) * OVERLAY_GAP_PX;

  // handlers

  function handleScaleClick() {
    if (!hasScale) return;
    dispatch(setImageScaleDraft({ annotationId: annotation.id }));
    dispatch(
      setNewAnnotation({
        type: "POLYLINE",
        strokeColor: theme.palette.secondary.main,
        strokeWidth: 2,
        strokeWidthUnit: "PX",
      })
    );
    dispatch(setEnabledDrawingMode("IMAGE_SCALE"));
  }

  function handleChangeImageClick() {
    dispatch(setImageChangeAnnotationId(annotation.id));
  }

  // render

  if (!anchor || enabledDrawingMode) return null;

  return (
    <g transform={`translate(${anchor.x}, ${anchor.y})`}>
      <g style={{ transform: counterScaleTransform }}>
        <foreignObject
          x={-overlayWidth / 2}
          y={-OVERLAY_OFFSET_PX}
          width={overlayWidth}
          height={OVERLAY_H_PX}
          style={{ overflow: "visible" }}
        >
          <div
            data-interaction="ui-overlay"
            {...overlayGuards}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: OVERLAY_GAP_PX,
            }}
          >
            <Tooltip
              placement="top"
              arrow
              title={
                hasScale
                  ? "Mettre à l'échelle : cliquer 2 points sur l'image, puis saisir la longueur réelle"
                  : "Fond de plan sans échelle : définir l'échelle du fond de plan d'abord"
              }
            >
              <span>
                <IconButton
                  size="small"
                  onClick={handleScaleClick}
                  disabled={!hasScale}
                  sx={buttonSx(false)}
                >
                  <ScaleIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip placement="top" arrow title="Changer l'image">
              <IconButton
                size="small"
                onClick={handleChangeImageClick}
                sx={buttonSx(false)}
              >
                <ChangeImageIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </div>
        </foreignObject>
      </g>
    </g>
  );
}
