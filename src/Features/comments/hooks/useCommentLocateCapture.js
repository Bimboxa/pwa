import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setIsLocatingComment } from "../commentsSlice";

import pickCommentLocationService, {
  buildCommentSnapVerts,
  pickCommentWorldPoint,
} from "../services/pickCommentLocationService";
import { commitLocatedCommentService } from "../services/startAddCommentService";
import {
  THREED_HOST_SELECTOR,
  getMapHostSelector,
  worldToClient,
} from "../utils/commentPinProjection";
import {
  get2dEditorKeyForModule,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// A press that travels more than this is a drag (pan / orbit), not a pick.
const CLICK_MAX_TRAVEL_PX = 5;

// "+ Commentaire localisé" armed: the next LEFT click in the displayed editor
// (2D or 3D) picks the location of the new comment.
//
// The click is taken at the window, in the capture phase, and never reaches
// the editor: it must not select / draw anything there. Everything else goes
// through — wheel zoom, middle / right button pan and orbit — so the author
// can still frame the view before clicking. Escape cancels.
// `onMiss` is called when the click lands on nothing locatable.
//
// While armed, the pointer drives the screen cursor (`cursorRef`,
// CommentLocateCursor): the crosshair of the drawing tools and, in 3D, the
// snap circle on the vertex under it. The click lands on that very point
// (pickCommentWorldPoint resolves both).
export default function useCommentLocateCapture({ active, onMiss, cursorRef }) {
  const dispatch = useDispatch();
  const store = useStore();

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveKey = useSelector(selectEffectiveViewerKey);

  useEffect(() => {
    if (!active) return undefined;

    const is3d = isThreedFamilyViewerKey(effectiveKey);
    const selector = is3d
      ? THREED_HOST_SELECTOR
      : getMapHostSelector(get2dEditorKeyForModule(moduleKey));
    const host = document.querySelector(selector);
    if (!host) return undefined;

    // Crosshair over the whole editor host: its children set their own
    // cursor (canvas, map nodes, `& *` rules of the 2D editor), so the host
    // style alone would not show.
    const cursorStyle = document.createElement("style");
    cursorStyle.textContent = `${selector}, ${selector} * { cursor: crosshair !important; }`;
    document.head.appendChild(cursorStyle);

    // 3D: vertices the pick snaps to, indexed once for the armed pick.
    const snapVerts = is3d ? buildCommentSnapVerts() : null;

    let press = null; // { x, y } of the left press taken inside the host

    // Screen cursor: one update per frame, from the last pointer position.
    let lastMove = null;
    let moveFrame = null;
    const updateCursor = () => {
      moveFrame = null;
      const cursor = cursorRef?.current;
      if (!cursor) return;
      if (!lastMove?.inHost) {
        cursor.hide();
        return;
      }
      const { clientX, clientY } = lastMove;
      const hostRect = host.getBoundingClientRect();
      let snapClient = null;
      let dimmed = false;
      if (is3d) {
        const pick = pickCommentWorldPoint({ clientX, clientY, snapVerts });
        dimmed = !pick;
        if (pick?.isVertex) {
          snapClient = worldToClient({ worldPosition: pick.world, hostRect });
        }
      }
      cursor.update({ clientX, clientY, hostRect, snapClient, dimmed });
    };
    const onMove = (e) => {
      lastMove = {
        clientX: e.clientX,
        clientY: e.clientY,
        inHost: host.contains(e.target),
      };
      if (moveFrame === null) moveFrame = requestAnimationFrame(updateCursor);
    };

    const swallow = (e) => {
      e.stopPropagation();
      e.preventDefault();
    };
    const isLeftInHost = (e) => e.button === 0 && host.contains(e.target);

    const onDown = (e) => {
      if (!isLeftInHost(e)) return;
      swallow(e);
      if (e.type === "pointerdown") press = { x: e.clientX, y: e.clientY };
    };
    // The compatibility mouseup follows the pointerup of the same press.
    let swallowMouseUp = false;
    const onUp = async (e) => {
      if (e.button !== 0) return;
      if (e.type === "mouseup") {
        if (swallowMouseUp) swallow(e);
        swallowMouseUp = false;
        return;
      }
      if (!press) return;
      swallow(e);
      swallowMouseUp = true;
      const start = press;
      press = null;
      const travel = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (travel > CLICK_MAX_TRAVEL_PX) return;
      const location = await pickCommentLocationService({
        clientX: e.clientX,
        clientY: e.clientY,
        snapVerts,
      });
      if (!location) {
        onMiss?.();
        return;
      }
      await commitLocatedCommentService({ location, dispatch, store });
    };
    const onClick = (e) => {
      if (isLeftInHost(e)) swallow(e);
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      dispatch(setIsLocatingComment(false));
    };

    const capture = { capture: true };
    window.addEventListener("pointermove", onMove, capture);
    window.addEventListener("pointerdown", onDown, capture);
    window.addEventListener("mousedown", onDown, capture);
    window.addEventListener("pointerup", onUp, capture);
    window.addEventListener("mouseup", onUp, capture);
    window.addEventListener("click", onClick, capture);
    window.addEventListener("keydown", onKeyDown, capture);

    return () => {
      cursorStyle.remove();
      if (moveFrame !== null) cancelAnimationFrame(moveFrame);
      cursorRef?.current?.hide();
      window.removeEventListener("pointermove", onMove, capture);
      window.removeEventListener("pointerdown", onDown, capture);
      window.removeEventListener("mousedown", onDown, capture);
      window.removeEventListener("pointerup", onUp, capture);
      window.removeEventListener("mouseup", onUp, capture);
      window.removeEventListener("click", onClick, capture);
      window.removeEventListener("keydown", onKeyDown, capture);
    };
  }, [active, effectiveKey, moduleKey, dispatch, store, onMiss, cursorRef]);
}
