import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from "react";
import { Box, Paper, InputBase, Portal } from "@mui/material";
import { Rnd } from "react-rnd";

// quick, decent first-pass width estimate (screen px)
function estimateWidthPx(str, fontSizePx) {
  // ~0.56–0.62 works for latin text in many UIs; tweak if needed
  const avgChar = 0.6 * fontSizePx;
  return Math.max(1, Math.ceil((str.length + 1) * avgChar));
}

export default function NodeText({
  text,
  imageSize,
  containerK,
  worldScale,
  onChange,
  onDragEnd,
  //onClick,
  selected,
}) {
  // text
  const fontFamily = text.fontFamily ?? "inherit";
  const fontWeight = text.fontWeight ?? "normal";
  const placeholder = text.placeholder ?? "Texte";
  const fontSizePx = text.fontSize ?? 16;
  const paddingPx = 8;
  const minWidthPx = 28;
  const minHeightPx = fontSizePx * 1.25;
  const fillColor = text.fillColor;
  const fillOpacity = text.fillOpacity ?? 1;

  // Resize state - use stored width/height or measure from content
  const storedWidth = text.width;
  const storedHeight = text.height;



  // dataProps

  const dataProps = {
    "data-node-id": text.id,
    "data-node-type": "ANNOTATION",
    "data-annotation-type": "TEXT",
  };


  // color

  const selectedColor = theme.palette.annotation.selected;

  // bg-local anchor position
  const pixelX = (text.x ?? 0) * (imageSize?.w ?? 0);
  const pixelY = (text.y ?? 0) * (imageSize?.h ?? 0);

  const CLICK_DRAG_TOL = 5;
  const DRAG_END_TOL_PX = 5;
  const movedRef = useRef(false);

  // drag
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, pixelX: 0, pixelY: 0 });

  // edit

  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(text.textValue ?? "-?-");
  const inputRef = useRef(null);

  // visual scale compensation
  const scaleFactor = (worldScale || 1) * (containerK || 1);
  const fontSize = fontSizePx / 1;
  const padding = paddingPx / 1;
  const borderRadius = 6 / 1;

  // position (apply screen-drag converted to bg-local)
  const currentX = pixelX + dragOffset.x / scaleFactor;
  const currentY = pixelY + dragOffset.y / scaleFactor;

  // value shown
  const displayValue = isEditing ? localValue : text.textValue ?? "";
  const textOrPh = displayValue?.length ? displayValue : placeholder;
  const measureText = textOrPh + " ";

  // --- sizing ---
  const contentRef = useRef(null);
  const [measuredCssH, setMeasuredCssH] = useState(minHeightPx);

  // Use stored dimensions or measure from content
  const initialW = storedWidth
    ? storedWidth
    : Math.max(minWidthPx, estimateWidthPx(textOrPh, fontSizePx)) +
    paddingPx * 2;
  const initialH = storedHeight
    ? storedHeight
    : Math.max(minHeightPx, 1) + paddingPx;

  // Measure content height when text changes (for auto-height when not resized)
  useLayoutEffect(() => {
    if (!contentRef.current || storedHeight) return;
    const el = contentRef.current;
    const ro = new ResizeObserver(() => {
      setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx));
    });
    ro.observe(el);
    setMeasuredCssH(Math.max(el.scrollHeight, minHeightPx));
    return () => ro.disconnect();
  }, [text.textValue, storedHeight, minHeightPx]);

  // Resize delta state (CSS px)
  const [delta, setDelta] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const cssPos = useMemo(
    () => ({ x: delta.x, y: delta.y }),
    [delta.x, delta.y]
  );

  // Final dimensions: use stored or measured, plus any resize delta
  const boxW = storedWidth ? storedWidth + delta.w : initialW + delta.w;
  const boxH = storedHeight
    ? storedHeight + delta.h
    : Math.max(measuredCssH, initialH) + delta.h;

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
      // Don't interfere with input when editing
      if (isEditing) {
        e.stopPropagation();
        return;
      }
      // Don't start drag if clicking on input or its container
      const target = e.target;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("input") ||
        target.closest("textarea")
      ) {
        return;
      }
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
      if (!isDragging || isEditing) return;
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
    [isDragging, isEditing]
  );

  const finishDragAtPointer = useCallback(
    (clientX, clientY) => {
      setIsDragging(false);
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;

      // If movement was tiny, treat as click (not drag) and enter edit mode if selected
      if (Math.hypot(dx, dy) < DRAG_END_TOL_PX || !movedRef.current) {
        setDragOffset({ x: 0, y: 0 });
        // If selected and not already editing, enter edit mode
        if (selected && !isEditing) {
          setIsEditing(true);
        }
        return;
      }

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
      onDragEnd?.({ id: text.id, x: newRatioX, y: newRatioY });
      setDragOffset({ x: 0, y: 0 });
    },
    [
      scaleFactor,
      imageSize?.w,
      imageSize?.h,
      onDragEnd,
      text.id,
      selected,
      isEditing,
    ]
  );

  const handlePointerUp = useCallback(
    (e) => {
      if (!isDragging || isEditing) return;
      e.stopPropagation();
      e.preventDefault();
      finishDragAtPointer(e.clientX, e.clientY);
    },
    [isDragging, isEditing, finishDragAtPointer]
  );

  useEffect(() => {
    if (!isDragging || isEditing) return;
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
  }, [isDragging, isEditing, finishDragAtPointer]);

  //click/edit - this is a fallback, but edit mode is mainly triggered in finishDragAtPointer
  const handleClick = useCallback(
    (e) => {
      // Only enter edit mode if we're not dragging and text is selected
      if (!isDragging && !movedRef.current && selected && !isEditing) {
        e.stopPropagation();
        setIsEditing(true);
      }
    },
    [isDragging, selected, isEditing]
  );

  // Double-click to edit
  const handleDoubleClick = useCallback(
    (e) => {
      if (selected && !isEditing) {
        e.stopPropagation();
        e.preventDefault();
        setIsEditing(true);
      }
    },
    [selected, isEditing]
  );

  const commitIfChanged = useCallback(() => {
    if ((text.textValue ?? "") !== localValue)
      onChange?.({ id: text.id, textValue: localValue });
  }, [localValue, onChange, text.id, text.textValue]);

  const handleBlur = useCallback(() => {
    commitIfChanged();
    setIsEditing(false);
  }, [commitIfChanged]);

  const handleKeyDown = useCallback(
    (e) => {
      // Stop propagation for Delete, Backspace, and Escape keys
      if (e.key === "Delete" || e.key === "Backspace" || e.key === "Escape") {
        e.stopPropagation();
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        commitIfChanged();
        setIsEditing(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setLocalValue(text.textValue ?? "");
        setIsEditing(false);
      }
    },
    [commitIfChanged, text.textValue]
  );

  // Resize handlers (similar to NodeLegend)
  const onResize = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      setDelta((p) => ({
        ...p,
        w: ref.offsetWidth - (storedWidth || initialW),
        h: ref.offsetHeight - (storedHeight || initialH),
      }));
    },
    [storedWidth, storedHeight, initialW, initialH]
  );

  const onResizeStop = useCallback(
    (_e, _dir, ref, _delta, pos) => {
      const newWidth = ref.offsetWidth;
      const newHeight = ref.offsetHeight;
      onChange?.({
        id: text.id,
        width: newWidth,
        height: newHeight,
      });
      setDelta({ x: 0, y: 0, w: 0, h: 0 });
    },
    [onChange, text.id]
  );

  // Stop event propagation when editing/resizing
  const stopIfEditing = useCallback(
    (e) => {
      if (selected) e.stopPropagation();
    },
    [selected]
  );

  const containerCursor = isEditing ? "text" : isDragging ? "grabbing" : "grab";
  const poseEditable = selected;

  // Helper to convert hex color to rgba with opacity
  const getBackgroundColor = () => {
    if (fillColor) {
      // Convert hex to rgba
      const hex = fillColor.replace("#", "");
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${fillOpacity})`;
    }
    return selected ? "white" : "transparent";
  };

  const TextBoxInner = (
    <Box
      ref={contentRef}
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        cursor: containerCursor,
        boxSizing: "border-box",
        bgcolor: getBackgroundColor(),
        ...(selected && {
          border: (theme) => `1px solid ${theme.palette.divider}`,
        }),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      {...dataProps}
    >
      {isEditing ? (
        <InputBase
          inputRef={inputRef}
          multiline={true}
          value={isEditing ? localValue : text.textValue ?? ""}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          readOnly={!isEditing}
          placeholder={placeholder}
          sx={{
            width: "100%",
            height: "100%",
            fontSize,
            fontWeight,
            lineHeight: 1.25,
            // Match exact padding as the span
            padding: `${padding / 2}px ${padding}px`,
            margin: 0,
            bgcolor: "transparent", // Background is handled by parent Box
            borderRadius: `${borderRadius}px`,
            border: "none !important",
            borderColor: "transparent !important",
            outline: "none !important",
            boxShadow: "none !important",
            pointerEvents: "auto",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
            overflow: "hidden",
            display: "block",
            boxSizing: "border-box",
            // Match font rendering
            fontFamily,
            letterSpacing: "inherit",
            "& textarea": {
              cursor: isEditing ? "text" : "pointer",
              resize: "none",
              overflow: "hidden",
              padding: 0,
              margin: 0,
              lineHeight: 1.25,
              fontSize,
              fontWeight,
              fontFamily,
              letterSpacing: "inherit",
              whiteSpace: "nowrap",
              wordWrap: "normal",
            },
            "& .MuiInputBase-input": {
              cursor: isEditing ? "text" : "pointer",
              padding: 0,
              margin: 0,
              lineHeight: 1.25,
              fontSize,
              fontWeight,
              fontFamily,
              letterSpacing: "inherit",
              whiteSpace: "nowrap",
              wordWrap: "normal",
            },
          }}
          inputProps={{
            readOnly: !isEditing,
            style: {
              fontSize,
              fontWeight,
              fontFamily,
              lineHeight: 1.25,
              whiteSpace: "nowrap",
              wordWrap: "normal",
              borderColor: "transparent",
              padding: 0,
              margin: 0,
              letterSpacing: "inherit",
            },
            onKeyDown: (e) => {
              // Stop propagation for Delete, Backspace, and Escape keys
              if (
                e.key === "Delete" ||
                e.key === "Backspace" ||
                e.key === "Escape"
              ) {
                e.stopPropagation();
              }
            },
          }}
          onClick={(e) => {
            // Prevent click from bubbling to parent handlers
            e.stopPropagation();
          }}
          onPointerDown={(e) => {
            // Prevent pointer events from bubbling to foreignObject drag handlers
            e.stopPropagation();
          }}
        />
      ) : (
        <span
          style={{
            display: "block",
            whiteSpace: "nowrap",
            wordWrap: "normal",
            fontSize,
            fontWeight,
            fontFamily,
            lineHeight: 1.25,
            padding: `${padding / 2}px ${padding}px`,
            margin: 0,
            width: "auto", // Allow auto width
            minWidth: "100%",
            height: "100%",
            overflow: "visible",
            cursor: selected ? "text" : "default",
            boxSizing: "border-box",
            letterSpacing: "inherit",
          }}
          onClick={(e) => {
            if (selected && !isEditing) {
              e.stopPropagation();
              setIsEditing(true);
            }
          }}
          onDoubleClick={(e) => {
            if (selected && !isEditing) {
              e.stopPropagation();
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          {...dataProps}
        >
          {text.textValue ?? placeholder}
        </span>
      )}
    </Box>
  );

  return (
    <foreignObject
      x={currentX}
      y={currentY - boxH / 2}
      width={boxW}
      height={boxH}
      onPointerDown={!isEditing ? handlePointerDown : undefined}
      onPointerMove={!isEditing ? handlePointerMove : undefined}
      onPointerUp={!isEditing ? handlePointerUp : undefined}
      onPointerDownCapture={stopIfEditing}
      onPointerMoveCapture={stopIfEditing}
      onPointerUpCapture={stopIfEditing}
      style={{
        pointerEvents: "auto",
        userSelect: isEditing ? "text" : "none",
        overflow: "visible",
      }}
      {...dataProps}
    >
      {!poseEditable ? (
        <div style={{ width: "100%", height: "100%" }}>{TextBoxInner}</div>
      ) : (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <Rnd
            position={cssPos}
            size={{ width: "100%", height: "100%" }}
            scale={scaleFactor}
            onResize={onResize}
            onResizeStop={onResizeStop}
            lockAspectRatio={false}
            enableResizing={{
              left: true,
              right: true,
              top: false,
              bottom: true,
              topLeft: false,
              topRight: false,
              bottomLeft: false,
              bottomRight: false,
            }}
            resizeHandleStyles={handleStyles}
            style={{
              border: "1px dashed rgba(25,118,210,.7)",
              background: "transparent",
              boxSizing: "border-box",
            }}
            minWidth={minWidthPx}
            minHeight={minHeightPx}
            onMouseDown={(e) => {
              // Don't interfere with clicks on the text content
              const target = e.target;
              if (
                target.tagName === "SPAN" ||
                target.closest("span") ||
                target.tagName === "INPUT" ||
                target.tagName === "TEXTAREA" ||
                target.closest("input") ||
                target.closest("textarea")
              ) {
                e.stopPropagation();
              }
            }}
          >
            <div style={{ width: "100%", height: "100%" }}>{TextBoxInner}</div>
          </Rnd>
        </div>
      )}
    </foreignObject>
  );
}

const handleStyles = {
  left: knob(),
  right: knob(),
  bottom: knob(),
};
function knob() {
  return {
    width: 18,
    height: 18,
    border: "2px solid #1976d2",
    background: "#fff",
    borderRadius: 2,
  };
}
