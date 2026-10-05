import FieldProcedureKeys from "Features/annotationsAuto/components/FieldProcedureKeys";

export default function FieldProcedure({ annotationTemplate, onChange }) {
  // handlers

  function handleChange(keys) {
    onChange({ ...annotationTemplate, procedureKeys: keys });
  }

  // render

  return (
    <FieldProcedureKeys
      value={annotationTemplate?.procedureKeys}
      onChange={handleChange}
    />
  );
}
