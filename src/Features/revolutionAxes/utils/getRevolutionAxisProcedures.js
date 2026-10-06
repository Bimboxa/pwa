// "Systèmes" of a plan REVOLUTION_AXIS: the registry ANNOTATIONS_CREATOR
// procedures an axis can source WITHOUT a template (sourceAnnotationTypes)
// and that open a params dialog — château d'eau, réservoir.
//
// A system is ASSOCIATED to an axis once its params dialog has been confirmed
// on that axis: the dialog persists the typed cotes on the axis row
// (procedureParams[procedureKey]), and that stored block is the association
// mark every host reads (toolbar bands, axis row menu). An axis with no
// stored block shows the "Associer un système à l'axe" affordance instead of
// one launcher band per registry entry.
export default function getRevolutionAxisProcedures(procedures) {
  return (procedures ?? []).filter(
    (p) =>
      p?.type === "ANNOTATIONS_CREATOR" &&
      Boolean(p.paramsDialog) &&
      (p.sourceAnnotationTypes ?? []).includes("REVOLUTION_AXIS")
  );
}

export function isSystemAssociatedToAxis(axis, procedureKey) {
  return Boolean(axis?.procedureParams?.[procedureKey]);
}

/** Split the axis systems into { associated, available } for one axis. */
export function splitRevolutionAxisProcedures(axis, procedures) {
  const associated = [];
  const available = [];
  for (const p of procedures ?? []) {
    if (isSystemAssociatedToAxis(axis, p.key)) associated.push(p);
    else available.push(p);
  }
  return { associated, available };
}
