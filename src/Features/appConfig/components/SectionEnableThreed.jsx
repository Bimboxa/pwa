import { useSelector, useDispatch } from "react-redux";
import { setEnabled } from "Features/threedEditor/threedEditorSlice";
import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionEnableThreed() {
  const dispatch = useDispatch();

  // strings

  const label = "Activer la 3D (expérimental)";

  const checked = useSelector((s) => s.threedEditor.enabled);

  function handleChange(checked) {
    dispatch(setEnabled(checked));
  }

  return (
    <FieldCheck
      label={label}
      value={checked}
      onChange={handleChange}
      options={{ type: "switch" }}
    />
  );
}
