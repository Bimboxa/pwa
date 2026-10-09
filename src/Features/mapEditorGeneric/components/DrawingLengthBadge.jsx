import { forwardRef, useImperativeHandle, useRef } from "react";

// Length badge of the drawing previews (2D and 3D editors): the segment
// being drawn next to the cursor, the two sides of a rectangle at their
// midpoints. Same imperative pattern as CursorAltitudeBadge: the parent
// drives it on every pointer move (position through `style.transform`, text
// through `textContent`) — no React state, no re-render per move.
//
// ref API:
//   update({ x, y, text, locked, active, anchor, color })
//     x, y     — container px
//     anchor   — "cursor" (default): below-right of the point, clear of the
//                altitude badge which sits above-right; "center": centred
//                on the point (rectangle side labels)
//     locked   — "typed constraint" look (primary background + padlock)
//     color    — background when not locked (CSS colour, e.g. the colour of
//                the axis the segment runs along in 3D); default: black
//     active   — the dimension currently being typed (X / Y): outlined
//   hide()
const OFFSET_X = 18;
const OFFSET_Y = 14;

const BG_FREE = "rgba(0, 0, 0, 0.8)";
const BG_LOCKED = "#1976d2";
const OUTLINE_ACTIVE = "2px solid #ffab00";

const DrawingLengthBadge = forwardRef(function DrawingLengthBadge(_, ref) {
  const rootRef = useRef(null);
  const textRef = useRef(null);
  const lockRef = useRef(null);
  const lockedRef = useRef(false);
  const backgroundRef = useRef(BG_FREE);
  const activeRef = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      update({ x, y, text, locked, active, anchor = "cursor", color }) {
        const root = rootRef.current;
        if (!root) return;
        root.style.transform =
          anchor === "center"
            ? `translate(${x}px, ${y}px) translate(-50%, -50%)`
            : `translate(${x + OFFSET_X}px, ${y + OFFSET_Y}px)`;
        root.style.display = "flex";
        if (textRef.current && textRef.current.textContent !== text) {
          textRef.current.textContent = text;
        }
        const isLocked = Boolean(locked);
        if (lockedRef.current !== isLocked) {
          lockedRef.current = isLocked;
          if (lockRef.current) {
            lockRef.current.style.display = isLocked ? "block" : "none";
          }
        }
        const background = isLocked ? BG_LOCKED : color || BG_FREE;
        if (backgroundRef.current !== background) {
          backgroundRef.current = background;
          root.style.backgroundColor = background;
        }
        const isActive = Boolean(active);
        if (activeRef.current !== isActive) {
          activeRef.current = isActive;
          root.style.outline = isActive ? OUTLINE_ACTIVE : "none";
        }
      },
      hide() {
        if (rootRef.current) rootRef.current.style.display = "none";
      },
    }),
    []
  );

  return (
    <div
      ref={rootRef}
      data-capture-hide
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        display: "none",
        alignItems: "center",
        gap: 4,
        pointerEvents: "none",
        willChange: "transform",
        zIndex: 9998,
        padding: "2px 7px",
        borderRadius: 4,
        backgroundColor: BG_FREE,
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      <span ref={textRef} style={{ display: "block", fontWeight: 600 }} />
      {/* Padlock (inline SVG so the badge stays imperative, no MUI icon) */}
      <svg
        ref={lockRef}
        width="11"
        height="12"
        viewBox="0 0 11 12"
        style={{ display: "none", flexShrink: 0 }}
        aria-hidden="true"
      >
        <rect x="1" y="5" width="9" height="6.5" rx="1.2" fill="#fff" />
        <path
          d="M3 5V3.4a2.5 2.5 0 0 1 5 0V5"
          fill="none"
          stroke="#fff"
          strokeWidth="1.4"
        />
      </svg>
    </div>
  );
});

export default DrawingLengthBadge;
