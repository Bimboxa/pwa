/**
 * True when the procedure exposes at least one parameter (height, water level,
 * options) in SectionProcedureParams — lets a host add its own chrome
 * (divider, spacing) only when the section actually renders.
 */
export default function hasProcedureParams(procedure) {
  return (
    procedure?.showHeightInput === true ||
    procedure?.showCuvelageHeight === true ||
    procedure?.showWaterHeight === true ||
    procedure?.showReturnTechnique === true
  );
}
