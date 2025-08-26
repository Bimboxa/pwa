import { useDispatch, useSelector } from "react-redux";

import { setShowBgImage } from "../showerSlice";

import SwitchGeneric from "Features/layout/components/SwitchGeneric";

export default function SwitchShowBgImage() {
  const dispatch = useDispatch();
  // strings

  const label = "Arrière plan";

  // data

  const checked = useSelector((s) => s.shower.showBgImage);

  // handler

  function handleChange() {
    dispatch(setShowBgImage(!checked));
  }

  return (
    <SwitchGeneric checked={checked} onChange={handleChange} label={label} />
  );
}
