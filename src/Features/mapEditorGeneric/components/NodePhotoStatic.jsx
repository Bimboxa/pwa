import { memo, useMemo } from "react";

import theme from "Styles/theme";

import {
  fovConePath,
  fovDirectionLine,
} from "Features/photos/utils/photoPoseGlyph";
import { DEFAULT_FOV_DEG } from "Features/photos/constants/photoNode";

// ---------------------------------------------------------------------------
// NodePhotoStatic — camera pose of a photo on the 2D map: a screen-constant
// dot at the photo point plus the view cone (directionDeg + fovDeg + radiusM
// converted to px with the base map scale). Read-only in v1: hover shows the
// thumbnail tooltip (MapTooltip), click selects the photo in the Photos
// panel; the node is NOT draggable (`data-interaction` absent on purpose —
// re-localization goes through the "Localiser la photo" tool).
// ---------------------------------------------------------------------------

const DOT_PX = 5;

function NodePhotoStatic({
  annotation,
  hovered,
  selected,
  baseMapMeterByPx,
  containerK = 1,
}) {
  const { id, listingId, point, directionDeg, fovDeg, radiusM } =
    annotation ?? {};

  // helpers - geometry

  const radiusPx = useMemo(() => {
    if (Number.isFinite(radiusM) && baseMapMeterByPx > 0)
      return radiusM / baseMapMeterByPx;
    return null;
  }, [radiusM, baseMapMeterByPx]);

  const conePath = useMemo(() => {
    if (!point || radiusPx == null || !Number.isFinite(directionDeg))
      return "";
    return fovConePath(
      point,
      directionDeg,
      fovDeg ?? DEFAULT_FOV_DEG,
      radiusPx
    );
  }, [point, directionDeg, fovDeg, radiusPx]);

  const ray = useMemo(() => {
    if (!point || radiusPx == null || !Number.isFinite(directionDeg))
      return null;
    return fovDirectionLine(point, directionDeg, radiusPx);
  }, [point, directionDeg, radiusPx]);

  // helpers - screen-constant dot

  const scaleTransform = useMemo(() => {
    const k = containerK || 1;
    return `scale(calc(1 / (var(--map-zoom, 1) * ${k})))`;
  }, [containerK]);

  // helpers - colors

  const color = theme.palette.viewers.photos;
  const emphasized = hovered || selected;

  // data attributes for the InteractionLayer hit detection (hover tooltip +
  // click → select in panel). No data-interaction: not draggable.
  const dataProps = {
    "data-node-id": id,
    "data-node-listing-id": listingId,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "PHOTO",
  };

  // render

  if (!point) return null;

  return (
    <g style={{ cursor: "pointer" }} {...dataProps}>
      {/* view cone */}
      {conePath && (
        <path
          d={conePath}
          fill={color}
          fillOpacity={emphasized ? 0.3 : 0.15}
          stroke={color}
          strokeWidth={emphasized ? 2.5 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {ray && (
        <line
          x1={ray.x1}
          y1={ray.y1}
          x2={ray.x2}
          y2={ray.y2}
          stroke={color}
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* photo point — screen-constant */}
      <g transform={`translate(${point.x}, ${point.y})`}>
        {/* invisible hit circle, fixed screen size */}
        <g style={{ transform: scaleTransform }}>
          <circle r={12} fill="transparent" />
          <circle
            r={emphasized ? DOT_PX + 1.5 : DOT_PX}
            fill={color}
            stroke="#ffffff"
            strokeWidth={selected ? 2 : 1}
            style={
              selected
                ? { filter: "drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" }
                : {}
            }
          />
        </g>
      </g>
    </g>
  );
}

export default memo(NodePhotoStatic);
