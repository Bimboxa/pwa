import { useSelector, useDispatch } from "react-redux";

import { setEnableMapEditorLegacy } from "Features/appConfig/appConfigSlice";

import FieldCheck from "Features/form/components/FieldCheck";

export default function SectionEnableMapEditorLegacy() {
  const dispatch = useDispatch();

  // string

  const label = "Dessin Legacy";

  // data

  const checked = useSelector((s) => s.appConfig.enableMapEditorLegacy);

  //handlers

  function handleChange(e) {
    dispatch(setEnableMapEditorLegacy(e));
  }

  return <FieldCheck label={label} value={checked} onChange={handleChange} options={{ type: "switch" }} />;
}