import { forwardRef, useImperativeHandle, useRef } from "react";

// Badge following the pointer with the altitude under the cursor (2D
// editor, "altimetry" mode). Lives in the screen-fixed HTML overlay of the
// viewport; the parent drives it IMPERATIVELY on every pointer move
// (position through `style.transform`, values through `textContent`) —
// no React state, no re-render per move, like the MapTooltip position.
//
// ref API: update({x, y, main, secondary}) — viewport px + texts (the
// secondary line is hidden when empty); hide().
const OFFSET_X = 18;
const OFFSET_Y = -30;

const CursorAltitudeBadge = forwardRef(function CursorAltitudeBadge(_, ref) {
  const rootRef = useRef(null);
  const mainRef = useRef(null);
  const secondaryRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      update({ x, y, main, secondary }) {
        const root = rootRef.current;
        if (!root) return;
        root.style.transform = `translate(${x + OFFSET_X}px, ${y + OFFSET_Y}px)`;
        root.style.display = "block";
        if (mainRef.current && mainRef.current.textContent !== main) {
          mainRef.current.textContent = main;
        }
        const secondaryEl = secondaryRef.current;
        if (secondaryEl) {
          const text = secondary || "";
          if (secondaryEl.textContent !== text) secondaryEl.textContent = text;
          secondaryEl.style.display = text ? "block" : "none";
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
        pointerEvents: "none",
        willChange: "transform",
        zIndex: 9998,
        padding: "2px 7px",
        borderRadius: 4,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "#fff",
        fontFamily: "monospace",
        fontSize: 12,
        lineHeight: "16px",
        whiteSpace: "nowrap",
      }}
    >
      <span ref={mainRef} style={{ display: "block", fontWeight: 600 }} />
      <span
        ref={secondaryRef}
        style={{ display: "none", color: "rgba(255,255,255,0.75)" }}
      />
    </div>
  );
});

export default CursorAltitudeBadge;
