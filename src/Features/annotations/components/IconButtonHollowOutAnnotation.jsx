import ToolbarToolButton from "./ToolbarToolButton";
import IconHollowOut from "./IconHollowOut";

import useHollowOutAnnotation from "../hooks/useHollowOutAnnotation";

// "Evider": carve the selected POLYGON by the footprints of every visible
// annotation. The carve itself lives in useHollowOutAnnotation, shared with
// the "E" keyboard shortcut (InteractionLayer).
export default function IconButtonHollowOutAnnotation({
  annotation,
  accentColor,
}) {
  // handlers

  const hollowOutAnnotation = useHollowOutAnnotation();

  // render

  return (
    <ToolbarToolButton
      icon={<IconHollowOut fontSize="small" />}
      label="Evider (découper par les annotations visibles) — E"
      onClick={() => hollowOutAnnotation(annotation)}
      accentColor={accentColor}
    />
  );
}
