import { useMemo } from "react";

import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";
import useProjectBaseMapListings from "Features/baseMaps/hooks/useProjectBaseMapListings";

import getDessinGridBaseMapIds from "Features/baseMapsGrid/utils/getDessinGridBaseMapIds";

const EMPTY = [];

// Ids of the sheets of the Dessin module's 3D base maps grid: every base
// map of the scope with a flat plane in 3D (photos out), in the order of
// the folders — the same table as the 2D grid (getDessinGridBaseMapIds).
// The array identity only changes with its content (effects / memo deps).
export default function useDessinGridBaseMapIds() {
  const { value: baseMaps } = useBaseMaps();
  const listings = useProjectBaseMapListings();

  const key = useMemo(
    () =>
      getDessinGridBaseMapIds({
        baseMaps: baseMaps?.filter((baseMap) => !baseMap.isPhoto),
        listings,
      }).join(","),
    [baseMaps, listings]
  );

  return useMemo(() => (key ? key.split(",") : EMPTY), [key]);
}
