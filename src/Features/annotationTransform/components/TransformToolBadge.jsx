import { useEffect, useRef } from "react";

import DrawingLengthBadge from "Features/mapEditorGeneric/components/DrawingLengthBadge";

import {
  getTransformCopyCount,
  useTransformSession,
} from "../services/transformSessionStore";
import {
  formatAngleValueBuffer,
  formatMoveBadge,
  formatMoveLengthBuffer,
  formatRotateBadge,
} from "../utils/copyBuffer";
import { formatUserAngle } from "../utils/rotateAngle";

// ---------------------------------------------------------------------------
// TransformToolBadge — value badge of the 2D « Déplacer » / « Tourner »
// tools, mounted in InteractionLayer's HTML overlay (viewport space, outside
// the camera) next to the segment-length badge, and the SAME component
// (DrawingLengthBadge: black pill, padlock when the value is typed).
// MOVE: the travelled distance and the copy count ("1.300 m ×3") next to
// the cursor. ROTATE 3/3: the angle and the copy count ("45° ×3") at the
// end of the current axis (the cursor when mouse-driven, the typed angle's
// axis otherwise). A typed value shows the RAW buffer, locked, from its
// first character ("-", "1.") — same as the segment-length badge — so the
// constraint mode is visible at once.
//
// projectToViewport(pixelPoint) → viewport px — the parent's camera mapping,
// read through a ref so the badge follows the latest camera without
// re-attaching the effect.
// ---------------------------------------------------------------------------

export default function TransformToolBadge({
  projectToViewport,
  baseMapMeterByPx,
}) {
  // data

  const session = useTransformSession();

  const badgeRef = useRef(null);
  const projectRef = useRef(projectToViewport);
  projectRef.current = projectToViewport;

  // effects

  useEffect(() => {
    const badge = badgeRef.current;
    if (!badge) return;
    const { kind, anchor, reference, cursor, angleDeg } = session;
    if (!kind || !anchor || !cursor || session.committing) {
      badge.hide();
      return;
    }
    const copyCount = getTransformCopyCount(session);
    let text = "";
    let locked = false;
    let point = cursor;

    if (kind === "MOVE") {
      const typed = formatMoveLengthBuffer(session.copyBuffer);
      if (typed !== "—") {
        text = formatRotateBadge({
          angleLabel: `${typed} m`,
          count: copyCount,
          repeat: session.repeat,
        });
        locked = true;
      } else {
        const lengthM =
          baseMapMeterByPx > 0
            ? Math.hypot(cursor.x - anchor.x, cursor.y - anchor.y) *
              baseMapMeterByPx
            : undefined;
        text = formatMoveBadge({
          lengthM,
          count: copyCount,
          repeat: session.repeat,
        });
      }
    } else if (kind === "ROTATE" && reference) {
      const rx = reference.x - anchor.x;
      const ry = reference.y - anchor.y;
      const rad = (angleDeg * Math.PI) / 180;
      point = {
        x: anchor.x + rx * Math.cos(rad) - ry * Math.sin(rad),
        y: anchor.y + rx * Math.sin(rad) + ry * Math.cos(rad),
      };
      const typed = formatAngleValueBuffer(session.angleBuffer);
      text = formatRotateBadge({
        angleLabel: typed ? `${typed}°` : formatUserAngle(angleDeg),
        count: copyCount,
      });
      locked = typed !== "";
    }

    const screen = text ? projectRef.current?.(point) : null;
    if (!screen) {
      badge.hide();
      return;
    }
    badge.update({ x: screen.x, y: screen.y, text, locked });
  }, [session, baseMapMeterByPx]);

  useEffect(() => () => badgeRef.current?.hide(), []);

  // render

  return <DrawingLengthBadge ref={badgeRef} />;
}
