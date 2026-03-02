import { useRef, useEffect } from "react";
import { useDispatch } from "react-redux";

import { triggerAnnotationsUpdate } from "Features/annotations/annotationsSlice";

import useMainBaseMap from "Features/mapEditor/hooks/useMainBaseMap";
import useAnnotationsV2 from "Features/annotations/hooks/useAnnotationsV2";
import useUpdateAnnotation from "Features/annotations/hooks/useUpdateAnnotation";

import computeWrapperBbox from "Features/mapEditor/utils/computeWrapperBbox";
import applyWrapperTransformToPoints from "Features/mapEditor/utils/applyWrapperTransformToPoints";
import commitWrapperTransform from "Features/mapEditor/services/commitWrapperTransform";

import db from "App/db/db";

import FieldSizeAndUnit from "Features/form/components/FieldSizeAndUnit";

const UNIT_OPTIONS = [
  { key: "PX", label: "px" },
  { key: "CM", label: "cm" },
];

const DEBOUNCE_MS = 600;

export default function FieldWrapperDimensions({ annotation }) {
  const dispatch = useDispatch();
  const debounceRef = useRef(null);

  // cleanup on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // data

  const baseMap = useMainBaseMap();
  const allAnnotations = useAnnotationsV2();

  const imageSize = baseMap?.image?.imageSize;
  const meterByPx = baseMap?.getMeterByPx?.() ?? null;

  // helpers — cm per pixel (meterByPx * 100)

  const cmByPx = meterByPx ? meterByPx * 100 : null;

  const rotation = annotation?.rotation ?? 0;
  const rotCenter = annotation?.rotationCenter ?? null;
  const hasRotation = rotation !== 0 && rotCenter != null;

  const bbox = computeWrapperBbox(
    annotation ? [annotation] : [],
    rotation,
    rotCenter ?? undefined
  );

  const bboxWidth = bbox?.width ?? 0;
  const bboxHeight = bbox?.height ?? 0;

  // data — persisted unit preference

  const updateAnnotation = useUpdateAnnotation();
  const sizeUnit = annotation?.sizeUnit ?? "PX";

  // helpers — unit conversion

  function pxToDisplay(px) {
    if (sizeUnit === "CM" && cmByPx) return Math.round(px * cmByPx * 100) / 100;
    return Math.round(px * 100) / 100;
  }

  function displayToPx(val) {
    if (sizeUnit === "CM" && cmByPx) return val / cmByPx;
    return val;
  }

  const displayWidth = pxToDisplay(bboxWidth);
  const displayHeight = pxToDisplay(bboxHeight);

  // handlers

  async function commitResize(newValue) {
    if (!annotation || !bbox || !imageSize || !allAnnotations) return;

    const newDisplayW = newValue.size?.width;
    const newDisplayH = newValue.size?.height;

    // If reset (null), skip
    if (newDisplayW == null && newDisplayH == null) return;

    const targetWidthPx = newDisplayW != null ? displayToPx(newDisplayW) : bboxWidth;
    const targetHeightPx = newDisplayH != null ? displayToPx(newDisplayH) : bboxHeight;

    // Skip if no actual change
    if (Math.abs(targetWidthPx - bboxWidth) < 0.01 && Math.abs(targetHeightPx - bboxHeight) < 0.01) return;

    if (!hasRotation) {
      // --- Non-rotated: standard RESIZE_SE ---
      const deltaPos = {
        x: targetWidthPx - bboxWidth,
        y: targetHeightPx - bboxHeight,
      };

      const pointUpdates = applyWrapperTransformToPoints({
        annotations: [annotation],
        wrapperBbox: bbox,
        deltaPos,
        partType: "RESIZE_SE",
      });

      await commitWrapperTransform({
        selectedAnnotationIds: [annotation.id],
        allAnnotations,
        pointUpdates,
        imageSize,
        isResize: true,
      });
    } else {
      // --- Rotated: scale in local (un-rotated) frame, preserve rotation ---
      const { x: bx, y: by } = bbox;

      const rad = (rotation * Math.PI) / 180;
      const cosR = Math.cos(rad);
      const sinR = Math.sin(rad);

      // Anchor = canonical top-left rotated to pixel space
      const anchorPixel = {
        x: rotCenter.x + (bx - rotCenter.x) * cosR - (by - rotCenter.y) * sinR,
        y: rotCenter.y + (bx - rotCenter.x) * sinR + (by - rotCenter.y) * cosR,
      };

      // Scale factors
      const scaleX = bboxWidth > 0 ? targetWidthPx / bboxWidth : 1;
      const scaleY = bboxHeight > 0 ? targetHeightPx / bboxHeight : 1;

      // Transform all points
      const pointUpdates = new Map();

      const transformPoints = (points) => {
        for (const pt of points ?? []) {
          if (pt.x == null || pt.y == null || pointUpdates.has(pt.id)) continue;

          // Un-rotate to canonical space
          const dx = pt.x - rotCenter.x;
          const dy = pt.y - rotCenter.y;
          const canonX = rotCenter.x + dx * cosR + dy * sinR;
          const canonY = rotCenter.y - dx * sinR + dy * cosR;

          // Scale in canonical space (anchor = top-left)
          const localX = (canonX - bx) * scaleX;
          const localY = (canonY - by) * scaleY;

          // Rotate back to pixel space (anchor stays fixed)
          pointUpdates.set(pt.id, {
            x: anchorPixel.x + localX * cosR - localY * sinR,
            y: anchorPixel.y + localX * sinR + localY * cosR,
          });
        }
      };

      transformPoints(annotation.points);
      for (const cut of annotation.cuts ?? []) {
        transformPoints(cut.points);
      }

      // Commit point updates (no isResize → rotation metadata preserved)
      await commitWrapperTransform({
        selectedAnnotationIds: [annotation.id],
        allAnnotations,
        pointUpdates,
        imageSize,
      });

      // Update rotation center: center of the new bbox in pixel space
      const newRotCenter = {
        x: anchorPixel.x + (targetWidthPx / 2) * cosR - (targetHeightPx / 2) * sinR,
        y: anchorPixel.y + (targetWidthPx / 2) * sinR + (targetHeightPx / 2) * cosR,
      };

      await db.annotations.update(annotation.id, {
        rotationCenter: {
          x: newRotCenter.x / imageSize.width,
          y: newRotCenter.y / imageSize.height,
        },
      });
    }

    dispatch(triggerAnnotationsUpdate());
  }

  async function handleChange(newValue) {
    // --- Unit change: persist immediately, no resize ---
    const newUnit = newValue.sizeUnit ?? sizeUnit;
    if (newUnit !== sizeUnit) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      await updateAnnotation({ id: annotation.id, sizeUnit: newUnit });
      dispatch(triggerAnnotationsUpdate());
      return;
    }

    // --- Size change: debounce to let the user finish typing ---
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      commitResize(newValue);
    }, DEBOUNCE_MS);
  }

  // render

  const value = {
    size: { width: displayWidth, height: displayHeight },
    sizeUnit,
  };

  return <FieldSizeAndUnit value={value} onChange={handleChange} unitOptions={UNIT_OPTIONS} />;
}
