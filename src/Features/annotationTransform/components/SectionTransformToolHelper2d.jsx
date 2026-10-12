import SectionTransformToolHelper from "./SectionTransformToolHelper";
import SectionTypedConstraint from "./SectionTypedConstraint";

import {
  getMoveToolHint,
  getRotateToolHint,
  MOVE_TOOL_SHORTCUTS,
  ROTATE_TOOL_SHORTCUTS,
} from "../constants/transformToolStrings";
import {
  getTransformCopyCount,
  setMoveCopyBuffer,
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
// The typed buffer (distance / angle, copies) is shown and editable in the
// SectionTypedConstraint card.
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
        hint={getMoveToolHint({
          carriedCount,
          copyCount: getTransformCopyCount(session),
        })}
        shortcuts={MOVE_TOOL_SHORTCUTS}
      >
        <SectionTypedConstraint
          variant="MOVE"
          buffer={session.copyBuffer}
          onChangeBuffer={setMoveCopyBuffer}
          disabled={session.kind !== "MOVE"}
        />
      </SectionTransformToolHelper>
    );
  }

  return (
    <SectionTransformToolHelper
      hint={getRotateToolHint({
        carriedCount,
        referenceSet,
        copyCount: getTransformCopyCount(session),
      })}
      shortcuts={ROTATE_TOOL_SHORTCUTS_2D}
    >
      <SectionTypedConstraint
        variant="ROTATE"
        buffer={session.angleBuffer}
        onChangeBuffer={setRotateAngleBuffer}
        disabled={!referenceSet}
      />
    </SectionTransformToolHelper>
  );
}
