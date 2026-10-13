import db from "App/db/db";

import useSelectedAnnotation from "Features/annotations/hooks/useSelectedAnnotation";

import {
  LAYOUT_LINE_DEFAULTS,
  LAYOUT_LINE_RENDER_MODES,
} from "Features/annotations/utils/computeLayoutLineBars";

const DENSITY_MODES = ["SPACING", "PER_METER"];
const ALIGNS = ["LEFT", "CENTER", "RIGHT"];

// Generic patch of one layoutLine entry ("ligne de calepinage") in the
// selected annotation's `layoutLines` array (density, alignment, label,
// renderMode). Same write pattern as useUpdateGuideLine: raw read + remap +
// update, Dexie liveQuery drives the refresh.
export default function useUpdateLayoutLine() {
  const annotation = useSelectedAnnotation();

  return async (index, patch) => {
    if (!annotation?.id || !Number.isInteger(index) || index < 0) return;
    if (!patch || typeof patch !== "object") return;

    const sanitized = { ...patch };
    if ("densityValue" in sanitized) {
      const v = Number(sanitized.densityValue);
      sanitized.densityValue = Number.isFinite(v) && v > 0 ? v : 0;
    }
    if (
      "densityMode" in sanitized &&
      !DENSITY_MODES.includes(sanitized.densityMode)
    ) {
      sanitized.densityMode = LAYOUT_LINE_DEFAULTS.densityMode;
    }
    if ("layoutAlign" in sanitized && !ALIGNS.includes(sanitized.layoutAlign)) {
      sanitized.layoutAlign = LAYOUT_LINE_DEFAULTS.layoutAlign;
    }
    if (
      "renderMode" in sanitized &&
      !LAYOUT_LINE_RENDER_MODES.includes(sanitized.renderMode)
    ) {
      sanitized.renderMode = LAYOUT_LINE_DEFAULTS.renderMode;
    }
    if ("label" in sanitized) sanitized.label = String(sanitized.label ?? "");
    if ("color" in sanitized) {
      sanitized.color =
        typeof sanitized.color === "string" && sanitized.color
          ? sanitized.color
          : LAYOUT_LINE_DEFAULTS.color;
    }
    if ("showDensityInLabel" in sanitized) {
      sanitized.showDensityInLabel = Boolean(sanitized.showDensityInLabel);
    }
    if ("coverWholeSurface" in sanitized) {
      sanitized.coverWholeSurface = Boolean(sanitized.coverWholeSurface);
    }
    if ("densityUnitLabel" in sanitized) {
      sanitized.densityUnitLabel = String(sanitized.densityUnitLabel ?? "");
    }

    const raw = await db.annotations.get(annotation.id);
    if (!raw || !Array.isArray(raw.layoutLines) || !raw.layoutLines[index])
      return;

    const layoutLines = raw.layoutLines.map((l, i) =>
      i === index ? { ...l, ...sanitized } : l
    );
    await db.annotations.update(annotation.id, { layoutLines });
  };
}
