import { memo } from "react";

import { useSelector } from "react-redux";
import { useLiveQuery } from "dexie-react-hooks";

import db from "App/db/db";

import useOrthophotoOverlayImage from "../hooks/useOrthophotoOverlayImage";

// Rectified image of the SELECTED unit orthophoto, laid over the orthomosaic
// base map. Rendered by StaticMapContent INSIDE the main base map group —
// above its image, under its annotations — so the coordinates are base map
// px. Display-only (never hit by the editor).
// `baseMapId`: the orthomosaic base map drawn by this editor instance, null
// for any other base map (nothing rendered).
export default memo(function OrthophotoOverlayLayer({
  baseMapId,
  baseMapImageSize,
}) {
  // data

  const selectedOrthophotoId = useSelector(
    (s) => s.orthophotos.selectedOrthophotoId
  );
  // count chip of the bottom bar: off, nothing of the orthophotos is drawn
  const showStations = useSelector((s) => s.orthophotos.showStations);
  const opacity = useSelector((s) => s.orthophotos.overlayOpacity);
  const orthophoto = useLiveQuery(async () => {
    if (!baseMapId || !selectedOrthophotoId || !showStations) return null;
    const row = await db.orthophotos.get(selectedOrthophotoId);
    return row && !row.deletedAt && row.baseMapId === baseMapId ? row : null;
  }, [baseMapId, selectedOrthophotoId, showStations]);

  const image = useOrthophotoOverlayImage({
    orthophoto,
    baseMapSize: baseMapImageSize,
  });

  // render

  if (!orthophoto || !image) return null;

  return (
    <g style={{ pointerEvents: "none" }} opacity={opacity}>
      {image.kind === "AFFINE" ? (
        <g transform={image.matrixStr}>
          <image
            href={image.href}
            width={image.width}
            height={image.height}
            preserveAspectRatio="none"
          />
        </g>
      ) : (
        <image
          href={image.href}
          x={image.x}
          y={image.y}
          width={image.width}
          height={image.height}
          preserveAspectRatio="none"
        />
      )}
    </g>
  );
});
