import getProcedureOptions from "./getProcedureOptions";

/**
 * One-line recap of the current parameters of a procedure (annotationsAuto
 * slice state), e.g. "Ht. eau: 12.50 m · Retour 1m". Boolean parameters are
 * listed when enabled. Returns "" when the procedure exposes no parameter and
 * `noneLabel` when none is set / enabled.
 */
export default function getProcedureParamsSummary(
  procedure,
  annotationsAutoState,
  noneLabel = "Aucune option"
) {
  const state = annotationsAutoState ?? {};
  const options = procedure?.options ?? [];
  const hasParams =
    procedure?.showHeightInput === true ||
    procedure?.showCuvelageHeight === true ||
    procedure?.showWaterHeight === true ||
    procedure?.showReturnTechnique === true ||
    options.length > 0;
  if (!hasParams) return "";

  const parse = (value) => {
    const n = value != null && value !== "" ? parseFloat(value) : null;
    return n != null && Number.isFinite(n) ? n : null;
  };

  const parts = [];

  const height = parse(state.height);
  if (
    (procedure.showHeightInput === true ||
      procedure.showCuvelageHeight === true) &&
    height != null
  ) {
    parts.push(`Ht.: ${height.toFixed(2)} m`);
  }

  const waterHeight = parse(state.waterHeight);
  if (procedure.showWaterHeight === true && waterHeight != null) {
    parts.push(`Ht. eau: ${waterHeight.toFixed(2)} m`);
  }

  if (procedure.showReturnTechnique === true) {
    if (state.returnTechnique ?? true) parts.push("Retour technique 1m");
    if (state.ignoreInteriorWalls) parts.push("Sans murs intérieurs");
  }

  const optionValues = getProcedureOptions(
    procedure,
    state.optionsByProcedureKey
  );
  for (const option of options) {
    if (optionValues[option.key]) parts.push(option.label);
  }

  return parts.length > 0 ? parts.join(" · ") : noneLabel;
}
