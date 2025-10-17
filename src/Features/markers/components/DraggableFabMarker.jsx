import { useState, useRef } from "react";
import { useDndMonitor, useDraggable } from "@dnd-kit/core";

import { useDispatch, useSelector } from "react-redux";

import { setNewAnnotation } from "Features/annotations/annotationsSlice";

import useAnnotationTemplatesBySelectedListing from "Features/annotations/hooks/useAnnotationTemplatesBySelectedListing";
import useAnnotationSpriteImage from "Features/annotations/hooks/useAnnotationSpriteImage";

import { Box, Typography } from "@mui/material";
import FabMarker from "./FabMarker";

import ButtonSelectorAnnotationTemplate from "Features/annotations/components/ButtonSelectorAnnotationTemplate";

import getNewAnnotationPropsFromAnnotationTemplate from "Features/annotations/utils/getNewAnnotationPropsFromAnnotationTemplate";

export default function DraggableFabMarker({
  bgcolor,
  onDragStart,
  onDropped,
}) {
  const dispatch = useDispatch();

  // data

  const annotationTemplates = useAnnotationTemplatesBySelectedListing();
  const spriteImage = useAnnotationSpriteImage();
  const newAnnotation = useSelector((s) => s.annotations.newAnnotation);

  // data - dnd

  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: "marker",
    });
  useDndMonitor({ onDragEnd: handleDragEnd, onDragStart: handleDragStart });

  // state

  const [annotationTemplateId, setAnnotationTemplateId] = useState(null);
  const idRef = useRef();

  // helper

  const annotationTemplate = annotationTemplates?.find(
    (t) => t.id === annotationTemplateId
  );

  // helpers - dnd

  const deltaX = Math.abs(transform?.x ?? 0);
  const deltaY = Math.abs(transform?.y ?? 0);
  const maxDelta = Math.max(deltaX, deltaY);
  const isCreating = maxDelta > 20; // start the creation process

  // Visual offset to show marker above finger (in pixels)
  const FINGER_OFFSET_Y = -80; // Show marker 80px above finger

  // handler

  function handleDragStart(event) {
    if (onDragStart) onDragStart();
  }

  function handleDragEnd(event) {
    if (!isCreating) {
      if (onDropped) {
        onDropped(null);
      }
      return;
    }

    const { active, delta } = event;
    const { initial } = active.rect.current;

    // Largeur et hauteur de la Box au départ du drag
    const { width, height, left, top } = initial;

    // Position du coin supérieur gauche après déplacement
    const baseX = left + delta.x;
    const baseY = top + delta.y;

    // Calcul du centre (ajout de la moitié de la largeur et de la hauteur)
    let x = baseX + width / 2;
    let y = baseY + height / 2;

    // Appliquer votre offset vertical si vous décalez visuellement le marqueur
    y += FINGER_OFFSET_Y;

    if (onDropped) {
      onDropped({
        x,
        y,
      });
    }
  }

  const visualOffsetY = isDragging ? FINGER_OFFSET_Y : 0;

  function handleChange(id) {
    const annotationTemplate = annotationTemplates?.find((t) => t.id === id);
    dispatch(
      setNewAnnotation({
        ...newAnnotation,
        ...getNewAnnotationPropsFromAnnotationTemplate(annotationTemplate),
        isFromAnnotation: false,
      })
    );
    setAnnotationTemplateId(id);
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center" }}>
      {!isCreating && (
        <ButtonSelectorAnnotationTemplate
          annotationTemplateId={annotationTemplateId}
          annotationTemplates={annotationTemplates}
          spriteImage={spriteImage}
          onChange={handleChange}
        />
      )}
      {/* Draggable marker with offset above finger */}
      <Box
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        sx={{
          display: "flex",
          justifyContent: "center",
          transform: `translate(${transform?.x ?? 0}px, ${
            (transform?.y ?? 0) + (isCreating ? visualOffsetY : 0)
          }px)`,
          position: "relative",
          touchAction: "manipulation",
        }}
      >
        <FabMarker
          bgcolor={annotationTemplate?.fillColor ?? bgcolor}
          isCreating={isCreating}
        />
      </Box>
    </Box>
  );
}
