import { useEffect, useMemo, useState } from "react";

import usePhotoImageUrl from "Features/photos/hooks/usePhotoImageUrl";

import getOrthophotoPlacement from "../utils/getOrthophotoPlacement";
import bakeOrthophotoWarp from "../utils/bakeOrthophotoWarp";

// What to draw, in base map px, for the rectified image of an orthophoto:
// - { kind: "AFFINE", href, matrixStr, width, height }: the original file
//   under an SVG matrix (corners forming a parallelogram);
// - { kind: "PROJECTIVE", href, x, y, width, height }: the image warped onto
//   its 4 corners (baked once per corners / file);
// - null while loading or when the placement is unusable.
export default function useOrthophotoOverlayImage({ orthophoto, baseMapSize }) {
  const fileName = orthophoto?.orthoImage?.fileName;
  const imageSize = orthophoto?.orthoImage?.imageSize;
  const url = usePhotoImageUrl(fileName);

  const baseW = baseMapSize?.width;
  const baseH = baseMapSize?.height;
  const cornersKey = JSON.stringify(orthophoto?.corners ?? null);
  const placement = useMemo(
    () =>
      getOrthophotoPlacement({
        corners: JSON.parse(cornersKey),
        baseMapSize: { width: baseW, height: baseH },
        imageSize,
      }),
    // imageSize is a fresh object per read: keyed by its values
    [cornersKey, baseW, baseH, imageSize?.width, imageSize?.height]
  );

  const [baked, setBaked] = useState(null);

  useEffect(() => {
    setBaked(null);
    if (!url || placement?.kind !== "PROJECTIVE") return undefined;
    let cancelled = false;
    let objectUrl = null;
    bakeOrthophotoWarp({
      imageUrl: url,
      imageSize,
      H: placement.H,
      bbox: placement.bbox,
    })
      .then((result) => {
        if (cancelled || !result) return;
        objectUrl = URL.createObjectURL(result.blob);
        setBaked({
          kind: "PROJECTIVE",
          href: objectUrl,
          x: result.x,
          y: result.y,
          width: result.width,
          height: result.height,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, placement]);

  if (!url || !placement) return null;
  if (placement.kind === "AFFINE") {
    return {
      kind: "AFFINE",
      href: url,
      matrixStr: placement.matrixStr,
      width: imageSize.width,
      height: imageSize.height,
    };
  }
  return baked;
}
