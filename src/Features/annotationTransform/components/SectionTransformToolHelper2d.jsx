import SectionTransformToolHelper from "./SectionTransformToolHelper";

import {
  getMoveToolHint,
  getRotateToolHint,
  MOVE_TOOL_SHORTCUTS,
  ROTATE_TOOL_SHORTCUTS,
} from "../constants/transformToolStrings";
import {
  setRotateAngleBuffer,
  useTransformSession,
} from "../services/transformSessionStore";
import { MOVE_ANNOTATION_MODE } from "../utils/transformToolModes";

const ROTATE_TOOL_SHORTCUTS_2D = [
  { key: "⇧", label: "Tourner par pas de 15°" },
  ...ROTATE_TOOL_SHORTCUTS,
];

// ---------------------------------------------------------------------------
// SectionTransformToolHelper2d — drawing-helper body of the 2D « Déplacer » /
// « Tourner » tools (`mode` = the armed drawing mode), fed by the tool's
// session store. Same texts as the 3D tools (SectionThreedToolHelperContent).
// ---------------------------------------------------------------------------

export default function SectionTransformToolHelper2d({ mode }) {
  // data

  const session = useTransformSession();

  // helpers

  const carriedCount = session.carriedAnnotationIds.length;
  const referenceSet = Boolean(session.reference);

  // render

  if (mode === MOVE_ANNOTATION_MODE) {
    return (
      <SectionTransformToolHelper
        hint={getMoveToolHint({ carriedCount })}
        shortcuts={MOVE_TOOL_SHORTCUTS}
      />
    );
  }

  return (
    <SectionTransformToolHelper
      hint={getRotateToolHint({ carriedCount, referenceSet })}
      field={
        referenceSet
          ? {
              label: "Angle",
              unit: "°",
              value: session.angleBuffer,
              onChangeText: setRotateAngleBuffer,
            }
          : null
      }
      shortcuts={ROTATE_TOOL_SHORTCUTS_2D}
    />
  );
}
