import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
} from "react";
import { Box, InputBase, Portal } from "@mui/material";

// quick, decent first-pass width estimate (screen px)
function estimateWidthPx(str, fontSizePx) {
  // ~0.56–0.62 works for latin text in many UIs; tweak if needed
  const avgChar = 0.6 * fontSizePx;
  return Math.max(1, Math.ceil(str.length * avgChar));
}

export default function NodeText({
  text,
  imageSize,
  containerK,
  worldScale,
  onChange,
  onDragEnd,
  onClick,
}) {
  // text
  const fontFamily = text.fontFamily ?? "inherit";
  const placeholder = text.placeholder ?? "Texte";
  const fontSizePx = 16;
  const paddingPx = 8;
  const minWidthPx = 28;

  // bg-local anchor position
  const pixelX = (text.x ?? 0) * (imageSize?.w ?? 0);
  const pixelY = (text.y ?? 0) * (imageSize?.h ?? 0);

  const CLICK_DRAG_TOL = 5;
  const movedRef = useRef(false);

  // drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, pixelX: 0, pixelY: 0 });

  // edit
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(text.value ?? "-?-");
  const inputRef = useRef(null);

  // visual scale compensation
  //const scaleFactor = (worldScale || 1) * (bgPose?.k || 1);
  const scaleFactor = 1;
  const fontSize = fontSizePx / scaleFactor;
  const padding = paddingPx / scaleFactor;
  const borderRadius = 6 / scaleFactor;

  // position (apply screen-drag converted to bg-local)
  const currentX = pixelX + dragOffset.x / scaleFactor;
  const currentY = pixelY + dragOffset.y / scaleFactor;

  // value shown
  const displayValue = isEditing ? localValue : text.value ?? "";
  const textOrPh = displayValue?.length ? displayValue : placeholder;
  const measureText = textOrPh + " ";

  // --- sizing ---
  const measureRef = useRef(null);

  // 🔧 first-pass: estimate width/height in *screen px* so first paint isn't 0
  const initialW =
    Math.max(minWidthPx, estimateWidthPx(textOrPh, fontSizePx)) + paddingPx * 2;
  const initialH = Math.max(fontSizePx * 1.25, 1) + paddingPx;

  // measuredPx is refined by the effect below, but starts with a good estimate
  const [measuredPx, setMeasuredPx] = useState({ w: initialW, h: initialH });

  useEffect(() => {
    if (!measureRef.current) return;
    // refine with real DOM measurement (screen px)
    const el = measureRef.current;
    el.textContent = measureText;
    const rect = el.getBoundingClientRect();
    console.log("rect", el, rect);
    const paddedW = Math.max(rect.width + 10, minWidthPx) + paddingPx * 2;
    const paddedH = Math.max(rect.height, fontSizePx * 1.25) + paddingPx;
    setMeasuredPx({ w: paddedW, h: paddedH });
  }, [measureRef?.current, measureText, fontSizePx, paddingPx, minWidthPx]);

  // convert screen px -> bg-local units for foreignObject
  //const boxW = Math.max(measuredPx.w / scaleFactor, 0.5); // tiny guard so it never collapses
  //const boxH = Math.max(measuredPx.h / scaleFactor, 0.5);

  const boxW = measuredPx.w;
  const boxH = measuredPx.h;

  // autofocus on edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
        const len = inputRef.current.value?.length ?? 0;
        inputRef.current.setSelectionRange?.(len, len);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  // drag handlers
  const handlePointerDown = useCallback(
    (e) => {
      if (isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      movedRef.current = false;
      dragStartRef.current = { x: e.clientX, y: e.clientY, pixelX, pixelY };
      setDragOffset({ x: 0, y: 0 });
    },
    [isEditing, pixelX, pixelY]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      e.stopPropagation();
      e.preventDefault();
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (
        !movedRef.current &&
        (Math.abs(dx) > CLICK_DRAG_TOL || Math.abs(dy) > CLICK_DRAG_TOL)
      ) {
        movedRef.current = true;
      }
      setDragOffset({ x: dx, y: dy });
    },
    [isDragging]
  );

  const finishDragAtPointer = useCallback(
    (clientX, clientY) => {
      setIsDragging(false);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      const deltaBgX = dx / scaleFactor;
      const deltaBgY = dy / scaleFactor;
      const newPixelX = dragStartRef.current.pixelX + deltaBgX;
      const newPixelY = dragStartRef.current.pixelY + deltaBgY;
      const newRatioX = Math.max(
        0,
        Math.min(1, newPixelX / (imageSize?.w || 1))
      );
      const newRatioY = Math.max(
        0,
        Math.min(1, newPixelY / (imageSize?.h || 1))
      );
      onDragEnd?.(text.id, { x: newRatioX, y: newRatioY });
      setDragOffset({ x: 0, y: 0 });
    },
    [scaleFactor, imageSize?.w, imageSize?.h, onDragEnd, text.id]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!isDragging) return;
      e.stopPropagation();
      e.preventDefault();
      finishDragAtPointer(e.clientX, e.clientY);
    },
    [isDragging, finishDragAtPointer]
  );

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e) => {
      e.preventDefault();
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (
        !movedRef.current &&
        (Math.abs(dx) > CLICK_DRAG_TOL || Math.abs(dy) > CLICK_DRAG_TOL)
      ) {
        movedRef.current = true;
      }
      setDragOffset({ x: dx, y: dy });
    };
    const onUp = (e) => {
      e.preventDefault();
      finishDragAtPointer(e.clientX, e.clientY);
    };
    document.addEventListener("pointermove", onMove, { passive: false });
    document.addEventListener("pointerup", onUp, { passive: false });
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isDragging, finishDragAtPointer]);

  // click/edit
  const handleClick = useCallback(
    (e) => {
      e.stopPropagation();
      if (isDragging || movedRef.current) return;
      onClick?.(text);
      setIsEditing(true);
    },
    [isDragging, onClick, text]
  );

  const commitIfChanged = useCallback(() => {
    if ((text.value ?? "") !== localValue) onChange?.(text.id, localValue);
  }, [localValue, onChange, text.id, text.value]);

  const handleBlur = useCallback(() => {
    commitIfChanged();
    setIsEditing(false);
  }, [commitIfChanged]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commitIfChanged();
        setIsEditing(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setLocalValue(text.value ?? "");
        setIsEditing(false);
      }
    },
    [commitIfChanged, text.value]
  );

  const containerCursor = isEditing ? "text" : isDragging ? "grabbing" : "grab";

  return (
    <>
      {/* Hidden measurer in the document (screen layer) */}

      <Portal container={document.body}>
        <span
          ref={measureRef}
          style={{
            position: "absolute",
            top: -99999,
            left: -99999,
            visibility: "hidden",
            whiteSpace: "nowrap",
            display: "inline-block",
            fontSize: `${fontSizePx}px`,
            lineHeight: 1.25,
            fontFamily,
            fontWeight: "inherit",
            letterSpacing: "inherit",
            pointerEvents: "none",
          }}
        >
          {measureText}
        </span>
      </Portal>

      <foreignObject
        x={currentX}
        y={currentY}
        width={boxW}
        height={boxH}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          pointerEvents: "auto",
          userSelect: "none",
          border: "1px solid red",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            cursor: containerCursor,
          }}
          onClick={handleClick}
        >
          <InputBase
            inputRef={inputRef}
            multiline={false}
            value={isEditing ? localValue : text.value ?? ""}
            //value={"AAAAAAAAAAAAAAA"}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            readOnly={!isEditing}
            placeholder={placeholder}
            sx={{
              width: "100%",
              height: "100%",
              fontSize,
              lineHeight: 1.25,
              px: padding + "px",
              py: padding / 2 + "px",
              bgcolor: isEditing ? "background.paper" : "transparent",
              //bgcolor: "white",

              borderRadius: `${borderRadius}px`,
              border: isEditing ? "1px solid" : "1px solid transparent",
              borderColor: isEditing ? "divider" : "transparent",
              pointerEvents: "auto",
              whiteSpace: "nowrap",
              //overflow: "hidden",
              textOverflow: "clip",
              // Ensure visible text even if theme CSS vars don't propagate into foreignObject
              //color: "#111",
            }}
            inputProps={{
              readOnly: !isEditing,
              style: {
                fontSize,
                whiteSpace: "nowrap",
              },
            }}
          />
        </Box>
      </foreignObject>
    </>
  );
}
