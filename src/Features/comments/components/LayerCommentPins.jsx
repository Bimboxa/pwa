import { useEffect, useRef } from "react";
import { useDispatch, useSelector, useStore } from "react-redux";

import { Box } from "@mui/material";

import CommentPill from "./CommentPill";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import openCommentService from "../services/openCommentService";
import {
  THREED_HOST_SELECTOR,
  baseMapNormalizedToClient,
  getEditorHostRect,
  getMapHostSelector,
  worldToClient,
} from "../utils/commentPinProjection";
import {
  get2dEditorKeyForModule,
  selectEffectiveViewerKey,
} from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

const PIN_SIZE = 26;

// Pins of the LOCATED comments, drawn over the displayed editor at the very
// point picked by the author:
// - 2D: comments located on the main base map, at their normalized point;
// - 3D: every comment with a world position, projected through the camera
//   (no occlusion: a pin stays visible through the model).
// A DOM layer, not scene objects: same pill as the strip, crisp at any zoom,
// and nothing to keep out of the annotations pipeline. Positions are written
// straight to the elements on every frame (no React render per camera move).
export default function LayerCommentPins({ comments }) {
  const dispatch = useDispatch();
  const store = useStore();

  // strings

  const untitledS = "Sans titre";

  // data

  const openedCommentId = useSelector((s) => s.comments.openedCommentId);
  const moduleKey = useSelector((s) => s.viewers.selectedViewerKey);
  const effectiveKey = useSelector(selectEffectiveViewerKey);
  const mainBaseMap = useMainBaseMap();

  // helpers

  const isThreed = isThreedFamilyViewerKey(effectiveKey);
  const mainBaseMapId = mainBaseMap?.id ?? null;
  const pins = comments.filter((c) =>
    isThreed
      ? Boolean(c.location?.worldPosition)
      : Boolean(c.location?.point) && c.location.baseMapId === mainBaseMapId
  );

  // state

  const rootRef = useRef(null);
  const pinElsRef = useRef(new Map());
  const latestRef = useRef({});
  latestRef.current = { pins, isThreed, mainBaseMap, moduleKey };

  // effects

  const hasPins = pins.length > 0;
  useEffect(() => {
    if (!hasPins) return undefined;
    let rafId = null;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const root = rootRef.current;
      if (!root) return;
      const { pins, isThreed, mainBaseMap, moduleKey } = latestRef.current;
      const rootRect = root.getBoundingClientRect();
      const hostRect = getEditorHostRect(
        isThreed
          ? THREED_HOST_SELECTOR
          : getMapHostSelector(get2dEditorKeyForModule(moduleKey))
      );
      const basePose = store.getState().mapEditor.baseMapPoseInBg;
      const imageSize = isThreed ? null : mainBaseMap?.getImageSize?.();

      for (const comment of pins) {
        const el = pinElsRef.current.get(comment.id);
        if (!el) continue;
        const client = !hostRect
          ? null
          : isThreed
            ? worldToClient({
                worldPosition: comment.location.worldPosition,
                hostRect,
              })
            : baseMapNormalizedToClient({
                point: comment.location.point,
                hostRect,
                basePose,
                imageSize,
              });
        const visible =
          client &&
          client.x >= hostRect.left &&
          client.x <= hostRect.right &&
          client.y >= hostRect.top &&
          client.y <= hostRect.bottom;
        if (!visible) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.transform = `translate(${Math.round(
          client.x - rootRect.left - PIN_SIZE / 2
        )}px, ${Math.round(client.y - rootRect.top - PIN_SIZE / 2)}px)`;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [hasPins, store]);

  // render

  return (
    <Box
      ref={rootRef}
      data-capture-hide
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 9,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {pins.map((comment) => (
        <Box
          key={comment.id}
          ref={(el) => {
            if (el) pinElsRef.current.set(comment.id, el);
            else pinElsRef.current.delete(comment.id);
          }}
          sx={{
            position: "absolute",
            left: 0,
            top: 0,
            // placed by the frame loop; hidden until its first pass
            visibility: "hidden",
            pointerEvents: "auto",
          }}
        >
          <CommentPill
            num={comment.num}
            title={comment.title || untitledS}
            active={comment.id === openedCommentId}
            size={PIN_SIZE}
            tooltipPlacement="top"
            onClick={() => openCommentService({ comment, dispatch })}
          />
        </Box>
      ))}
    </Box>
  );
}
