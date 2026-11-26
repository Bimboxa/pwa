import { forwardRef, useImperativeHandle, useRef } from "react";

const DEFAULT_COLOR = "#e6007e";
const OPACITY = 0.35;
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Highlighter of the « Vectoriser au surligneur » drawing tool: the strokes
 * (one translucent round path each) and the disc under the cursor.
 *
 * The DOM is written directly (no React render per mouse move).
 *
 * Imperative API — everything in the coordinates of the parent group:
 *   update({ strokes, isHighlighting, cursor, cursorRadius })
 *     strokes: [{ points, radius }] — axis and half-width of each stroke
 *     isHighlighting: a stroke is being drawn (the disc is its tip)
 *     cursor / cursorRadius: disc under the cursor (none: no disc)
 *   clear()
 */
const TransientHighlightStrokeLayer = forwardRef(
  ({ color = DEFAULT_COLOR }, ref) => {
    // data

    const groupRef = useRef(null);
    const strokesRef = useRef(null);
    const circleRef = useRef(null);

    useImperativeHandle(ref, () => ({
      update: ({ strokes, isHighlighting, cursor, cursorRadius } = {}) => {
        const group = groupRef.current;
        const strokesGroup = strokesRef.current;
        const circle = circleRef.current;
        if (!group || !strokesGroup || !circle) return;
        group.style.display = "";

        // one <path> per stroke, reused from one update to the next
        const visible = (strokes ?? []).filter(
          (stroke) => stroke?.points?.length > 0 && stroke.radius > 0
        );
        while (strokesGroup.childNodes.length > visible.length) {
          strokesGroup.removeChild(strokesGroup.lastChild);
        }
        while (strokesGroup.childNodes.length < visible.length) {
          const path = document.createElementNS(SVG_NS, "path");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-linecap", "round");
          path.setAttribute("stroke-linejoin", "round");
          strokesGroup.appendChild(path);
        }
        visible.forEach(({ points, radius }, index) => {
          // a single point still draws a disc (round caps)
          const [first, ...others] = points;
          const d = [`M ${first.x} ${first.y}`, `L ${first.x} ${first.y}`];
          for (const p of others) d.push(`L ${p.x} ${p.y}`);
          const path = strokesGroup.childNodes[index];
          path.setAttribute("d", d.join(" "));
          path.setAttribute("stroke-width", String(2 * radius));
        });

        if (cursor && cursorRadius > 0) {
          circle.setAttribute("cx", String(cursor.x));
          circle.setAttribute("cy", String(cursor.y));
          circle.setAttribute("r", String(cursorRadius));
          // at the tip of a stroke, the outline alone: no darker spot
          circle.setAttribute(
            "fill-opacity",
            isHighlighting ? "0" : String(OPACITY)
          );
          circle.style.display = "";
        } else {
          circle.style.display = "none";
        }
      },
      clear: () => {
        if (groupRef.current) groupRef.current.style.display = "none";
      },
    }));

    // render

    return (
      <g ref={groupRef} style={{ display: "none" }} pointerEvents="none">
        <g ref={strokesRef} stroke={color} strokeOpacity={OPACITY} />
        <circle
          ref={circleRef}
          fill={color}
          stroke={color}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      </g>
    );
  }
);

TransientHighlightStrokeLayer.displayName = "TransientHighlightStrokeLayer";

export default TransientHighlightStrokeLayer;
