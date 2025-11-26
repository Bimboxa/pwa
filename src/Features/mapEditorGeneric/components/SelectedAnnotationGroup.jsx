import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const HANDLE_CONFIG = {
  tl: { cursor: "nwse-resize", anchor: "br" },
  tr: { cursor: "nesw-resize", anchor: "bl" },
  bl: { cursor: "nesw-resize", anchor: "tr" },
  br: { cursor: "nwse-resize", anchor: "tl" },
};

const MIN_BOX_SIZE_PX = 10;

const structuredCloneFallback = (value) => JSON.parse(JSON.stringify(value));
const cloneAnnotation = (annotation) =>
  typeof structuredClone === "function"
    ? structuredClone(annotation)
    : structuredCloneFallback(annotation);

const clamp01 = (value) => Math.max(0, Math.min(1, value));

const formatNumber = (value) =>
  Number.isFinite(value) ? Number(value).toFixed(6) : "0";

const serializePoints = (points) =>
  Array.isArray(points)
    ? points
        .map((pt) =>
          pt
            ? `${formatNumber(pt.x)}:${formatNumber(pt.y)}:${pt.type ?? ""}`
            : "null"
        )
        .join(";")
    : "";

function buildAnnotationSignature(annotation) {
  if (!annotation) return "none";
  const segments = [annotation.id ?? "annotation"];

  const appendPointGroup = (label, pts) => {
    if (Array.isArray(pts) && pts.length) {
      segments.push(`${label}:${serializePoints(pts)}`);
    }
  };

  appendPointGroup("points", annotation.points);
  appendPointGroup("polyline", annotation.polyline?.points);
  appendPointGroup("rectangle", annotation.rectangle?.points);
  appendPointGroup("segment", annotation.segment?.points);
  appendPointGroup("polygon", annotation.polygon?.points);
  appendPointGroup("shape", annotation.shape?.points);

  if (Array.isArray(annotation.cuts)) {
    annotation.cuts.forEach((cut, idx) =>
      appendPointGroup(`cut-${idx}`, cut?.points)
    );
  }

  if (Array.isArray(annotation.polyline?.cuts)) {
    annotation.polyline.cuts.forEach((cut, idx) =>
      appendPointGroup(`polyline-cut-${idx}`, cut?.points)
    );
  }

  ["x", "y", "width", "height", "rotation"].forEach((key) => {
    if (typeof annotation[key] === "number") {
      segments.push(`${key}:${formatNumber(annotation[key])}`);
    }
  });

  return segments.join("|");
}

function transformAnnotation(annotation, transform, imageSize) {
  if (!annotation || !imageSize?.w || !imageSize?.h) return annotation;

  const widthPx = imageSize.w || 1;
  const heightPx = imageSize.h || 1;
  const originRelX = transform.originX ?? 0;
  const originRelY = transform.originY ?? 0;
  const originPxX = originRelX * widthPx;
  const originPxY = originRelY * heightPx;
  const scaleX = transform.scaleX ?? 1;
  const scaleY = transform.scaleY ?? 1;
  const translatePxX = (transform.translateX ?? 0) * widthPx;
  const translatePxY = (transform.translateY ?? 0) * heightPx;

  const applyToPoint = (pt) => {
    if (typeof pt?.x !== "number" || typeof pt?.y !== "number") return pt;
    const px = pt.x * widthPx;
    const py = pt.y * heightPx;
    const scaledPx = originPxX + (px - originPxX) * scaleX + translatePxX;
    const scaledPy = originPxY + (py - originPxY) * scaleY + translatePxY;
    return {
      ...pt,
      x: clamp01(scaledPx / widthPx),
      y: clamp01(scaledPy / heightPx),
    };
  };

  const applyToPointArray = (points) =>
    Array.isArray(points) ? points.map((pt) => applyToPoint(pt)) : points ?? [];

  const next = cloneAnnotation(annotation);

  const pointCollections = [];
  const registerCollections = (obj) => {
    if (!obj) return;
    if (Array.isArray(obj.points)) pointCollections.push(obj.points);
    if (Array.isArray(obj.cuts)) {
      obj.cuts = obj.cuts.map((cut) => ({
        ...cut,
        points: applyToPointArray(cut.points),
      }));
    }
  };

  registerCollections(next);
  registerCollections(next.polyline);
  registerCollections(next.rectangle);
  registerCollections(next.segment);
  registerCollections(next.polygon);
  registerCollections(next.shape);

  pointCollections.forEach((collection, idx) => {
    if (!Array.isArray(collection)) return;
    const updated = applyToPointArray(collection);
    if (collection === next.points) next.points = updated;
    else if (collection === next.polyline?.points)
      next.polyline.points = updated;
    else if (collection === next.rectangle?.points)
      next.rectangle.points = updated;
    else if (collection === next.segment?.points) next.segment.points = updated;
    else if (collection === next.polygon?.points) next.polygon.points = updated;
    else if (collection === next.shape?.points) next.shape.points = updated;
  });

  if (typeof next.x === "number" && typeof next.y === "number") {
    const updated = applyToPoint({ x: next.x, y: next.y });
    next.x = updated.x;
    next.y = updated.y;
  }

  if (typeof next.width === "number" && scaleX !== 1) {
    next.width = Math.max(1, next.width * scaleX);
  }
  if (typeof next.height === "number" && scaleY !== 1) {
    next.height = Math.max(1, next.height * scaleY);
  }

  return next;
}

