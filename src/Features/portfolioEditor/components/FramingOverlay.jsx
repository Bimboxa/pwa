import { useCallback, useEffect, useRef } from "react";

import { useDispatch } from "react-redux";

import { setFramingContainerId } from "Features/portfolioBaseMapContainers/portfolioBaseMapContainersSlice";

import db from "App/db/db";

import computeDefaultViewBox from "../utils/computeDefaultViewBox";

export default function FramingOverlay({ container, baseMap, innerSvgRef }) {
  const dispatch = useDispatch();

  // refs

  const viewBoxRef = useRef(
    container.viewBox || computeDefaultViewBox(baseMap, container)
  );
  const rectRef = useRef(null);
  const draggingRef = useRef(false);
  const lastPointRef = useRef(null);
  const commitTimerRef = useRef(null);

  // sync viewBoxRef when viewBox changes externally (e.g. after a resize commit)

  useEffect(() => {
    if (container.viewBox) {
      viewBoxRef.current = { ...container.viewBox };
    }
  }, [
    container.viewBox?.x,
    container.viewBox?.y,
    container.viewBox?.width,
    container.viewBox?.height,
  ]);

  // helpers

  function applyViewBox() {
    const vb = viewBoxRef.current;
    if (!innerSvgRef?.current) return;
    innerSvgRef.current.setAttribute(
      "viewBox",
      `${vb.x} ${vb.y} ${vb.width} ${vb.height}`
    );
  }

  function commitViewBox() {
    clearTimeout(commitTimerRef.current);
    const vb = { ...viewBoxRef.current };
    db.portfolioBaseMapContainers.update(container.id, { viewBox: vb });
  }

  function debouncedCommit() {
    clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(commitViewBox, 300);
  }

  function getSvgPoint(e) {
    const svg = innerSvgRef.current?.ownerSVGElement;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  // handlers

  const handlePointerDown = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();
    const pt = getSvgPoint(e);
    if (!pt) return;
    draggingRef.current = true;
    lastPointRef.current = pt;
    e.target.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    const pt = getSvgPoint(e);
    if (!pt || !lastPointRef.current) return;

    const vb = viewBoxRef.current;
    const scaleX = vb.width / container.width;
    const scaleY = vb.height / container.height;

    const dx = (pt.x - lastPointRef.current.x) * scaleX;
    const dy = (pt.y - lastPointRef.current.y) * scaleY;

    viewBoxRef.current = {
      ...vb,
      x: vb.x - dx,
      y: vb.y - dy,
    };

    lastPointRef.current = pt;
    applyViewBox();
  }, [container.width, container.height]);

  const handlePointerUp = useCallback((e) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    lastPointRef.current = null;
    commitViewBox();
  }, []);

  const handleWheel = useCallback((e) => {
    e.stopPropagation();
    e.preventDefault();

    const factor = e.deltaY > 0 ? 1.03 : 1 / 1.03;
    const vb = viewBoxRef.current;

    // Mouse position in viewBox coordinates
    const pt = getSvgPoint(e);
    if (!pt) return;
    const mouseVBX =
      ((pt.x - container.x) / container.width) * vb.width + vb.x;
    const mouseVBY =
      ((pt.y - container.y) / container.height) * vb.height + vb.y;

    viewBoxRef.current = {
      x: mouseVBX - (mouseVBX - vb.x) * factor,
      y: mouseVBY - (mouseVBY - vb.y) * factor,
      width: vb.width * factor,
      height: vb.height * factor,
    };

    applyViewBox();
    debouncedCommit();
  }, [container.x, container.y, container.width, container.height]);

  // native wheel listener (passive: false to allow preventDefault)

  useEffect(() => {
    const el = rectRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // escape key to exit framing mode

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        commitViewBox();
        dispatch(setFramingContainerId(null));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearTimeout(commitTimerRef.current);
    };
  }, [dispatch]);

  // render

  return (
    <rect
      ref={rectRef}
      x={container.x}
      y={container.y}
      width={container.width}
      height={container.height}
      fill="transparent"
      style={{ cursor: draggingRef.current ? "grabbing" : "grab" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    />
  );
}
