import { forwardRef, useId, useImperativeHandle, useRef } from "react";
import { useSelector } from "react-redux";

import ScreenCursorV2 from "Features/mapEditorGeneric/components/ScreenCursorV2";

import { COMMENT_COLORS } from "../commentsDarkTheme";
import { selectEffectiveViewerKey } from "Features/viewers/utils/effectiveViewerKey";
import { isThreedFamilyViewerKey } from "Features/viewers/utils/threedViewerKeys";

// Vertex snap marker: the snap circle of the 3D drawing overlay
// (DrawingOverlayThreed).
const SNAP_CIRCLE_RADIUS_PX = 6;
const SNAP_CIRCLE_STROKE_PX = 1.5;
const SNAP_CIRCLE_COLOR = "#ff2d8d";
// Crosshair over a spot where nothing can be located (3D empty space).
const DIMMED_OPACITY = 0.35;

// Screen cursor of the located-info pick ("+ Info localisée" armed): the
// crosshair of the drawing tools (ScreenCursorV2) over the displayed editor,
// plus the snap circle on the vertex the click will land on (3D).
//
// Driven imperatively by useCommentLocateCapture, in CLIENT px:
//   update({ clientX, clientY, hostRect, snapClient, dimmed }) / hide()
// The crosshair is clipped to the editor host (`hostRect`).
const CommentLocateCursor = forwardRef(function CommentLocateCursor(_, ref) {
  // data

  const is3d = useSelector((s) =>
    isThreedFamilyViewerKey(selectEffectiveViewerKey(s))
  );
  // 2D: the branches follow the ortho angle, like the drawing crosshair.
  const orthoSnapAngleOffset = useSelector(
    (s) => s.mapEditor.orthoSnapAngleOffset
  );

  // helpers

  const svgRef = useRef(null);
  const groupRef = useRef(null);
  const clipRectRef = useRef(null);
  const screenCursorRef = useRef(null);
  const snapCircleRef = useRef(null);
  const clipId = `comment-locate-clip-${useId().replace(/:/g, "-")}`;

  useImperativeHandle(ref, () => ({
    update: ({ clientX, clientY, hostRect, snapClient, dimmed }) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      const group = groupRef.current;
      if (!svgRect || !group) return;

      const clipRect = clipRectRef.current;
      if (clipRect && hostRect) {
        clipRect.setAttribute("x", hostRect.left - svgRect.left);
        clipRect.setAttribute("y", hostRect.top - svgRect.top);
        clipRect.setAttribute("width", hostRect.width);
        clipRect.setAttribute("height", hostRect.height);
      }

      screenCursorRef.current?.move(
        clientX - svgRect.left,
        clientY - svgRect.top
      );

      const circle = snapCircleRef.current;
      if (circle) {
        if (snapClient) {
          circle.setAttribute("cx", snapClient.x - svgRect.left);
          circle.setAttribute("cy", snapClient.y - svgRect.top);
          circle.style.display = "";
        } else {
          circle.style.display = "none";
        }
      }

      group.style.opacity = dimmed ? DIMMED_OPACITY : 1;
      group.style.display = "";
    },
    hide: () => {
      if (groupRef.current) groupRef.current.style.display = "none";
    },
  }));

  // render

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs>
        <clipPath id={clipId}>
          <rect ref={clipRectRef} x={0} y={0} width={0} height={0} />
        </clipPath>
      </defs>
      <g
        ref={groupRef}
        clipPath={`url(#${clipId})`}
        style={{ display: "none" }}
      >
        <ScreenCursorV2
          ref={screenCursorRef}
          visible
          newAnnotation={{ strokeColor: COMMENT_COLORS.accent }}
          rotationAngle={is3d ? 0 : orthoSnapAngleOffset || 0}
        />
        <circle
          ref={snapCircleRef}
          r={SNAP_CIRCLE_RADIUS_PX}
          stroke={SNAP_CIRCLE_COLOR}
          strokeWidth={SNAP_CIRCLE_STROKE_PX}
          fill="none"
          style={{ display: "none" }}
        />
      </g>
    </svg>
  );
});

export default CommentLocateCursor;
