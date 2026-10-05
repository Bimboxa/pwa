/**
 * Resolved values of the boolean options a procedure declares in its registry
 * entry (`options: [{key, label, default}]`): the user's choice when one was
 * made (annotationsAuto slice, `optionsByProcedureKey`), else the option's
 * default. Returns {[optionKey]: boolean}.
 */
export default function getProcedureOptions(procedure, optionsByProcedureKey) {
  const values = optionsByProcedureKey?.[procedure?.key] ?? {};
  const result = {};
  for (const option of procedure?.options ?? []) {
    result[option.key] = values[option.key] ?? option.default === true;
  }
  return result;
}
