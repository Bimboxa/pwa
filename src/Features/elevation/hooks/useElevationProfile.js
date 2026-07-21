import { useMemo } from "react";

import buildElevationProfile from "Features/elevation/utils/buildElevationProfile";

// Memoized wrapper around buildElevationProfile (see that util for the full
// geometry model) — the computation itself is pure so non-React callers (e.g.
// importMeshService) can reuse it.
export default function useElevationProfile({
  points,
  selectedSegmentIndices,
  seedSegmentIndex,
  observationSign = 1,
  meterByPx,
  height,
  offsetZ,
  isoLines = null,
}) {
  return useMemo(
    () =>
      buildElevationProfile({
        points,
        selectedSegmentIndices,
        seedSegmentIndex,
        observationSign,
        meterByPx,
        height,
        offsetZ,
        isoLines,
      }),
    [
      points,
      selectedSegmentIndices,
      seedSegmentIndex,
      observationSign,
      meterByPx,
      height,
      offsetZ,
      isoLines,
    ]
  );
}