function getHandlePosition(bbox, key) {
  if (!bbox) return null;
  switch (key) {
    case "tl":
      return { x: bbox.x, y: bbox.y };
    case "tr":
      return { x: bbox.x + bbox.width, y: bbox.y };
    case "bl":
      return { x: bbox.x, y: bbox.y + bbox.height };
    case "br":
      return { x: bbox.x + bbox.width, y: bbox.y + bbox.height };
    default:
      return null;
  }
}

function getOppositeHandle(key) {
  switch (key) {
    case "tl":
      return "br";
    case "tr":
      return "bl";
    case "bl":
      return "tr";
    case "br":
      return "tl";
    default:
      return null;
  }
}

export default function SelectedAnnotationGroup({
  annotation,
  containerK = 1,
  worldScale = 1,
  imageSize,
  toBaseFromClient,
  onChange,
  onDragStart,
  onDragEnd,
  children,
  canTransform = true,
}) {
  const contentRef = useRef(null);
  const wrapperRef = useRef(null);
  const [bbox, setBBox] = useState(null);
  const interactionRef = useRef(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const latestAnnotationRef = useRef(annotation);
  const [liveTransform, setLiveTransform] = useState(null);
  const pendingTransformRef = useRef(null);
  const rafRef = useRef(null);
  const pendingResetRef = useRef(false);
  const resetWaitSignatureRef = useRef(null);

  const annotationSignature = buildAnnotationSignature(annotation);

  useLayoutEffect(() => {
    latestAnnotationRef.current = annotation;
  }, [annotationSignature]);

  useLayoutEffect(() => {
    if (!contentRef.current) return;
    try {
      const nextBox = contentRef.current.getBBox();
      setBBox({
        x: nextBox.x,
        y: nextBox.y,
        width: nextBox.width,
        height: nextBox.height,
      });
    } catch {
      setBBox(null);
    }
  }, [annotationSignature, containerK, worldScale]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const scheduleLiveTransform = useCallback((next) => {
    pendingTransformRef.current = next;
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setLiveTransform(pendingTransformRef.current);
    });
  }, []);

  const requestLiveTransformReset = useCallback((currentSignature) => {
    pendingTransformRef.current = null;
    pendingResetRef.current = true;
    resetWaitSignatureRef.current = currentSignature;
  }, []);

  useLayoutEffect(() => {
    if (
      !isInteracting &&
      pendingResetRef.current &&
      resetWaitSignatureRef.current !== null &&
      annotationSignature !== resetWaitSignatureRef.current
    ) {
      pendingResetRef.current = false;
      resetWaitSignatureRef.current = null;
      setLiveTransform(null);
    }
  }, [annotationSignature, isInteracting]);

  const baseScale = (containerK || 1) * (worldScale || 1);
  const liveScaleX =
    typeof liveTransform?.scaleX === "number"
      ? Math.abs(liveTransform.scaleX)
      : 1;
  const liveScaleY =
    typeof liveTransform?.scaleY === "number"
      ? Math.abs(liveTransform.scaleY)
      : 1;
  const totalScaleX = baseScale * (liveScaleX || 1);
  const totalScaleY = baseScale * (liveScaleY || 1);
  const invScaleX = totalScaleX !== 0 ? 1 / totalScaleX : 1;
  const invScaleY = totalScaleY !== 0 ? 1 / totalScaleY : 1;
  const HANDLE_SCREEN_SIZE = 8;
  const HANDLE_STROKE_SCREEN = 2;

  const handles = bbox
    ? [
        { key: "tl", x: bbox.x, y: bbox.y },
        { key: "tr", x: bbox.x + bbox.width, y: bbox.y },
        { key: "bl", x: bbox.x, y: bbox.y + bbox.height },
        { key: "br", x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      ]
    : [];

  const beginInteraction = (data) => {
    interactionRef.current = data;
    setIsInteracting(true);
    onDragStart?.(annotation);
  };

  const handleGroupPointerDown = (e) => {
    if (!canTransform || !bbox || !imageSize?.w || !toBaseFromClient) return;
    e.preventDefault();
    e.stopPropagation();
    const basePoint = toBaseFromClient(e.clientX, e.clientY);
    if (!basePoint) return;
    beginInteraction({
      mode: "move",
      startPointer: basePoint,
      startAnnotation: cloneAnnotation(annotation),
    });
  };

  const handleHandlePointerDown = (e, key) => {
    if (!canTransform || !bbox || !imageSize?.w || !toBaseFromClient) return;
    e.preventDefault();
    e.stopPropagation();
    const basePoint = toBaseFromClient(e.clientX, e.clientY);
    if (!basePoint) return;
    const startHandle = getHandlePosition(bbox, key);
    const anchorHandle = getHandlePosition(bbox, getOppositeHandle(key));
    if (!startHandle || !anchorHandle) return;
    beginInteraction({
      mode: "resize",
      handle: key,
      startPointer: basePoint,
      startAnnotation: cloneAnnotation(annotation),
      startBBox: { ...bbox },
      anchorPx: anchorHandle,
      startHandlePx: startHandle,
    });
  };

  useEffect(() => {
    if (!isInteracting) return;
    const handleMove = (e) => {
      if (!canTransform) return;
      const interaction = interactionRef.current;
      if (
        !canTransform ||
        !interaction ||
        !toBaseFromClient ||
        !imageSize?.w ||
        !imageSize?.h
      )
        return;
      const pointer = toBaseFromClient(e.clientX, e.clientY);
      if (!pointer) return;
      if (interaction.mode === "move") {
        const dxPx = pointer.x - interaction.startPointer.x;
        const dyPx = pointer.y - interaction.startPointer.y;
        scheduleLiveTransform({
          translateX: dxPx,
          translateY: dyPx,
        });
        interactionRef.current.currentTransform = {
          type: "move",
          translateX: dxPx / (imageSize.w || 1),
          translateY: dyPx / (imageSize.h || 1),
        };
      } else if (interaction.mode === "resize") {
        const { startBBox, anchorPx, startHandlePx, handle } = interaction;
        if (!startBBox || !anchorPx || !startHandlePx) return;
        const initialWidth = Math.max(startBBox.width, MIN_BOX_SIZE_PX);
        const initialHeight = Math.max(startBBox.height, MIN_BOX_SIZE_PX);
        if (initialWidth === 0 || initialHeight === 0) return;

        let widthPx = initialWidth;
        let heightPx = initialHeight;
        let scaleX = 1;
        let scaleY = 1;

        const clampHorizontal = (value, anchorX) => {
          if (handle === "tl" || handle === "bl") {
            return Math.min(value, anchorX - MIN_BOX_SIZE_PX);
          }
          return Math.max(value, anchorX + MIN_BOX_SIZE_PX);
        };

        const clampVertical = (value, anchorY) => {
          if (handle === "tl" || handle === "tr") {
            return Math.min(value, anchorY - MIN_BOX_SIZE_PX);
          }
          return Math.max(value, anchorY + MIN_BOX_SIZE_PX);
        };

        const clampedX = clampHorizontal(pointer.x, anchorPx.x);
        const clampedY = clampVertical(pointer.y, anchorPx.y);

        switch (handle) {
          case "tl":
            widthPx = anchorPx.x - clampedX;
            heightPx = anchorPx.y - clampedY;
            break;
          case "tr":
            widthPx = clampedX - anchorPx.x;
            heightPx = anchorPx.y - clampedY;
            break;
          case "bl":
            widthPx = anchorPx.x - clampedX;
            heightPx = clampedY - anchorPx.y;
            break;
          case "br":
          default:
            widthPx = clampedX - anchorPx.x;
            heightPx = clampedY - anchorPx.y;
            break;
        }

        widthPx = Math.max(MIN_BOX_SIZE_PX, widthPx);
        heightPx = Math.max(MIN_BOX_SIZE_PX, heightPx);
        scaleX = widthPx / initialWidth;
        scaleY = heightPx / initialHeight;

        scheduleLiveTransform({
          scaleX,
          scaleY,
          originX: anchorPx.x,
          originY: anchorPx.y,
        });
        interactionRef.current.currentTransform = {
          type: "resize",
          scaleX,
          scaleY,
          originX: (anchorPx.x || 0) / (imageSize.w || 1),
          originY: (anchorPx.y || 0) / (imageSize.h || 1),
        };
      }
    };

    const handleUp = () => {
      setIsInteracting(false);
      const interaction = interactionRef.current;
      if (interaction?.currentTransform) {
        const transform =
          interaction.currentTransform.type === "move"
            ? {
                translateX: interaction.currentTransform.translateX,
                translateY: interaction.currentTransform.translateY,
              }
            : {
                scaleX: interaction.currentTransform.scaleX,
                scaleY: interaction.currentTransform.scaleY,
                originX: interaction.currentTransform.originX,
                originY: interaction.currentTransform.originY,
              };
        const nextAnnotation = transformAnnotation(
          interaction.startAnnotation,
          transform,
          imageSize
        );
        latestAnnotationRef.current = nextAnnotation;
        onChange?.(nextAnnotation);
        onDragEnd?.(nextAnnotation);
      } else {
        const latest = latestAnnotationRef.current ?? annotation;
        onDragEnd?.(latest);
      }
      requestLiveTransformReset(annotationSignature);
      interactionRef.current = null;
    };

    document.addEventListener("pointermove", handleMove, { passive: false });
    document.addEventListener("pointerup", handleUp, { passive: false });
    document.addEventListener("pointercancel", handleUp, { passive: false });
    return () => {
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };
  }, [
    canTransform,
    isInteracting,
    annotation,
    imageSize?.w,
    imageSize?.h,
    onChange,
    onDragEnd,
    toBaseFromClient,
    requestLiveTransformReset,
  ]);

  const transformAttr = useMemo(() => {
    if (!liveTransform) return undefined;
    const parts = [];
    const hasTranslate =
      typeof liveTransform.translateX === "number" ||
      typeof liveTransform.translateY === "number";
    if (hasTranslate) {
      parts.push(
        `translate(${liveTransform.translateX || 0} ${
          liveTransform.translateY || 0
        })`
      );
    }
    const hasScale =
      typeof liveTransform.scaleX === "number" ||
      typeof liveTransform.scaleY === "number";
    if (hasScale) {
      const originX = liveTransform.originX || 0;
      const originY = liveTransform.originY || 0;
      parts.push(`translate(${originX} ${originY})`);
      parts.push(
        `scale(${liveTransform.scaleX || 1} ${liveTransform.scaleY || 1})`
      );
      parts.push(`translate(${-originX} ${-originY})`);
    }
    return parts.join(" ");
  }, [liveTransform]);

  return (
    <g ref={wrapperRef} transform={transformAttr}>
      <g ref={contentRef}>{children}</g>
      {canTransform && bbox && bbox.width >= 0 && bbox.height >= 0 && (
        <g>
          <rect
            x={bbox.x}
            y={bbox.y}
            width={bbox.width}
            height={bbox.height}
            fill="rgba(59,130,246,0.05)"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="4 2"
            vectorEffect="non-scaling-stroke"
            style={{ cursor: "move" }}
            onPointerDown={handleGroupPointerDown}
          />
          {handles.map((handle) => (
            <rect
              key={handle.key}
              x={handle.x - (HANDLE_SCREEN_SIZE * invScaleX) / 2}
              y={handle.y - (HANDLE_SCREEN_SIZE * invScaleY) / 2}
              width={HANDLE_SCREEN_SIZE * invScaleX}
              height={HANDLE_SCREEN_SIZE * invScaleY}
              fill="#ffffff"
              stroke="#3b82f6"
              strokeWidth={HANDLE_STROKE_SCREEN}
              vectorEffect="non-scaling-stroke"
              style={{
                cursor: HANDLE_CONFIG[handle.key]?.cursor ?? "nwse-resize",
              }}
              onPointerDown={(e) => handleHandlePointerDown(e, handle.key)}
            />
          ))}
        </g>
      )}
    </g>
  );
}
