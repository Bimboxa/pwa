import { useEffect, useRef } from "react";

import { useSelector } from "react-redux";

import CursorAltitudeBadge from "Features/mapEditorGeneric/components/CursorAltitudeBadge";
import { prepareScene3dPicking } from "Features/scene3d/services/intersectScene3d";
import { pickWorldHitAtNdc } from "Features/threedMesh/services/shootPick";

// Altimetry under the cursor in the 3D editor: the badge of the 2D editor
// (CursorAltitudeBadge) follows the pointer with the absolute altitude of
// the surface under it. The scene is Y-up and every base map group sits at
// its "Z" (getBaseMapTransform().position.y), annotations are children of
// that group and scans are posed at `position.y + (z − zMin)`: the world Y
// of the picked point IS the absolute altitude, no height lookup needed.
//
// Self-contained child of MainThreedEditor — its own pointer listeners on
// the canvas, a rAF-coalesced pick and imperative badge writes — so the
// parent never re-renders on a pointer move (see runHoverRaycast). The
// preference is the one of the 2D editor (mapEditor.cursorAltitudeEnabled,
// toggled by ButtonToggleCursorAltitude / the settings switch).
//
// `hidden`: walk mode (pointer locked) and capture framing, computed by the
// parent which already selects those flags.
const PENDING_MAIN = "Z …";
const PENDING_SECONDARY = "relief en préparation";

export default function CursorAltitudeThreed({
  threedEditorRef,
  containerRef,
  rendererIsReady,
  hidden = false,
}) {
  // data

  const enabled = useSelector((s) => s.mapEditor.cursorAltitudeEnabled);
  // Bumped when the base map groups / annotation objects are (re)loaded: a
  // scan shown while the mode is on gets its picking data too.
  const annotationsLoadTick = useSelector(
    (s) => s.threedEditor.annotationsLoadTick
  );
  const baseMapsLoadTick = useSelector((s) => s.threedEditor.baseMapsLoadTick);

  const active = Boolean(enabled && !hidden && rendererIsReady);

  // state

  const badgeRef = useRef(null);
  const rafRef = useRef(null);
  const lastEventRef = useRef(null);

  // Scan base maps never answer a three.js raycast: their CPU picking data
  // is built on demand (scene3dPickStore) — start right away, not on the
  // first pointer move.
  useEffect(() => {
    if (!active) return;
    prepareScene3dPicking(threedEditorRef.current);
  }, [active, annotationsLoadTick, baseMapsLoadTick, threedEditorRef]);

  useEffect(() => {
    if (!active) return;
    const editor = threedEditorRef.current;
    const renderer = editor?.sceneManager?.renderer;
    const dom = renderer?.domElement;
    if (!dom) return;

    const tick = () => {
      rafRef.current = null;
      const event = lastEventRef.current;
      const badge = badgeRef.current;
      if (!event || !badge) return;
      const sceneManager = editor.sceneManager;
      const container = containerRef.current;
      if (!sceneManager?.camera || !container) return;

      const rect = dom.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      const hit = pickWorldHitAtNdc({ sceneManager, ndcX, ndcY, editor });

      const containerRect = container.getBoundingClientRect();
      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top;

      if (hit.isHit) {
        badge.update({
          x,
          y,
          main: `Z ${hit.point.y.toFixed(2)} m`,
          secondary: "",
        });
        return;
      }
      // Nothing under the pointer but a scan still being prepared: same
      // message as the 2D badge.
      if (prepareScene3dPicking(editor)) {
        badge.update({
          x,
          y,
          main: PENDING_MAIN,
          secondary: PENDING_SECONDARY,
        });
        return;
      }
      badge.hide();
    };

    const onPointerMove = (event) => {
      lastEventRef.current = event;
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
    };
    const onPointerLeave = () => {
      lastEventRef.current = null;
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      badgeRef.current?.hide();
    };

    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerleave", onPointerLeave);
    return () => {
      dom.removeEventListener("pointermove", onPointerMove);
      dom.removeEventListener("pointerleave", onPointerLeave);
      onPointerLeave();
    };
  }, [active, threedEditorRef, containerRef]);

  // render

  if (!active) return null;
  return <CursorAltitudeBadge ref={badgeRef} />;
}
