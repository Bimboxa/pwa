import { useDispatch, useSelector } from "react-redux";

import FieldCheck from "Features/form/components/FieldCheck";
import { setShowOpencvPreview } from "../opencvSlice";

export default function ButtonToggleShowOpencvPreview() {
  const dispatch = useDispatch();

  const show = useSelector((state) => state.opencv.showOpencvPreview);

  const label = "Afficher l'image modifiée";

  function handleChange(checked) {
    dispatch(setShowOpencvPreview(checked));
  }

  return (
    <FieldCheck
      options={{ type: "switch" }}
      onChange={handleChange}
      label={label}
      value={show}
    />
  );
}
