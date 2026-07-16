import { useSelector, useDispatch } from "react-redux";

import { setImageModeWhiteBackground } from "../mapEditorSlice";

import FieldCheck from "Features/form/components/FieldCheck";

// Capture framing options (white background), driving the shared imageMode
// state used by the capture pipeline. Used by SectionCaptureExport ("Export
// rapide") and by the POV Cadrage tab. The "Haute définition" switch is NOT
// here: resolution only applies at export time (SectionCaptureExport).
export default function SectionCaptureOptions() {
  const dispatch = useDispatch();

  // data

  const whiteBackground = useSelector(
    (s) => s.mapEditor.imageModeWhiteBackground
  );

  // handlers

  function handleToggleWhiteBackground(checked) {
    dispatch(setImageModeWhiteBackground(Boolean(checked)));
  }

  // render

  return (
    <FieldCheck
      value={whiteBackground}
      onChange={handleToggleWhiteBackground}
      label="Fond blanc"
      options={{ type: "switch", showAsInline: true }}
    />
  );
}
