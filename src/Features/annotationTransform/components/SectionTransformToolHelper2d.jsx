import SectionMoveRepeatOptions from "./SectionMoveRepeatOptions";
import SectionTransformToolHelper from "./SectionTransformToolHelper";
import SectionTypedConstraint from "./SectionTypedConstraint";

import {
  getMoveToolHint,
  getRotateToolHint,
  MOVE_TOOL_SHORTCUTS,
  ROTATE_TOOL_SHORTCUTS,
} from "../constants/transformToolStrings";
import {
  armMoveCopy,
  getTransformCopyCount,
  setMoveCopyBuffer,
  setRotateAngleBuffer,
  toggleTransformRepeat,
  useTransformSession,
} from "../services/transformSessionStore";
import { parseCopyCount } from "../utils/copyBuffer";
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
// SectionTypedConstraint card — for « Déplacer » before the grab too (the
// next grab picks it up), with the « Recommencer à chaque clic » / « Copier »
// card (SectionMoveRepeatOptions) under it.
// ---------------------------------------------------------------------------

export default function SectionTransformToolHelper2d({ mode }) {
  // data

  const session = useTransformSession();

  // helpers

  const carriedCount = session.carriedAnnotationIds.length;
  const referenceSet = Boolean(session.reference);

  // render

  if (mode === MOVE_ANNOTATION_MODE) {
    // Armed: the buffer typed ahead of the grab; carrying: the session's.
    const copyCount =
      session.kind === "MOVE"
        ? getTransformCopyCount(session)
        : parseCopyCount(session.copyBuffer);
    return (
      <SectionTransformToolHelper
        hint={getMoveToolHint({
          carriedCount,
          copyCount,
          repeat: session.repeat,
        })}
        shortcuts={MOVE_TOOL_SHORTCUTS}
      >
        <SectionTypedConstraint
          variant="MOVE"
          buffer={session.copyBuffer}
          onChangeBuffer={setMoveCopyBuffer}
          disabled={session.committing}
        />
        <SectionMoveRepeatOptions
          repeat={session.repeat}
          onToggleRepeat={toggleTransformRepeat}
          onCopy={armMoveCopy}
          copyDisabled={session.copiesRefused || session.committing}
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
