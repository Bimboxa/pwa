import { useEffect } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { setIsLocatingComment } from "../commentsSlice";

import pickCommentLocationService from "../services/pickCommentLocationService";
import { commitLocatedCommentService } from "../services/startAddCommentService";
import {
  THREED_HOST_SELECTOR,
  getMapHostSelector,
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
export default function useCommentLocateCapture({ active, onMiss }) {
  const dispatch = useDispatch();
  const store = useStore();

  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveKey = useSelector(selectEffectiveViewerKey);

  useEffect(() => {
    if (!active) return undefined;

    const selector = isThreedFamilyViewerKey(effectiveKey)
      ? THREED_HOST_SELECTOR
      : getMapHostSelector(get2dEditorKeyForModule(moduleKey));
    const host = document.querySelector(selector);
    if (!host) return undefined;

    const previousCursor = host.style.cursor;
    host.style.cursor = "crosshair";

    let press = null; // { x, y } of the left press taken inside the host

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
    window.addEventListener("pointerdown", onDown, capture);
    window.addEventListener("mousedown", onDown, capture);
    window.addEventListener("pointerup", onUp, capture);
    window.addEventListener("mouseup", onUp, capture);
    window.addEventListener("click", onClick, capture);
    window.addEventListener("keydown", onKeyDown, capture);

    return () => {
      host.style.cursor = previousCursor;
      window.removeEventListener("pointerdown", onDown, capture);
      window.removeEventListener("mousedown", onDown, capture);
      window.removeEventListener("pointerup", onUp, capture);
      window.removeEventListener("mouseup", onUp, capture);
      window.removeEventListener("click", onClick, capture);
      window.removeEventListener("keydown", onKeyDown, capture);
    };
  }, [active, effectiveKey, moduleKey, dispatch, store, onMiss]);
}
