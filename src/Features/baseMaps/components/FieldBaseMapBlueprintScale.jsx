import { useDispatch } from "react-redux";

import { triggerEntitiesTableUpdate } from "Features/entities/entitiesSlice";
import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import FieldTextV2 from "Features/form/components/FieldTextV2";

import db from "App/db/db";

const METER_PER_INCH = 0.0254;

// Blueprint scale ("1 : xx") of a base map cut from a PDF — same notion as
// the "Echelle" field of the PDF creator. Derived from meterByPx and the
// render dpi (meterByPx = 0.0254 / dpi * scale), so a 2D recalibration shows
// through. Committed once on blur (FieldTextV2 changeOnBlur): the new
// meterByPx drives every quantity of the base map. Renders nothing when the
// base map does not come from a PDF or its dpi is unknown.
export default function FieldBaseMapBlueprintScale({ baseMap }) {
  const dispatch = useDispatch();

  // strings

  const labelS = "Échelle";

  // helpers

  const createdFrom = baseMap?.createdFrom;
  const meterByPx = Number(baseMap?.meterByPx);
  const storedScale = Number(createdFrom?.blueprintScale);
  let dpi = Number(createdFrom?.dpi);
  if (!(dpi > 0) && storedScale > 0 && meterByPx > 0) {
    // Legacy rows without dpi: recover it from the creation-time pair.
    dpi = (METER_PER_INCH * storedScale) / meterByPx;
  }
  const isPdf = createdFrom?.type === "PDF_PAGE";
  const scale =
    meterByPx > 0 && dpi > 0
      ? (meterByPx * dpi) / METER_PER_INCH
      : storedScale > 0
        ? storedScale
        : null;
  const displayValue = scale != null ? scale.toFixed(1).replace(/\.0$/, "") : "";

  // handlers

  async function handleChange(value) {
    if (!baseMap?.id || !(dpi > 0)) return;
    const next = Number(String(value ?? "").replace(",", ".").trim());
    if (!Number.isFinite(next) || next <= 0) return;
    if (scale != null && Math.abs(next - scale) < 1e-9) return;
    await db.baseMaps.update(baseMap.id, {
      meterByPx: (METER_PER_INCH / dpi) * next,
      createdFrom: { ...createdFrom, blueprintScale: String(next) },
    });
    dispatch(triggerEntitiesTableUpdate("baseMaps"));
    dispatch(triggerAnnotationsUpdate());
  }

  // render

  if (!isPdf || !(dpi > 0)) return null;

  return (
    <FieldTextV2
      label={labelS}
      value={displayValue}
      onChange={handleChange}
      options={{
        showAsField: true,
        changeOnBlur: true,
        hideMic: true,
        startAdornment: "1 :",
        placeholder: "50, 100, …",
      }}
    />
  );
}
