import {useSelector, useDispatch} from "react-redux";

import {setUseDefault} from "../appConfigSlice";

import SwitchGeneric from "Features/layout/components/SwitchGeneric";

export default function SwitchUseDefault() {
  const dispatch = useDispatch();

  // strings

  const label = "Configuration par défaut";

  // data

  const checked = useSelector((s) => s.appConfig.useDefault);

  // handlers

  function handleChange(checked) {
    dispatch(setUseDefault(checked));
  }
  return (
    <SwitchGeneric checked={checked} onChange={handleChange} label={label} />
  );
}
