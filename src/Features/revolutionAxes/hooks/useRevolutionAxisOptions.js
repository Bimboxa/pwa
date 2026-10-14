import { useMemo } from "react";

import useRevolutionAxes from "Features/annotations/hooks/useRevolutionAxes";
import useBaseMaps from "Features/baseMaps/hooks/useBaseMaps";

/**
 * Revolution axes of the current scope (plan axes) as `{ id, label }`
 * options, sorted by axis label (numeric aware), each labelled by its name and
 * the plan it is drawn on (« Axe 1 · Gare massy »).
 */
export default function useRevolutionAxisOptions() {
  // data

  const axes = useRevolutionAxes();
  const { value: baseMaps } = useBaseMaps({
    includeDetails: true,
    includeDisabledListings: true,
  });

  // helpers

  const baseMapNameById = useMemo(() => {
    const acc = new Map();
    for (const bm of baseMaps ?? []) acc.set(bm.id, bm.name);
    return acc;
  }, [baseMaps]);

  return useMemo(
    () =>
      [...axes]
        .sort((a, b) =>
          String(a.label ?? "").localeCompare(
            String(b.label ?? ""),
            undefined,
            {
              numeric: true,
            }
          )
        )
        .map((axis) => ({
          id: axis.id,
          label: [axis.label ?? "Axe", baseMapNameById.get(axis.baseMapId)]
            .filter(Boolean)
            .join(" · "),
        })),
    [axes, baseMapNameById]
  );
}
